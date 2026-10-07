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
const { requestSignOut, signOutNow } = await import("./account.ts");
const { useAuthStore } = await import("./authStore.ts");
const { useGameStore } = await import("../../languages/it/store/gameStore.ts");
// Registers its round hooks, as visiting /it does; sign-out clears the round through them.
await import("../../languages/it/index.ts");
const { useProgressStore } = await import("./progressStore.ts");
const { useSyncStore } = await import("../services/sync.ts");
const { read, resetForTests, write } = await import("../services/storage.ts");

const user = "00000000-0000-4000-8000-00000000000a";

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  online = true;
  signOutCalls.length = 0;
  useAuthStore.setState({ status: "signedIn", userId: user, email: "a@b.co" });
  useProgressStore.setState({ games: [], reviewLog: [], loaded: true, owner: user });
  await useSyncStore.getState().load(user);
  useGameStore.setState({
    status: "ready",
    game: null,
    gameId: null,
    lastAction: null,
    lastEvents: [],
  });
});

async function playSignedIn() {
  useGameStore.getState().start(2, 99);
  useGameStore.getState().dispatch({
    type: "ASK",
    templateId: "t.have",
    fill: { verb: "v.e", art: "art.la", noun: "n.barba" },
  });
  await new Promise((r) => setTimeout(r, 20));
}

describe("sign-out (CHI-087)", () => {
  test("with everything synced, signs out at once and clears this user's data", async () => {
    await playSignedIn();
    expect(await requestSignOut()).toBe("signedOut");
    expect(signOutCalls).toHaveLength(1);
    expect(await read(`user:${user}`)).toBeUndefined();
    expect(await read(`outbox:${user}`)).toBeUndefined();
    expect(await read("round:it")).toBeUndefined();
    expect(useGameStore.getState().game).toBeNull();
    expect(useProgressStore.getState()).toMatchObject({ owner: "guest", games: [], reviewLog: [] });
  });

  test("with rows that cannot sync, warns instead of signing out", async () => {
    online = false;
    await playSignedIn();
    expect(await requestSignOut()).toBe("unsynced");
    expect(signOutCalls).toEqual([]);
    expect(useSyncStore.getState().outbox.length).toBeGreaterThan(0);
    expect(useProgressStore.getState().owner).toBe(user); // nothing cleared
  });

  test("Sign out anyway clears everything, unsynced rows included", async () => {
    online = false;
    await playSignedIn();
    await requestSignOut();
    await signOutNow();
    expect(signOutCalls).toHaveLength(1);
    expect(await read(`outbox:${user}`)).toBeUndefined();
    expect(useSyncStore.getState().outbox).toEqual([]);
  });

  test("the guest's data on the device is left alone", async () => {
    await write("guest", { games: [{ id: "guest-game" }], reviewLog: [] });
    await signOutNow();
    expect(await read("guest")).toEqual({ games: [{ id: "guest-game" }], reviewLog: [] });
  });
});
