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
const { progressStore, progressSaved } = await import("./progressStore.ts");
const useProgressStore = progressStore("it");
const { useSyncStore } = await import("../services/sync.ts");
const { read, resetForTests, write } = await import("../services/storage.ts");

const user = "00000000-0000-4000-8000-00000000000a";
const at = new Date("2026-10-19T10:00:00Z");

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  calls.length = 0;
  useProgressStore.setState({ games: [], reviewLog: [], loaded: true, owner: "guest" });
  useAccountStore.setState({ askToSave: null });
  await useSyncStore.getState().load(null);
});

async function playAsGuest() {
  const p = useProgressStore.getState();
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

// Sign in, answer the prompt, and wait for everything to settle.
async function signInAnswering(save: boolean) {
  const done = onAccountChange(user);
  await vi.waitFor(() => expect(useAccountStore.getState().askToSave).not.toBeNull());
  useAccountStore.getState().askToSave?.resolve(save);
  await done;
}

describe("guest to account (CHI-085)", () => {
  test("with guest data, signing in asks first", async () => {
    await playAsGuest();
    const done = onAccountChange(user);
    await vi.waitFor(() => expect(useAccountStore.getState().askToSave).not.toBeNull());
    expect(useProgressStore.getState().owner).toBe("guest"); // nothing switches until answered
    useAccountStore.getState().askToSave?.resolve(true);
    await done;
    expect(useAccountStore.getState().askToSave).toBeNull();
  });

  test("the prompt stays up until the answer is on disk, and only the first answer counts", async () => {
    await playAsGuest();
    const done = onAccountChange(user);
    await vi.waitFor(() => expect(useAccountStore.getState().askToSave).not.toBeNull());
    useAccountStore.getState().askToSave?.resolve(false);
    expect(useAccountStore.getState().askToSave).toMatchObject({ saving: true });
    useAccountStore.getState().askToSave?.resolve(true); // a second tap is ignored
    await done;
    expect(useAccountStore.getState().askToSave).toBeNull();
    expect(await read("guest:it")).toBeUndefined();
    expect(calls).toEqual([]);
  });

  test("Yes: the rows become the account's, upload games first then the log, and the guest copy goes", async () => {
    await playAsGuest();
    await signInAnswering(true);
    expect(useProgressStore.getState()).toMatchObject({ owner: user });
    expect(useProgressStore.getState().games.map((g) => g.id)).toEqual(["g1"]);
    expect(useProgressStore.getState().reviewLog).toHaveLength(1);
    expect(calls.map((c) => c.table)).toEqual(["games", "review_log"]);
    expect(useSyncStore.getState().outbox).toEqual([]);
    expect(await read("guest:it")).toBeUndefined();
  });

  test("No: the guest data is deleted and the account starts fresh", async () => {
    await playAsGuest();
    await signInAnswering(false);
    expect(useProgressStore.getState()).toMatchObject({ owner: user, games: [], reviewLog: [] });
    expect(calls).toEqual([]);
    expect(await read("guest:it")).toBeUndefined();
  });

  test("Yes keeps rows the account already had on this device", async () => {
    await write(`user:${user}:it`, { games: [{ id: "older", language: "it" }], reviewLog: [] });
    await playAsGuest();
    await signInAnswering(true);
    expect(useProgressStore.getState().games.map((g) => g.id)).toEqual(["older", "g1"]);
  });

  test("the account is settled once the local copy is switched, before syncing", async () => {
    useAccountStore.setState({ settled: false });
    await onAccountChange(user);
    expect(useAccountStore.getState().settled).toBe(true);
  });

  test("without guest data there is no question", async () => {
    await onAccountChange(user);
    expect(useAccountStore.getState().askToSave).toBeNull();
    expect(useProgressStore.getState().owner).toBe(user);
  });

  test("uploading twice is harmless: the outbox sends each row once per flush", async () => {
    await playAsGuest();
    await adoptGuestData(user, true);
    await useSyncStore.getState().flush();
    await useSyncStore.getState().flush();
    expect(calls.map((c) => c.table)).toEqual(["games", "review_log"]);
  });
});

// Platform spec 2 and 6.3: guest data in any language moves to the account in
// that language; sign-out clears every language.
describe("guest to account, per language", () => {
  test("Chinese guest data alone still asks, and moves to the account's zh copy", async () => {
    const zh = progressStore("zh");
    zh.setState({ games: [], reviewLog: [], loaded: true, owner: "guest" });
    zh.getState().recordGameStart({
      id: "g-zh",
      seed: 1,
      level: 1,
      contentVersion: 1,
      startedAt: at.toISOString(),
    });
    await progressSaved();
    await signInAnswering(true);
    expect(await read("guest:zh")).toBeUndefined();
    expect(
      (await read<{ games: { id: string }[] }>(`user:${user}:zh`))?.games.map((g) => g.id),
    ).toEqual(["g-zh"]);
    expect(zh.getState()).toMatchObject({ owner: user });
    expect(useProgressStore.getState()).toMatchObject({ owner: user });
  });
});
