// Platform spec 5.3 step 4: rows a signed-in Chi è? player had not synced when the
// handoff ran. They wait under "outbox:pending-handoff" with their user id, and
// join the outbox only when that same user signs in here. Another account never
// sees them, and they are deleted 30 days after the handoff.
import type { PendingOutbox } from "../handoff/merge.ts";
import { read, remove, write } from "../services/storage.ts";
import { syncSaved, useSyncStore } from "../services/sync.ts";
import { progressStore } from "./progressStore.ts";

export const pendingKey = "outbox:pending-handoff";
export const pendingDays = 30;

export type HandoffRecord = { from: "chie"; at: string };

export async function readPending(): Promise<PendingOutbox[]> {
  const saved = await read<PendingOutbox[]>(pendingKey);
  return Array.isArray(saved) ? saved : [];
}

// Called whenever the account is known (store/account.ts), after that user's own
// outbox is loaded and before the first sync.
export async function adoptPendingHandoff(userId: string | null, now = new Date()): Promise<void> {
  const pending = await readPending();
  if (pending.length === 0) return;
  const handoff = await read<Partial<HandoffRecord>>("handoff");
  const at = Date.parse(handoff?.at ?? "");
  if (now.getTime() - at > pendingDays * 24 * 60 * 60 * 1000) {
    await remove(pendingKey);
    return;
  }
  const ops = pending.filter((p) => p.userId === userId).flatMap((p) => p.ops);
  if (!userId || ops.length === 0) return;

  // Queued on disk before the waiting copy goes, so a crash between the two can
  // only send a row twice, which the server ignores.
  useSyncStore.getState().enqueue(ops);
  await syncSaved();
  const rest = pending.filter((p) => p.userId !== userId);
  await (rest.length ? write(pendingKey, rest) : remove(pendingKey));

  // And into this user's local copy, so Progress shows them before the next pull.
  const games = ops.flatMap((op) => (op.kind === "game" ? [op.row] : []));
  const reviewLog = ops.flatMap((op) => (op.kind === "review" ? [op.row] : []));
  for (const code of new Set(ops.map((op) => op.row.language))) {
    const progress = progressStore(code).getState();
    if (progress.owner === userId) progress.mergeRemote({ games, reviewLog });
  }
}
