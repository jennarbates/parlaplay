// Spec 6 and 7, platform spec 3.3: what the learner did, kept on this device, one
// store per language. games rows (one per round) and the append-only review log,
// under "guest:{code}" for a guest or "user:{userId}:{code}" when signed in. Every
// row carries its language, and a store only ever holds rows of its own (3.4.1).
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { LanguageCode } from "../languages.ts";
import type { Direction, Level, SlotDetail } from "../types.ts";
import { localDay } from "../services/localDay.ts";
import { read, write, type StorageKey } from "../services/storage.ts";
import { useSyncStore, type Op } from "../services/sync.ts";

export type GameRow = {
  id: string; // client uuid
  language: LanguageCode;
  seed: number;
  level: Level;
  contentVersion: number;
  startedAt: string; // ISO
  endedAt?: string;
  result?: "won" | "lost" | "abandoned";
};

export type ReviewLogRow = {
  id: string; // client uuid, makes sync idempotent
  language: LanguageCode;
  gameId: string;
  lexiconId: string;
  direction: Direction;
  rating: "again" | "hard" | "good" | "slip"; // slip rows feed the Mistakes tab; FSRS skips them
  detail?: SlotDetail;
  localDay: string; // "2026-10-06" in the learner's timezone
  createdAt: string; // ISO
};

// Rows as a language's game makes them; its store adds the language.
export type NewGame = Omit<GameRow, "language" | "endedAt" | "result">;
export type NewReview = Omit<ReviewLogRow, "language">;

export type GuestData = { games: GameRow[]; reviewLog: ReviewLogRow[] };

type ProgressStore = GuestData & {
  loaded: boolean;
  // Whose data this is: "guest", or a signed-in user's id (spec 7.3).
  owner: string;
  hydrate: () => Promise<void>;
  // Load another owner's local copy (on sign-in or sign-out).
  switchOwner: (owner: string) => Promise<void>;
  // Merge rows downloaded from another device (spec 7.3): a union by id, where a
  // finished game beats the same game still open.
  mergeRemote: (remote: GuestData) => void;
  recordGameStart: (game: NewGame) => void;
  recordGameEnd: (gameId: string, result: NonNullable<GameRow["result"]>, at?: Date) => void;
  // Each language turns its round's events into rows (its rowsFor); they are
  // appended here, never edited or removed.
  appendRows: (rows: NewReview[]) => ReviewLogRow[];
};

// In its own module so code that runs outside Vite (e2e tests) can use it too.
export { localDay };

export const storageKeyFor = (owner: string, code: LanguageCode): StorageKey =>
  owner === "guest" ? `guest:${code}` : `user:${owner}:${code}`;

// Saves happen in order across every language, so progressSaved() covers them all.
let saving: Promise<unknown> = Promise.resolve();

// Signed in, every new row also goes to the outbox for Supabase (spec 7.3).
function sync(owner: string, ops: Op[]) {
  if (owner !== "guest") useSyncStore.getState().enqueue(ops);
}

export type ProgressStoreHook = UseBoundStore<StoreApi<ProgressStore>>;

const stores = new Map<LanguageCode, ProgressStoreHook>();

// The store of one language, made the first time it is asked for.
export function progressStore(code: LanguageCode): ProgressStoreHook {
  let store = stores.get(code);
  if (!store) {
    store = createProgressStore(code);
    stores.set(code, store);
  }
  return store;
}

function createProgressStore(code: LanguageCode): ProgressStoreHook {
  const ours = <T extends { language?: unknown }>(rows: unknown): T[] =>
    Array.isArray(rows) ? (rows as T[]).filter((r) => r?.language === code) : [];
  const persist = (owner: string, data: GuestData) => {
    saving = saving.then(() => write(storageKeyFor(owner, code), data));
  };

  return create<ProgressStore>((set, get) => ({
    games: [],
    reviewLog: [],
    loaded: false,
    owner: "guest",

    async switchOwner(owner) {
      // Already this owner's data (loaded, or loading at app start): nothing to do.
      if (owner === get().owner) return;
      set({ owner, games: [], reviewLog: [], loaded: false });
      await get().hydrate();
    },

    async hydrate() {
      const owner = get().owner;
      const saved = await read<Partial<GuestData>>(storageKeyFor(owner, code));
      if (get().owner !== owner) return; // switched again while loading
      // Anything recorded before the saved data arrived is kept, after it. Rows are
      // matched by id, so loading twice never duplicates them.
      set((s) => ({
        loaded: true,
        games: unique([...ours<GameRow>(saved?.games), ...s.games]),
        reviewLog: unique([...ours<ReviewLogRow>(saved?.reviewLog), ...s.reviewLog]),
      }));
    },

    mergeRemote(remote) {
      const games = new Map(get().games.map((g) => [g.id, g]));
      for (const g of ours<GameRow>(remote.games)) {
        const mine = games.get(g.id);
        if (!mine || (!mine.result && g.result)) games.set(g.id, g);
      }
      const reviewLog = unique([...get().reviewLog, ...ours<ReviewLogRow>(remote.reviewLog)]);
      set({ games: [...games.values()], reviewLog });
      persist(get().owner, snapshot(get()));
    },

    recordGameStart(newGame) {
      const game: GameRow = { ...newGame, language: code };
      set((s) => ({ games: [...s.games.filter((g) => g.id !== game.id), game] }));
      persist(get().owner, snapshot(get()));
      sync(get().owner, [{ kind: "game", row: game }]);
    },

    recordGameEnd(gameId, result, at = new Date()) {
      const before = get().games.find((g) => g.id === gameId);
      if (!before || before.result) return; // a row is closed only once
      const after: GameRow = { ...before, endedAt: at.toISOString(), result };
      set((s) => ({ games: s.games.map((g) => (g.id === gameId ? after : g)) }));
      persist(get().owner, snapshot(get()));
      sync(get().owner, [{ kind: "game", row: after }]);
    },

    appendRows(newRows) {
      const rows = newRows.map((r): ReviewLogRow => ({ ...r, language: code }));
      if (rows.length) {
        // Append only: rows are never edited or removed.
        set((s) => ({ reviewLog: [...s.reviewLog, ...rows] }));
        persist(get().owner, snapshot(get()));
        sync(
          get().owner,
          rows.map((row): Op => ({ kind: "review", row })),
        );
      }
      return rows;
    },
  }));
}

const snapshot = ({ games, reviewLog }: GuestData): GuestData => ({ games, reviewLog });

// The last version of each row by id, in first-seen order.
function unique<T extends { id: string }>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()];
}

export function progressSaved(): Promise<unknown> {
  return saving;
}
