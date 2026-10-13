// Platform spec 5.3, /import: bring a Chi è? player's device data over from
// chie.parlaplay.games. Everything is decoded and validated before anything is
// saved, and a failed save stops the import, so the failure screen never follows
// a half-saved handoff that Try again could not repair (every step is a union).
import { languageOf } from "../registry.ts";
import { read, write } from "../services/storage.ts";
import { useAccountStore } from "../store/account.ts";
import { useAuthStore } from "../store/authStore.ts";
import {
  adoptPendingHandoff,
  pendingKey,
  readPending,
  type HandoffRecord,
} from "../store/pendingHandoff.ts";
import {
  mergeData,
  progressSaved,
  progressStore,
  type GameRow,
  type GuestData,
  type ReviewLogRow,
} from "../store/progressStore.ts";
import { useRounds } from "../store/rounds.ts";
import { decodeHandoff } from "./codec.ts";
import {
  keepsExistingRound,
  mergeOutboxes,
  nextPath,
  parseFragment,
  withLanguage,
} from "./merge.ts";

const code = "it" as const;

async function save(...args: Parameters<typeof write>) {
  if (!(await write(...args))) throw new Error(`could not save ${args[0]}`);
}

// The account is known and its local copy loaded (store/account.ts), so the rows
// below land beside the right owner's data.
function accountSettled(): Promise<void> {
  return new Promise((resolve) => {
    if (useAccountStore.getState().settled) return resolve();
    const stop = useAccountStore.subscribe((s) => {
      if (!s.settled) return;
      stop();
      resolve();
    });
  });
}

const rowsOf = <T extends { language?: unknown }>(rows: unknown): T[] =>
  Array.isArray(rows) ? (rows as T[]).filter((r) => r?.language === code) : [];

// Returns where to go next. Throws if the fragment is missing or damaged, or if
// the device would not save it.
export async function importHandoff(hash: string, now = new Date()): Promise<string> {
  const { data, next } = parseFragment(hash);
  if (!data) throw new Error("no handoff data");
  const incoming = withLanguage(await decodeHandoff(data));

  await accountSettled();
  await progressSaved();
  const progress = progressStore(code);

  // Step 3: guest rows, a union by id with what guest:it already holds.
  const saved = await read<Partial<GuestData>>(`guest:${code}`);
  const guest = mergeData(
    { games: rowsOf<GameRow>(saved?.games), reviewLog: rowsOf<ReviewLogRow>(saved?.reviewLog) },
    incoming.guest,
  );
  await save(`guest:${code}`, guest);
  // A guest has those rows open in memory; a signed-in player meets them, as any
  // guest data, the next time they sign in.
  if (progress.getState().owner === "guest") {
    progress.getState().mergeRemote(incoming.guest);
    await progressSaved();
  }

  // The saved round, unless the one already here is newer.
  if (incoming.round) {
    const existing = await read<{ gameId?: unknown }>(`round:${code}`);
    const games = [...guest.games, ...progress.getState().games];
    if (!keepsExistingRound(existing, incoming.round, games)) {
      await save(`round:${code}`, incoming.round);
      useRounds
        .getState()
        .setSaved(code, incoming.round.contentVersion === languageOf(code).contentVersion);
    }
  }

  // Step 4: unsynced rows wait for their own user.
  if (incoming.outboxes.length)
    await save(pendingKey, mergeOutboxes(await readPending(), incoming.outboxes));

  // Step 5.
  await save("handoff", { from: "chie", at: now.toISOString() } satisfies HandoffRecord);
  await adoptPendingHandoff(useAuthStore.getState().userId, now); // already signed in as them
  return nextPath(next);
}

// The fallback of the failure screen's Start fresh, and of step 5.
export const freshPath = `/${code}`;
