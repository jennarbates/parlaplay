import "fake-indexeddb/auto";
import { rowsFor } from "../../languages/it/store/rows.ts";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, test, vi } from "vitest";

// A fake Supabase that records uploads, so the guest upload can be checked end to
// end through the real outbox. The real server is covered by CI's sync tests.
const calls: { table: string; ids: string[] }[] = [];
vi.mock("../services/supabase.ts", () => ({
  supabase: {
    from: (table: string) => ({
      upsert: async (rows: { id: string }[]) => {
        calls.push({ table, ids: rows.map((r) => r.id) });
        return { error: null };
      },
    }),
  },
}));
const { onAccountChange, useAccountStore, adoptGuestData } = await import("./account.ts");
const { useShell } = await import("./shell.ts");
const { initialShellState } = await import("../state/reduce.ts");
const { savePromptTitle } = await import("../ui/languageList.ts");
const { progressStore, progressSaved } = await import("./progressStore.ts");
const it = progressStore("it");
const zh = progressStore("zh");
const { useSyncStore } = await import("../services/sync.ts");
const { read, resetForTests, write } = await import("../services/storage.ts");

const user = "00000000-0000-4000-8000-00000000000a";
const at = new Date("2026-10-19T10:00:00Z");

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  calls.length = 0;
  for (const p of [it, zh]) p.setState({ games: [], reviewLog: [], loaded: true, owner: "guest" });
  useShell.setState({ state: { ...initialShellState, hydrated: true }, saving: null });
  await useSyncStore.getState().load(null);
});

async function playItalian() {
  const p = it.getState();
  p.recordGameStart({
    id: "g1",
    seed: 1,
    level: 2,
    contentVersion: 1,
    startedAt: at.toISOString(),
  });
  p.appendRows(
    rowsFor(
      "g1",
      [{ type: "rating", lexiconId: "n.barba", direction: "produce", rating: "again" }],
      at,
    ),
  );
  p.recordGameEnd("g1", "lost", at);
  await progressSaved();
}

async function playChinese() {
  const p = zh.getState();
  p.recordGameStart({
    id: "g-zh",
    seed: 1,
    level: 1,
    contentVersion: 1,
    startedAt: at.toISOString(),
  });
  p.appendRows([
    {
      id: "r-zh",
      gameId: "g-zh",
      lexiconId: "n.gou",
      direction: "recognize",
      rating: "good",
      localDay: "2026-10-19",
      createdAt: at.toISOString(),
    },
  ]);
  await progressSaved();
}

const prompt = () => useShell.getState().state.prompt;

// Sign in and wait for the save-guest prompt. The sign-in itself is wrapped, so
// awaiting this does not wait for it to finish.
async function signInUntilAsked() {
  const signIn = { done: onAccountChange(user) };
  await vi.waitFor(() => expect(prompt()?.kind).toBe("saveGuest"));
  return signIn;
}

// Sign in, answer the prompt, and wait for everything to settle.
async function signInAnswering(answer: "yes" | "no") {
  const { done } = await signInUntilAsked();
  useShell.getState().dispatch({ type: "SAVE_GUEST", answer });
  await done;
}

describe("guest to account (CHI-085)", () => {
  test("with guest data, signing in asks first", async () => {
    await playItalian();
    const { done } = await signInUntilAsked();
    expect(it.getState().owner).toBe("guest"); // nothing switches until answered
    useShell.getState().dispatch({ type: "SAVE_GUEST", answer: "yes" });
    await done;
    expect(prompt()).toBeNull();
    expect(it.getState().owner).toBe(user);
  });

  test("the prompt stays up, busy, until the answer is on disk; only the first answer counts", async () => {
    await playItalian();
    const { done } = await signInUntilAsked();
    useShell.getState().dispatch({ type: "SAVE_GUEST", answer: "no" });
    expect(useShell.getState().saving).toEqual(["it"]); // set with the answer, no flicker
    useShell.getState().dispatch({ type: "SAVE_GUEST", answer: "yes" }); // a second tap is ignored
    await done;
    await vi.waitFor(() => expect(useShell.getState().saving).toBeNull());
    expect(await read("guest:it")).toBeUndefined();
    expect(calls).toEqual([]);
  });

  test("Save: the rows become the account's, upload games first then the log, and the guest copy goes", async () => {
    await playItalian();
    await signInAnswering("yes");
    expect(it.getState()).toMatchObject({ owner: user });
    expect(it.getState().games.map((g) => g.id)).toEqual(["g1"]);
    expect(it.getState().reviewLog).toHaveLength(1);
    expect(calls.map((c) => c.table)).toEqual(["games", "review_log"]);
    expect(useSyncStore.getState().outbox).toEqual([]);
    expect(await read("guest:it")).toBeUndefined();
  });

  test("Don't save: the guest data is deleted and the account starts fresh", async () => {
    await playItalian();
    await signInAnswering("no");
    expect(it.getState()).toMatchObject({ owner: user, games: [], reviewLog: [] });
    expect(calls).toEqual([]);
    expect(await read("guest:it")).toBeUndefined();
  });

  test("Save keeps rows the account already had on this device", async () => {
    await write(`user:${user}:it`, { games: [{ id: "older", language: "it" }], reviewLog: [] });
    await playItalian();
    await signInAnswering("yes");
    expect(it.getState().games.map((g) => g.id)).toEqual(["older", "g1"]);
  });

  test("the account is settled once the local copy is switched, before syncing", async () => {
    useAccountStore.setState({ settled: false });
    await onAccountChange(user);
    expect(useAccountStore.getState().settled).toBe(true);
  });

  test("without guest data there is no question", async () => {
    await onAccountChange(user);
    expect(prompt()).toBeNull();
    expect(useShell.getState().state.account).toEqual({ kind: "signedIn", userId: user });
    expect(it.getState().owner).toBe(user);
  });

  test("uploading twice is harmless: the outbox sends each row once per flush", async () => {
    await playItalian();
    await adoptGuestData(user, ["it"], true);
    await useSyncStore.getState().flush();
    await useSyncStore.getState().flush();
    expect(calls.map((c) => c.table)).toEqual(["games", "review_log"]);
  });
});

// PLAY-025, platform spec 2, 6.3, D15: one prompt for every language with guest data.
describe("one save-guest prompt for every language", () => {
  test("guest data in both: one prompt naming Italian and Chinese, in registry order", async () => {
    await playChinese(); // played first, still named second
    await playItalian();
    const { done } = await signInUntilAsked();
    expect(prompt()).toEqual({ kind: "saveGuest", languages: ["it", "zh"] });
    expect(savePromptTitle(["it", "zh"])).toBe(
      "Save your Italian and Chinese progress to this account?",
    );
    useShell.getState().dispatch({ type: "SAVE_GUEST", answer: "yes" });
    await done;
  });

  test("guest data in one: the prompt names only that language", async () => {
    await playChinese();
    const { done } = await signInUntilAsked();
    expect(prompt()).toEqual({ kind: "saveGuest", languages: ["zh"] });
    expect(savePromptTitle(["zh"])).toBe("Save your Chinese progress to this account?");
    expect(savePromptTitle(["it"])).toBe("Save your Italian progress to this account?");
    useShell.getState().dispatch({ type: "SAVE_GUEST", answer: "no" });
    await done;
  });

  test("Save uploads both: every language's games before any log row", async () => {
    await playItalian();
    await playChinese();
    await signInAnswering("yes");
    expect(calls).toEqual([
      { table: "games", ids: ["g1", "g-zh"] },
      { table: "review_log", ids: [expect.any(String), "r-zh"] },
    ]);
    for (const code of ["it", "zh"]) expect(await read(`guest:${code}`)).toBeUndefined();
    expect(
      (await read<{ games: { id: string }[] }>(`user:${user}:zh`))?.games.map((g) => g.id),
    ).toEqual(["g-zh"]);
    expect(zh.getState()).toMatchObject({ owner: user });
    expect(it.getState()).toMatchObject({ owner: user });
  });

  test("Don't save deletes both, and their saved rounds (F4)", async () => {
    await playItalian();
    await playChinese();
    await write("round:it", { contentVersion: 1, gameId: "g1", state: {} });
    await write("round:zh", { contentVersion: 1, gameId: "g-zh", state: {} });
    await signInAnswering("no");
    expect(calls).toEqual([]);
    for (const code of ["it", "zh"]) {
      expect(await read(`guest:${code}`)).toBeUndefined();
      expect(await read(`round:${code}`)).toBeUndefined();
    }
    expect(zh.getState()).toMatchObject({ owner: user, games: [], reviewLog: [] });
  });

  test("Save keeps the saved rounds: their games rows go to the account", async () => {
    await playItalian();
    await write("round:it", { contentVersion: 1, gameId: "g1", state: {} });
    await signInAnswering("yes");
    expect(await read("round:it")).toMatchObject({ gameId: "g1" });
  });

  test("a session that ends before the answer closes the prompt and keeps the guest data", async () => {
    await playItalian();
    const { done } = await signInUntilAsked();
    await onAccountChange(null);
    await done;
    expect(prompt()).toBeNull();
    expect(useShell.getState().state.account).toEqual({ kind: "guest" });
    expect(it.getState().owner).toBe("guest");
    expect(await read("guest:it")).toMatchObject({ games: [{ id: "g1" }] });
  });
});
