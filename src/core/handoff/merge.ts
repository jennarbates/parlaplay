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

// Step 3: the incoming round is saved unless the device already has one whose
// games row started later. If either games row is missing, the existing round is
// kept. The same round arriving again is also left alone: a second import adds
// nothing, and the copy here may have been played further.
export function keepsExistingRound(
  existing: { gameId?: unknown } | undefined,
  incoming: ChieRound,
  games: readonly Pick<GameRow, "id" | "startedAt">[],
): boolean {
  if (!existing) return false;
  if (existing.gameId === incoming.gameId) return true;
  const startOf = (id: unknown) => games.find((g) => g.id === id)?.startedAt;
  const mine = startOf(existing.gameId);
  const theirs = startOf(incoming.gameId);
  if (!mine || !theirs) return true;
  return Date.parse(mine) > Date.parse(theirs);
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
