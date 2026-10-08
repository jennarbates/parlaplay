// Spec 7.3 and platform spec 2, 6.3: what happens to local data when the account
// changes. The shell reducer makes the decisions (SIGNED_IN, SAVE_GUEST, SIGN_OUT);
// this file finds what they need and carries out the account effects. Signing in
// switches to that user's local copy and outbox and syncs; signing out goes back
// to guest data. Signing in with guest data in any language first asks, once for
// all of them, whether to save it to the account.
import { create } from "zustand";
import type { LanguageCode } from "../languages.ts";
import { registry } from "../registry.ts";
import { read, remove, write } from "../services/storage.ts";
import { pull, syncSaved, useSyncStore, type Op } from "../services/sync.ts";
import { useAuthStore } from "./authStore.ts";
import { loadLevels } from "./prefs.ts";
import { progressSaved, progressStore, storageKeyFor, type GuestData } from "./progressStore.ts";
import { useRounds } from "./rounds.ts";
import { handleAccountEffects, useShell } from "./shell.ts";

type AccountStore = {
  // True once the app knows whose data it is writing (guest or which user) and has
  // that owner's local copy loaded. Play waits for it, so a signed-in learner's
  // first rows after a reload never land in guest data.
  settled: boolean;
};
export const useAccountStore = create<AccountStore>(() => ({ settled: false }));

const hasData = (d: Partial<GuestData> | undefined) => !!(d?.games?.length || d?.reviewLog?.length);

// Forget a language's saved round, in memory and on disk (3.3).
async function clearRound(code: LanguageCode) {
  const rounds = useRounds.getState();
  rounds.hooks[code]?.clearRound();
  rounds.setSaved(code, false);
  await remove(`round:${code}`);
}

// Save: in each language, the guest's rows become this user's (locally, then
// queued to upload; the outbox sends every language's games before any log row and
// skips rows already on the server). Don't save: the guest rows are deleted, and so
// is the saved round, whose games row would never reach the server (F4). Platform
// spec 2 and 6.3.
export async function adoptGuestData(
  userId: string,
  languages: readonly LanguageCode[],
  save: boolean,
): Promise<void> {
  if (save) await useSyncStore.getState().load(userId);
  for (const code of languages) {
    const guest = await read<Partial<GuestData>>(`guest:${code}`);
    if (save && hasData(guest)) {
      const userKey = storageKeyFor(userId, code);
      const mine = (await read<Partial<GuestData>>(userKey)) ?? {};
      const games = [...(mine.games ?? []), ...(guest?.games ?? [])];
      const reviewLog = [...(mine.reviewLog ?? []), ...(guest?.reviewLog ?? [])];
      await write(userKey, { games, reviewLog });
      useSyncStore
        .getState()
        .enqueue([
          ...(guest?.games ?? []).map((row): Op => ({ kind: "game", row })),
          ...(guest?.reviewLog ?? []).map((row): Op => ({ kind: "review", row })),
        ]);
      await syncSaved(); // queued on disk before the guest copy goes
    }
    if (!save) await clearRound(code);
    await remove(`guest:${code}`);
  }
}

// The languages with guest rows on this device: from memory where loaded, else
// from storage, in registry order (platform spec 3.4.7).
async function guestLanguages(): Promise<LanguageCode[]> {
  const found: LanguageCode[] = [];
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

// While the save-guest prompt is open, the sign-in waits here. The shell's
// uploadGuest or deleteGuest effect settles it: true once the answer is applied,
// false if the session ended first.
let waiting: { settle: (applied: boolean) => void; fail: (error: unknown) => void } | null = null;

function stopWaiting() {
  const w = waiting;
  waiting = null;
  w?.settle(false);
}

function untilAnswered(): Promise<boolean> {
  stopWaiting();
  return new Promise((settle, fail) => {
    waiting = { settle, fail };
  });
}

async function saveGuest(userId: string, languages: LanguageCode[], save: boolean) {
  const w = waiting;
  waiting = null;
  try {
    await adoptGuestData(userId, languages, save);
  } catch (error) {
    w?.fail(error);
    throw error;
  }
  w?.settle(true);
}

const allProgress = () => registry.map(({ code }) => progressStore(code).getState());

export async function onAccountChange(userId: string | null) {
  const { dispatch } = useShell.getState();
  if (userId) {
    await progressSaved(); // every guest row is on disk before we look
    const languages = await guestLanguages();
    const answer = languages.length ? untilAnswered() : null;
    // serverLast comes from profiles.last_language once sync reads it (PLAY-023).
    dispatch({ type: "SIGNED_IN", userId, serverLast: null, guestLanguages: languages });
    if (answer) {
      // Nothing switches until the player answers.
      if (useShell.getState().state.prompt?.kind === "saveGuest") {
        if (!(await answer)) return; // signed out before answering
      } else {
        stopWaiting(); // the shell didn't ask, so the guest data stays where it is
      }
    }
  } else {
    stopWaiting();
    dispatch({ type: "SIGNED_OUT" }); // no-op after a sign-out from Settings
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

// Platform spec 6.3, sign-out: first try to sync. Then the shell signs out at once,
// or opens the unsynced warning if any row is still queued. The outbox is shared,
// so this counts the rows of every language.
export async function requestSignOut(): Promise<void> {
  await syncNow();
  const unsynced = useSyncStore.getState().outbox.length > 0;
  useShell.getState().dispatch({ type: "SIGN_OUT", unsynced });
}

// The shell's signOut effect. Sign out and clear this user's local copy (shared
// devices): their progress in every language, their outbox and every language's
// saved round. Device settings (settings:*) and the last language (app) stay
// (platform spec 6.3, D16).
export async function signOutNow(): Promise<void> {
  const userId = useAuthStore.getState().userId;
  await useAuthStore.getState().signOut();
  // Every language's round: in memory for the loaded ones, on disk for all (3.3).
  for (const { code } of registry) await clearRound(code);
  if (userId) {
    for (const { code } of registry) await remove(storageKeyFor(userId, code));
    await remove(`outbox:${userId}`);
  }
  await useSyncStore.getState().load(null);
  await Promise.all(allProgress().map((p) => p.switchOwner("guest")));
}

handleAccountEffects({ saveGuest, signOut: signOutNow });
