// Spec 7.3: signed in, every write goes to an IndexedDB outbox first, then is
// flushed to Supabase. games rows always go before review_log rows, because each
// log row points at its game. A failed flush keeps everything and tries again on
// the next round end, app start or `online` event; play is never blocked.
import { create } from "zustand";
import { knownCode } from "../registry.ts";
import type { GameRow, ReviewLogRow } from "../store/progressStore.ts";
import { replay } from "./srs.ts";
import { read, write } from "./storage.ts";
import { supabase } from "./supabase.ts";

export type Op = { kind: "game"; row: GameRow } | { kind: "review"; row: ReviewLogRow };

type SyncStore = {
  userId: string | null;
  outbox: Op[];
  status: "idle" | "syncing" | "failed";
  // Load this user's outbox (or forget it when null).
  load: (userId: string | null) => Promise<void>;
  enqueue: (ops: Op[]) => void;
  flush: () => Promise<boolean>;
};

const key = (userId: string) => `outbox:${userId}` as const;

let saving: Promise<unknown> = Promise.resolve();
function persist(userId: string, outbox: Op[]) {
  saving = saving.then(() => write(key(userId), outbox));
}

export const gameToDb = (userId: string, g: GameRow) => ({
  id: g.id,
  user_id: userId,
  language: g.language, // platform spec 6.1
  seed: g.seed,
  level: g.level,
  content_version: g.contentVersion,
  started_at: g.startedAt,
  ended_at: g.endedAt ?? null,
  result: g.result ?? null,
});

export const reviewToDb = (userId: string, r: ReviewLogRow) => ({
  id: r.id,
  user_id: userId,
  language: r.language,
  game_id: r.gameId,
  lexicon_id: r.lexiconId,
  direction: r.direction,
  rating: r.rating,
  detail: r.detail ?? null,
  local_day: r.localDay,
  created_at: r.createdAt,
});

let flushing: Promise<boolean> | undefined;

export const useSyncStore = create<SyncStore>((set, get) => ({
  userId: null,
  outbox: [],
  status: "idle",

  async load(userId) {
    if (!userId) {
      set({ userId: null, outbox: [], status: "idle" });
      return;
    }
    const saved = await read<Op[]>(key(userId));
    set({ userId, outbox: Array.isArray(saved) ? saved : [], status: "idle" });
  },

  enqueue(ops) {
    const { userId, outbox } = get();
    if (!userId || ops.length === 0) return;
    const next = [...outbox, ...ops];
    set({ outbox: next });
    persist(userId, next);
  },

  flush() {
    // One flush at a time; a second call waits for the one in flight.
    flushing ??= doFlush().finally(() => {
      flushing = undefined;
    });
    return flushing;
  },
}));

async function doFlush(): Promise<boolean> {
  const { userId, outbox } = useSyncStore.getState();
  if (!userId || !supabase) return false;
  if (outbox.length === 0) return true;
  useSyncStore.setState({ status: "syncing" });

  // The newest version of each game wins (START, then round end).
  const games = new Map<string, GameRow>();
  const reviews: ReviewLogRow[] = [];
  for (const op of outbox) {
    if (op.kind === "game") games.set(op.row.id, op.row);
    else reviews.push(op.row);
  }

  try {
    if (games.size) {
      const { error } = await supabase
        .from("games")
        .upsert([...games.values()].map((g) => gameToDb(userId, g)));
      if (error) throw error;
    }
    if (reviews.length) {
      // Append-only and idempotent: a row already on the server is skipped.
      const { error } = await supabase.from("review_log").upsert(
        reviews.map((r) => reviewToDb(userId, r)),
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (error) throw error;
    }
  } catch {
    useSyncStore.setState({ status: "failed" });
    return false;
  }

  // Remove only what was sent; anything enqueued meanwhile stays for next time.
  const sent = new Set(outbox);
  const rest = useSyncStore.getState().outbox.filter((op) => !sent.has(op));
  useSyncStore.setState({ outbox: rest, status: "idle" });
  persist(userId, rest);
  return true;
}

// Rows as the database returns them.
type DbGame = ReturnType<typeof gameToDb>;
type DbReview = ReturnType<typeof reviewToDb>;

// A row of a language this app doesn't have is left out (null).
export const gameFromDb = (g: DbGame): GameRow | null => {
  const language = knownCode(g.language);
  return (
    language && {
      id: g.id,
      language,
      seed: Number(g.seed),
      level: g.level,
      contentVersion: g.content_version,
      startedAt: new Date(g.started_at).toISOString(),
      ...(g.ended_at && { endedAt: new Date(g.ended_at).toISOString() }),
      ...(g.result && { result: g.result }),
    }
  );
};

export const reviewFromDb = (r: DbReview): ReviewLogRow | null => {
  const language = knownCode(r.language);
  return (
    language && {
      id: r.id,
      language,
      gameId: r.game_id,
      lexiconId: r.lexicon_id,
      direction: r.direction,
      rating: r.rating,
      ...(r.detail && { detail: r.detail }),
      localDay: r.local_day,
      createdAt: new Date(r.created_at).toISOString(),
    }
  );
};

const pageSize = 1000; // Supabase's default max rows per request

async function fetchAll<T>(table: "games" | "review_log"): Promise<T[]> {
  if (!supabase) return [];
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) return rows;
  }
}

// Spec 7.3, merging across devices: download the account's whole log and games,
// every language at once (each language's store keeps only its own rows). The log
// is append-only with client uuids, so the merge is a union with no conflicts.
// Each language's cards are then rebuilt by replaying that language's log and
// upserted with its row count as log_count, which the database uses to ignore a
// stale device's older state (platform spec 6.1).
export async function pull(): Promise<{ games: GameRow[]; reviewLog: ReviewLogRow[] } | null> {
  const { userId } = useSyncStore.getState();
  if (!userId || !supabase) return null;
  try {
    const [games, log] = await Promise.all([
      fetchAll<DbGame>("games"),
      fetchAll<DbReview>("review_log"),
    ]);
    const reviewLog = log.map(reviewFromDb).filter((r) => r !== null);
    const byLanguage = new Map<ReviewLogRow["language"], ReviewLogRow[]>();
    for (const r of reviewLog)
      byLanguage.set(r.language, [...(byLanguage.get(r.language) ?? []), r]);
    // Only reviewed cards are upserted, and replay makes a card for every id in the
    // log, so this needs no language's card list.
    const cards = [...byLanguage].flatMap(([language, rows]) =>
      [...replay([], rows).values()]
        .filter((c) => c.reviews > 0)
        .map((c) => ({
          user_id: userId,
          language,
          lexicon_id: c.lexiconId,
          direction: c.direction,
          state: c.card,
          due: c.card.due.toISOString(),
          log_count: rows.length,
          updated_at: new Date().toISOString(),
        })),
    );
    if (cards.length) {
      const { error } = await supabase.from("cards").upsert(cards);
      if (error) throw error;
    }
    return { games: games.map(gameFromDb).filter((g) => g !== null), reviewLog };
  } catch {
    useSyncStore.setState({ status: "failed" });
    return null;
  }
}

export function syncSaved(): Promise<unknown> {
  return saving;
}
