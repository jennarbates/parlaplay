import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { read, resetForTests, write } from "../services/storage.ts";
import { rowsFor } from "../../languages/it/store/rows.ts";
import { progressSaved, useProgressStore } from "./progressStore.ts";

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  useProgressStore.setState({ games: [], reviewLog: [], loaded: false, owner: "guest" });
});

const at = new Date(2026, 9, 6, 23, 30); // 23:30 local time on 6 October

describe("the log is append-only", () => {
  test("appending never edits or removes earlier rows", () => {
    const store = useProgressStore.getState();
    store.appendRows(
      rowsFor(
        "g1",
        [{ type: "rating", lexiconId: "n.a", direction: "produce", rating: "again" }],
        at,
      ),
    );
    const first = useProgressStore.getState().reviewLog;
    store.appendRows(
      rowsFor(
        "g1",
        [{ type: "rating", lexiconId: "n.a", direction: "produce", rating: "good" }],
        at,
      ),
    );
    const second = useProgressStore.getState().reviewLog;
    expect(second.slice(0, first.length)).toEqual(first);
    expect(second).toHaveLength(2);
  });

  test("the store offers no way to edit or delete log rows", () => {
    const api = Object.keys(useProgressStore.getState()).filter(
      (k) => typeof (useProgressStore.getState() as Record<string, unknown>)[k] === "function",
    );
    // switchOwner loads another owner's data and mergeRemote only adds rows (a union
    // by id); nothing edits or deletes log rows.
    expect(api.sort()).toEqual([
      "appendRows",
      "hydrate",
      "mergeRemote",
      "recordGameEnd",
      "recordGameStart",
      "switchOwner",
    ]);
  });
});

describe("games rows (CHI-071)", () => {
  const row = {
    id: "g1",
    seed: 1,
    level: 2 as const,
    contentVersion: 1,
    startedAt: at.toISOString(),
  };

  test("written at start and closed once with ended_at and result", () => {
    const store = useProgressStore.getState();
    store.recordGameStart(row);
    store.recordGameEnd("g1", "lost", at);
    store.recordGameEnd("g1", "abandoned", at); // a second end is ignored
    expect(useProgressStore.getState().games).toEqual([
      { ...row, endedAt: at.toISOString(), result: "lost" },
    ]);
  });
});

describe("persistence", () => {
  test("stored under the key guest and loaded back", async () => {
    const store = useProgressStore.getState();
    store.recordGameStart({
      id: "g1",
      seed: 1,
      level: 1,
      contentVersion: 1,
      startedAt: at.toISOString(),
    });
    store.appendRows(
      rowsFor(
        "g1",
        [{ type: "rating", lexiconId: "n.a", direction: "recognize", rating: "hard" }],
        at,
      ),
    );
    await progressSaved();
    const saved = await read<{ games: unknown[]; reviewLog: unknown[] }>("guest");
    expect(saved?.games).toHaveLength(1);
    expect(saved?.reviewLog).toHaveLength(1);

    useProgressStore.setState({ games: [], reviewLog: [], loaded: false });
    await useProgressStore.getState().hydrate();
    expect(useProgressStore.getState()).toMatchObject({
      loaded: true,
      games: saved?.games,
      reviewLog: saved?.reviewLog,
    });
  });

  test("rows recorded before the saved data loads are kept after it", async () => {
    await write("guest", { games: [], reviewLog: [{ id: "old" }] });
    useProgressStore
      .getState()
      .appendRows(
        rowsFor(
          "g",
          [{ type: "rating", lexiconId: "n.a", direction: "produce", rating: "good" }],
          at,
        ),
      );
    await useProgressStore.getState().hydrate();
    expect(useProgressStore.getState().reviewLog.map((r) => r.id)[0]).toBe("old");
    expect(useProgressStore.getState().reviewLog).toHaveLength(2);
  });

  test("damaged guest data loads as empty instead of crashing", async () => {
    await write("guest", { games: "nope", reviewLog: 3 });
    await useProgressStore.getState().hydrate();
    expect(useProgressStore.getState()).toMatchObject({ loaded: true, games: [], reviewLog: [] });
  });
});

describe("owners", () => {
  test("loading twice never duplicates rows", async () => {
    await write("guest", { games: [{ id: "g1" }], reviewLog: [{ id: "r1" }] });
    await Promise.all([
      useProgressStore.getState().hydrate(),
      useProgressStore.getState().hydrate(),
    ]);
    expect(useProgressStore.getState().games.map((g) => g.id)).toEqual(["g1"]);
    expect(useProgressStore.getState().reviewLog.map((r) => r.id)).toEqual(["r1"]);
  });

  test("switching owner loads that owner's data, kept apart from the guest's", async () => {
    const user = "u1";
    await write("guest", { games: [{ id: "guest-game" }], reviewLog: [] });
    await write(`user:${user}`, { games: [{ id: "user-game" }], reviewLog: [] });
    await useProgressStore.getState().hydrate();
    expect(useProgressStore.getState().games.map((g) => g.id)).toEqual(["guest-game"]);
    await useProgressStore.getState().switchOwner(user);
    expect(useProgressStore.getState()).toMatchObject({ owner: user, loaded: true });
    expect(useProgressStore.getState().games.map((g) => g.id)).toEqual(["user-game"]);
    // New rows go to that owner's key.
    useProgressStore.getState().recordGameStart({
      id: "g2",
      seed: 1,
      level: 1,
      contentVersion: 1,
      startedAt: at.toISOString(),
    });
    await progressSaved();
    expect(
      (await read<{ games: { id: string }[] }>(`user:${user}`))?.games.map((g) => g.id),
    ).toEqual(["user-game", "g2"]);
    expect((await read<{ games: { id: string }[] }>("guest"))?.games.map((g) => g.id)).toEqual([
      "guest-game",
    ]);
  });

  test("switching to the owner you already are does nothing", async () => {
    useProgressStore
      .getState()
      .appendRows(
        rowsFor(
          "g",
          [{ type: "rating", lexiconId: "n.a", direction: "produce", rating: "good" }],
          at,
        ),
      );
    await useProgressStore.getState().switchOwner("guest");
    expect(useProgressStore.getState().reviewLog).toHaveLength(1);
  });
});
