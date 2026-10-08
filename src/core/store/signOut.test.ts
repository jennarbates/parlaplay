import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, test, vi } from "vitest";

// A fake Supabase whose uploads can be made to fail, and a fake auth.
let online = true;
const signOutCalls: number[] = [];
vi.mock("../services/supabase.ts", () => ({
  supabase: {
    from: () => ({
      upsert: async () => ({ error: online ? null : { message: "offline" } }),
      select: () => ({ order: () => ({ range: async () => ({ data: [], error: null }) }) }),
    }),
    auth: { signOut: async () => void signOutCalls.push(1) },
  },
}));
const { requestSignOut } = await import("./account.ts");
const { useAuthStore } = await import("./authStore.ts");
const { useShell } = await import("./shell.ts");
const { initialShellState } = await import("../state/reduce.ts");
const { useGameStore } = await import("../../languages/it/store/gameStore.ts");
// Registers its round hooks, as visiting /it does; sign-out clears the round through them.
await import("../../languages/it/index.ts");
const { progressStore } = await import("./progressStore.ts");
const useProgressStore = progressStore("it");
const zh = progressStore("zh");
const { useSyncStore } = await import("../services/sync.ts");
const { read, resetForTests, write } = await import("../services/storage.ts");

const user = "00000000-0000-4000-8000-00000000000a";
const at = new Date("2026-10-19T10:00:00Z").toISOString();

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  online = true;
  signOutCalls.length = 0;
  useAuthStore.setState({ status: "signedIn", userId: user, email: "a@b.co" });
  useShell.setState({
    state: { ...initialShellState, hydrated: true, account: { kind: "signedIn", userId: user } },
    saving: null,
  });
  for (const p of [useProgressStore, zh])
    p.setState({ games: [], reviewLog: [], loaded: true, owner: user });
  await useSyncStore.getState().load(user);
  useGameStore.setState({
    status: "ready",
    game: null,
    gameId: null,
    lastAction: null,
    lastEvents: [],
  });
});

const prompt = () => useShell.getState().state.prompt;
const signedOut = () => vi.waitFor(() => expect(useProgressStore.getState().owner).toBe("guest"));

async function playSignedIn() {
  useGameStore.getState().start(2, 99);
  useGameStore.getState().dispatch({
    type: "ASK",
    templateId: "t.have",
    fill: { verb: "v.e", art: "art.la", noun: "n.barba" },
  });
  await new Promise((r) => setTimeout(r, 20));
}

function playChineseSignedIn() {
  zh.getState().recordGameStart({
    id: "g-zh",
    seed: 1,
    level: 1,
    contentVersion: 1,
    startedAt: at,
  });
}

describe("sign-out (CHI-087)", () => {
  test("with everything synced, signs out at once and clears this user's data", async () => {
    await playSignedIn();
    await requestSignOut();
    expect(prompt()).toBeNull();
    await signedOut();
    expect(signOutCalls).toHaveLength(1);
    expect(useShell.getState().state.account).toEqual({ kind: "guest" });
    expect(await read(`user:${user}:it`)).toBeUndefined();
    expect(await read(`outbox:${user}`)).toBeUndefined();
    expect(await read("round:it")).toBeUndefined();
    expect(useGameStore.getState().game).toBeNull();
    expect(useProgressStore.getState()).toMatchObject({
      owner: "guest",
      games: [],
      reviewLog: [],
    });
  });

  test("with rows that cannot sync, warns instead of signing out", async () => {
    online = false;
    await playSignedIn();
    await requestSignOut();
    expect(prompt()).toEqual({ kind: "unsyncedSignOut" });
    expect(signOutCalls).toEqual([]);
    expect(useSyncStore.getState().outbox.length).toBeGreaterThan(0);
    expect(useProgressStore.getState().owner).toBe(user); // nothing cleared
  });

  test("Wait keeps everything and stays signed in", async () => {
    online = false;
    await playSignedIn();
    await requestSignOut();
    useShell.getState().dispatch({ type: "CONFIRM_SIGN_OUT", answer: "wait" });
    await new Promise((r) => setTimeout(r, 0));
    expect(prompt()).toBeNull();
    expect(signOutCalls).toEqual([]);
    expect(useShell.getState().state.account).toEqual({ kind: "signedIn", userId: user });
  });

  test("Sign out anyway clears everything, unsynced rows included", async () => {
    online = false;
    await playSignedIn();
    await requestSignOut();
    useShell.getState().dispatch({ type: "CONFIRM_SIGN_OUT", answer: "signOut" });
    await signedOut();
    expect(signOutCalls).toHaveLength(1);
    expect(await read(`outbox:${user}`)).toBeUndefined();
    expect(useSyncStore.getState().outbox).toEqual([]);
  });

  test("the guest's data on the device is left alone", async () => {
    await write("guest:it", { games: [{ id: "guest-game" }], reviewLog: [] });
    await requestSignOut();
    await signedOut();
    expect(await read("guest:it")).toEqual({ games: [{ id: "guest-game" }], reviewLog: [] });
  });
});

// PLAY-025, platform spec 2, 6.3, D16: one sign-out covers every language.
describe("sign-out covers every language", () => {
  test("clears user:{userId}:* and round:{code} for every language, keeps settings:* and app", async () => {
    await write(`user:${user}:it`, { games: [{ id: "a" }], reviewLog: [] });
    await write(`user:${user}:zh`, { games: [{ id: "b" }], reviewLog: [] });
    await write("round:it", { contentVersion: 1, gameId: "a", state: {} });
    await write("round:zh", { contentVersion: 1, gameId: "b", state: {} });
    await write("settings:it", { sound: false });
    await write("settings:zh", { pinyinAtLevel2: true });
    await write("app", { lastLanguage: "zh" });
    await requestSignOut();
    await signedOut();
    await vi.waitFor(() => expect(zh.getState().owner).toBe("guest"));
    for (const code of ["it", "zh"]) {
      expect(await read(`user:${user}:${code}`)).toBeUndefined();
      expect(await read(`round:${code}`)).toBeUndefined();
    }
    expect(await read("settings:it")).toEqual({ sound: false });
    expect(await read("settings:zh")).toEqual({ pinyinAtLevel2: true });
    expect(await read("app")).toEqual({ lastLanguage: "zh" });
  });

  test("the unsynced warning counts queued rows of every language", async () => {
    online = false;
    playChineseSignedIn(); // only a Chinese row is queued
    await requestSignOut();
    expect(useSyncStore.getState().outbox.map((op) => op.row.language)).toEqual(["zh"]);
    expect(prompt()).toEqual({ kind: "unsyncedSignOut" });
    expect(signOutCalls).toEqual([]);
  });

  test("a session ended elsewhere goes back to guest without clearing anything", async () => {
    const { onAccountChange } = await import("./account.ts");
    await write(`user:${user}:zh`, { games: [{ id: "b" }], reviewLog: [] });
    await onAccountChange(null);
    expect(useShell.getState().state.account).toEqual({ kind: "guest" });
    expect(signOutCalls).toEqual([]);
    expect(await read(`user:${user}:zh`)).toEqual({ games: [{ id: "b" }], reviewLog: [] });
  });
});
