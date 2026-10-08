// Spec 7.3: what happens to local data when the account changes. Signing in
// switches to that user's local copy and outbox and syncs; signing out goes back
// to guest data. Signing in with guest data on this device first asks whether to
// save it to the account.
import { create } from "zustand";
import { read, remove, write } from "../services/storage.ts";
import { registry } from "../registry.ts";
import { loadLevels } from "./prefs.ts";
import { pull, useSyncStore, type Op } from "../services/sync.ts";
import { useAuthStore } from "./authStore.ts";
import { progressSaved, progressStore, storageKeyFor, type GuestData } from "./progressStore.ts";
import { useRounds } from "./rounds.ts";

type AccountStore = {
  // "Save your progress to this account?" is showing. It stays up, busy, until the
  // answer is on disk, so leaving the page before then just asks again.
  askToSave: { resolve: (save: boolean) => void; saving: boolean } | null;
  // True once the app knows whose data it is writing (guest or which user) and has
  // that owner's local copy loaded. Play waits for it, so a signed-in learner's
  // first rows after a reload never land in guest data.
  settled: boolean;
};
export const useAccountStore = create<AccountStore>(() => ({ askToSave: null, settled: false }));

// The first answer counts; the caller closes the prompt once it is applied.
function ask(): Promise<boolean> {
  return new Promise((resolve) => {
    const answer = (save: boolean) => {
      if (useAccountStore.getState().askToSave?.saving) return;
      useAccountStore.setState({ askToSave: { resolve: answer, saving: true } });
      resolve(save);
    };
    useAccountStore.setState({ askToSave: { resolve: answer, saving: false } });
  });
}

const hasData = (d: Partial<GuestData> | undefined) => !!(d?.games?.length || d?.reviewLog?.length);

// Yes: in every language, the guest's rows become this user's (locally, then
// uploaded: every language's games before any log row, skipping rows already on the
// server). No: the guest data is deleted. Platform spec 2 and 6.3.
export async function adoptGuestData(userId: string, save: boolean): Promise<void> {
  for (const { code } of registry) {
    const guest = await read<Partial<GuestData>>(`guest:${code}`);
    if (save && hasData(guest)) {
      const userKey = storageKeyFor(userId, code);
      const mine = (await read<Partial<GuestData>>(userKey)) ?? {};
      const games = [...(mine.games ?? []), ...(guest?.games ?? [])];
      const reviewLog = [...(mine.reviewLog ?? []), ...(guest?.reviewLog ?? [])];
      await write(userKey, { games, reviewLog });
      await useSyncStore.getState().load(userId);
      const ops: Op[] = [
        ...(guest?.games ?? []).map((row): Op => ({ kind: "game", row })),
        ...(guest?.reviewLog ?? []).map((row): Op => ({ kind: "review", row })),
      ];
      useSyncStore.getState().enqueue(ops);
    }
    await remove(`guest:${code}`);
  }
}

// The languages with guest rows on this device: from memory where loaded, else
// from storage (platform spec 3.4.7 keeps them in registry order).
async function guestLanguages() {
  const found = [];
  for (const { code } of registry) {
    const progress = progressStore(code).getState();
    const guest =
      progress.owner === "guest" && progress.loaded
        ? progress
        : await read<Partial<GuestData>>(`guest:${code}`);
    if (hasData(guest)) found.push(code);
  }
  return found;
}

const allProgress = () => registry.map(({ code }) => progressStore(code).getState());

export async function onAccountChange(userId: string | null) {
  if (userId) {
    await progressSaved(); // every guest row is on disk before we look
    if ((await guestLanguages()).length) {
      try {
        await adoptGuestData(userId, await ask());
      } finally {
        useAccountStore.setState({ askToSave: null });
      }
    }
  }
  await Promise.all(allProgress().map((p) => p.switchOwner(userId ?? "guest")));
  await useSyncStore.getState().load(userId);
  // Local data is ready: play can start. The network sync below never holds it up.
  useAccountStore.setState({ settled: true });
  if (userId) {
    await loadLevels(userId);
    await syncNow();
  }
}

// Push the outbox, then pull every device's rows and merge them in (spec 7.3).
export async function syncNow(): Promise<void> {
  const sync = useSyncStore.getState();
  if (!sync.userId) return;
  if (!(await sync.flush())) return;
  const remote = await pull();
  if (!remote) return;
  // Each language's store takes only its own rows (3.4.1).
  for (const progress of allProgress())
    if (progress.owner === sync.userId) progress.mergeRemote(remote);
}

export function startAccountSync() {
  let current: string | null | undefined;
  const follow = (userId: string | null, status: string) => {
    if (status === "loading" || userId === current) return;
    current = userId;
    void onAccountChange(userId);
  };
  useAuthStore.subscribe((s) => follow(s.userId, s.status));
  follow(useAuthStore.getState().userId, useAuthStore.getState().status);

  // Spec 7.3: flush on app start (above), on each round end (game store), and when
  // the connection comes back.
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => void syncNow());
  }
}

// Spec 7.3, sign-out: first try to sync. If rows are still waiting, say so and let
// the learner choose; otherwise sign out straight away.
export async function requestSignOut(): Promise<"signedOut" | "unsynced"> {
  await syncNow();
  if (useSyncStore.getState().outbox.length > 0) return "unsynced";
  await signOutNow();
  return "signedOut";
}

// Sign out and clear this user's local copy (shared devices): their progress in
// every language, their outbox and any round in progress.
export async function signOutNow(): Promise<void> {
  const userId = useAuthStore.getState().userId;
  await useAuthStore.getState().signOut();
  // Every language's round: in memory for the loaded ones, on disk for all (3.3).
  const rounds = useRounds.getState();
  for (const { code } of registry) {
    rounds.hooks[code]?.clearRound();
    rounds.setSaved(code, false);
    await remove(`round:${code}`);
  }
  // This user's copy in every language (platform spec 2, D16), and their outbox.
  if (userId) {
    for (const { code } of registry) await remove(storageKeyFor(userId, code));
    await remove(`outbox:${userId}`);
  }
  await useSyncStore.getState().load(null);
  await Promise.all(allProgress().map((p) => p.switchOwner("guest")));
}
