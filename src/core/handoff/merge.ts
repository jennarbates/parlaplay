// Platform spec 5.3, the decisions of /import, with no storage or DOM so they can
// be tested directly: where to go next, which rows arrive, and which saved round
// is kept.
import type { Op } from "../services/sync.ts";
import type { GameRow, GuestData } from "../store/progressStore.ts";
import type { ChieRound, Handoff } from "./schema.ts";

// Everything handed off is Chi è?'s, so every row is Italian.
const language = "it" as const;

export const nextPaths = ["/it", "/it/play", "/it/progress"] as const;

// Step 5: next is one of the three Italian screens, or it is /it, so a crafted link
// cannot send the player anywhere else.
export function nextPath(next: string | null): (typeof nextPaths)[number] {
  return nextPaths.find((path) => path === next) ?? "/it";
}

// The data and next parts of the fragment "#data=…&next=/it/play".
export function parseFragment(hash: string): { data: string | null; next: string | null } {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return { data: params.get("data"), next: params.get("next") };
}

// What a signed-in Chi è? player had not synced yet, kept for that same user.
export type PendingOutbox = { userId: string; ops: Op[] };

export type Incoming = {
  guest: GuestData;
  round: ChieRound | undefined;
  outboxes: PendingOutbox[];
};

// Step 2: every row gets language "it".
export function withLanguage(handoff: Handoff): Incoming {
  return {
    guest: {
      games: (handoff.guest?.games ?? []).map((g) => ({ ...g, language })),
      reviewLog: (handoff.guest?.reviewLog ?? []).map((r) => ({ ...r, language })),
    },
    round: handoff.round,
    outboxes: (handoff.outboxes ?? [])
      .filter((o) => o.ops.length > 0)
      .map(({ userId, ops }) => ({
        userId,
        ops: ops.map((op): Op =>
          op.kind === "game"
            ? { kind: "game", row: { ...op.row, language } }
            : { kind: "review", row: { ...op.row, language } },
        ),
      })),
  };
}

// Step 3: which round the device ends up with. `games` is every games row known
// here after the merge. The incoming round is refused when:
// - its games row did not come with it (a signed-in Chi è? player's row is on the
//   server, not in the handoff), or that row is already finished: the handoff page
//   never deletes anything, so an old link brings a finished round back every time;
// - it is the round already here, which may have been played further;
// - the round already here started later, or its own games row is missing.
export function keepsExistingRound(
  existing: { gameId?: unknown } | undefined,
  incoming: ChieRound,
  games: readonly Pick<GameRow, "id" | "startedAt" | "result">[],
): boolean {
  const row = (id: unknown) => games.find((g) => g.id === id);
  const theirs = row(incoming.gameId);
  if (!theirs || theirs.result) return true;
  if (!existing) return false;
  if (existing.gameId === incoming.gameId) return true;
  const mine = row(existing.gameId);
  if (!mine) return true;
  return Date.parse(mine.startedAt) > Date.parse(theirs.startedAt);
}

// Rows not already in `have`, by id: what a signed-in player's own copy lacks.
export function newTo(incoming: GuestData, have: GuestData): GuestData {
  const games = new Set(have.games.map((g) => g.id));
  const reviews = new Set(have.reviewLog.map((r) => r.id));
  return {
    games: incoming.games.filter((g) => !games.has(g.id)),
    reviewLog: incoming.reviewLog.filter((r) => !reviews.has(r.id)),
  };
}

// Step 4: outboxes join the ones already waiting, per user, each op once.
export function mergeOutboxes(
  waiting: readonly PendingOutbox[],
  incoming: readonly PendingOutbox[],
): PendingOutbox[] {
  const byUser = new Map<string, Map<string, Op>>();
  for (const { userId, ops } of [...waiting, ...incoming]) {
    const mine = byUser.get(userId) ?? new Map<string, Op>();
    for (const op of ops) mine.set(JSON.stringify(op), op);
    byUser.set(userId, mine);
  }
  return [...byUser].map(([userId, ops]) => ({ userId, ops: [...ops.values()] }));
}
