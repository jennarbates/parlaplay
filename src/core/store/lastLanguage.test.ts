// PLAY-023, platform spec 2 and 6.3: profiles.last_language. A device with no last
// language takes the account's at sign-in; choosing a language while signed in
// saves it to the account.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, test, vi } from "vitest";

// A fake Supabase with one profiles row.
let lastOnServer: unknown = null;
let profileReads = 0;
const profileWrites: { row: unknown; id: string }[] = [];
vi.mock("../services/supabase.ts", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === "profiles"
            ? {
                maybeSingle: async () => {
                  profileReads++;
                  return { data: { last_language: lastOnServer }, error: null };
                },
              }
            : Promise.resolve({ data: [], error: null }),
        order: () => ({ range: async () => ({ data: [], error: null }) }),
      }),
      update: (row: unknown) => ({
        eq: async (_column: string, id: string) => {
          profileWrites.push({ row, id });
          return { error: null };
        },
      }),
      upsert: async () => ({ error: null }),
    }),
  },
}));
const { onAccountChange } = await import("./account.ts");
const { useShell } = await import("./shell.ts");
const { initialShellState } = await import("../state/reduce.ts");
const { progressStore } = await import("./progressStore.ts");
const { useSyncStore } = await import("../services/sync.ts");
const { read, resetForTests, write } = await import("../services/storage.ts");

const user = "00000000-0000-4000-8000-00000000000a";

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  lastOnServer = null;
  profileReads = 0;
  profileWrites.length = 0;
  for (const code of ["it", "zh"] as const)
    progressStore(code).setState({ games: [], reviewLog: [], loaded: true, owner: "guest" });
  useShell.setState({ state: { ...initialShellState, hydrated: true }, saving: null });
  await useSyncStore.getState().load(null);
});

test("a device with no last language takes the account's at sign-in", async () => {
  lastOnServer = "zh";
  await onAccountChange(user);
  expect(useShell.getState().state.lastLanguage).toBe("zh");
  await vi.waitFor(async () => expect(await read("app")).toEqual({ lastLanguage: "zh" }));
});

test("the device's own last language wins, and the account is not asked", async () => {
  lastOnServer = "zh";
  await write("app", { lastLanguage: "it" }); // saved, though the shell has not read it yet
  await onAccountChange(user);
  expect(profileReads).toBe(0);
  expect(useShell.getState().state.lastLanguage).toBeNull(); // HYDRATED will bring "it"
  expect(await read("app")).toEqual({ lastLanguage: "it" });
});

test("an empty or unknown last language on the account changes nothing", async () => {
  for (const value of [null, "fr"]) {
    lastOnServer = value;
    useShell.setState({ state: { ...initialShellState, hydrated: true } });
    await onAccountChange(user);
    expect(useShell.getState().state.lastLanguage).toBeNull();
  }
  expect(await read("app")).toBeUndefined();
});

test("choosing a language while signed in saves it to the account", async () => {
  await onAccountChange(user);
  useShell.getState().dispatch({ type: "CHOOSE", code: "zh" });
  await vi.waitFor(() =>
    expect(profileWrites).toEqual([{ row: { last_language: "zh" }, id: user }]),
  );
});

test("choosing as a guest saves it only on the device", async () => {
  useShell.getState().dispatch({ type: "CHOOSE", code: "it" });
  await vi.waitFor(async () => expect(await read("app")).toEqual({ lastLanguage: "it" }));
  expect(profileWrites).toEqual([]);
});
