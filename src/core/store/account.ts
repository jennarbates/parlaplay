// Spec 7.3 and platform spec 2, 6.3: what happens to local data when the account
// changes. The shell reducer makes the decisions (SIGNED_IN, SAVE_GUEST, SIGN_OUT);
// this file finds what they need and carries out the account effects. Signing in
// switches to that user's local copy and outbox and syncs; signing out goes back
// to guest data. Signing in with guest data in any language first asks, once for
// all of them, whether to save it to the account.
import { create } from "zustand";
import type { LanguageCode } from "../languages.ts";
import { knownCode, registry } from "../registry.ts";
import { read, remove, write } from "../services/storage.ts";
import { supabase } from "../services/supabase.ts";
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

// How long sign-in waits for the account's last language before going on without it.
const profileWait = 3000;

// Platform spec 2: a device with no last language takes the account's, if it has
// one. The app key is read here too, because at start the shell may not have read
// it yet. A slow network gives up rather than hold up sign-in.
async function serverLast(userId: string): Promise<LanguageCode | null> {
  const client = supabase;
  if (!client || useShell.getState().state.lastLanguage) return null;
  const app = await read<{ lastLanguage?: unknown }>("app");
  if (knownCode(app?.lastLanguage)) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const asked = client
      .from("profiles")
      .select("last_language")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => knownCode((data as { last_language?: unknown } | null)?.last_language));
    const gaveUp = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), profileWait);
    });
    return await Promise.race([asked, gaveUp]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// The shell's writeProfile effect (platform spec 6.3): choosing a language while
// signed in saves it to the account too, for the next new device. Best effort: on
// this device the app key is what counts.
async function writeProfile(userId: string, lastLanguage: LanguageCode) {
  try {
    await supabase?.from("profiles").update({ last_language: lastLanguage }).eq("id", userId);
  } catch {
    // Offline: the next choice writes it again.
  }
}

const allProgress = () => registry.map(({ code }) => progressStore(code).getState());

export async function onAccountChange(userId: string | null) {
  const { dispatch } = useShell.getState();
  if (userId) {
    await progressSaved(); // every guest row is on disk before we look
    const languages = await guestLanguages();
    const last = await serverLast(userId);
    const answer = languages.length ? untilAnswered() : null;
    dispatch({ type: "SIGNED_IN", userId, serverLast: last, guestLanguages: languages });
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

handleAccountEffects({ writeProfile, saveGuest, signOut: signOutNow });
