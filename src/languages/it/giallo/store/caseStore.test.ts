// Chi è stato? GS 2: the case in play, saved and resumed, and its games row.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { read, remove, resetForTests, write } from "../../../../core/services/storage.ts";
import { progressSaved } from "../../../../core/store/progressStore.ts";
import { resetMoveForTests, useRounds } from "../../../../core/store/rounds.ts";
import { useProgressStore } from "../../stores.ts";
import version from "../content/version.json" with { type: "json" };
import { resultOf, savesSettled, solvedCases, useCaseStore } from "./caseStore.ts";
import { isResumable, type SavedCase } from "./resumable.ts";
import type { CaseState } from "../engine/types.ts";

const key = "round:it:giallo";
const { contentVersion } = version;
const witnessWhen = { to: "r.witness", frame: "f.stolen.torta", qword: "q.quando", form: "quando" };

beforeEach(async () => {
  // The store hydrates once when loaded; let that land before each test's fresh start.
  await savesSettled();
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  resetMoveForTests();
  useCaseStore.setState({ status: "ready", game: null, gameId: null, lastEvents: [] });
  useProgressStore.setState({ games: [], reviewLog: [], loaded: true, owner: "guest" });
  useRounds.getState().setSaved("giallo", false);
});

async function saved() {
  await savesSettled();
  return read<SavedCase>(key);
}

const row = () => useProgressStore.getState().games[0];

describe("start", () => {
  test("starts the case at the level, saves it, and writes a giallo games row", async () => {
    useCaseStore.getState().start("case.torta", 2, 123);
    const { game, gameId } = useCaseStore.getState();
    expect(game).toMatchObject({ caseId: "case.torta", level: 2, seed: 123, phase: "asking" });
    expect(await saved()).toEqual({ contentVersion, gameId, state: game });
    expect(row()).toMatchObject({
      id: gameId,
      language: "it",
      game: "giallo",
      caseId: "case.torta",
      seed: 123,
      level: 2,
      contentVersion,
    });
    expect(useRounds.getState().saved.giallo).toBe(true);
  });

  test("starting over a saved case records that one as abandoned", () => {
    const store = useCaseStore.getState();
    store.start("case.torta", 1, 1);
    const first = useCaseStore.getState().gameId;
    store.start("case.torta", 1, 2);
    const games = useProgressStore.getState().games;
    expect(games.find((g) => g.id === first)?.result).toBe("abandoned");
    expect(games).toHaveLength(2);
    expect(games.at(-1)?.result).toBeUndefined();
  });
});

describe("dispatch", () => {
  test("saves after each action, and its rows point at the games row", async () => {
    const store = useCaseStore.getState();
    store.start("case.torta", 2, 5);
    store.dispatch({ type: "ASK", built: witnessWhen });
    const { game, gameId } = useCaseStore.getState();
    expect(game?.budget).toBe(14);
    expect((await saved())?.state).toEqual(game);
    expect(useProgressStore.getState().reviewLog).toMatchObject([
      { gameId, language: "it", lexiconId: "q.quando", direction: "produce", rating: "good" },
    ]);
  });

  test("a wrong accusation closes the row as lost and forgets the save", async () => {
    const store = useCaseStore.getState();
    store.start("case.torta", 2, 5);
    const { game } = useCaseStore.getState();
    const room = ((game?.hide ?? 0) + 1) % 3;
    store.dispatch({ type: "ACCUSE", role: "r.culprit", room, slot: game?.crime ?? 0 });
    expect(useCaseStore.getState().game?.phase).toBe("ended");
    expect(row()?.result).toBe("lost");
    expect(await saved()).toBeUndefined();
    expect(useRounds.getState().saved.giallo).toBe(false);
  });

  test("the right accusation closes it as won, which the case list reads as solved", () => {
    const store = useCaseStore.getState();
    store.start("case.torta", 2, 5);
    const { game } = useCaseStore.getState();
    store.dispatch({
      type: "ACCUSE",
      role: "r.culprit",
      room: game?.hide ?? 0,
      slot: game?.crime ?? 0,
    });
    expect(row()?.result).toBe("won");
    expect(solvedCases(useProgressStore.getState().games)).toEqual(new Set(["case.torta"]));
  });
});

describe("quit", () => {
  test("records abandoned, keeps the log, and forgets the case", async () => {
    const store = useCaseStore.getState();
    store.start("case.torta", 2, 5);
    store.dispatch({ type: "ASK", built: witnessWhen });
    useCaseStore.getState().quit();
    expect(useCaseStore.getState().game).toBeNull();
    expect(row()?.result).toBe("abandoned");
    expect(useProgressStore.getState().reviewLog).toHaveLength(1);
    expect(await saved()).toBeUndefined();
    expect(useRounds.getState().saved.giallo).toBe(false);
    await progressSaved();
  });
});

describe("reload", () => {
  test("a saved case resumes where it was", async () => {
    const store = useCaseStore.getState();
    store.start("case.torta", 2, 5);
    store.dispatch({ type: "ASK", built: witnessWhen });
    const { game, gameId } = useCaseStore.getState();
    await savesSettled();
    useCaseStore.setState({ status: "loading", game: null, gameId: null });
    await useCaseStore.getState().hydrate();
    expect(useCaseStore.getState()).toMatchObject({ status: "ready", game, gameId });
    expect(useRounds.getState().saved.giallo).toBe(true);
  });

  test("an older content version is discarded and its row closed as abandoned", async () => {
    useProgressStore.getState().recordGameStart({
      id: "g1",
      game: "giallo",
      caseId: "case.torta",
      seed: 1,
      level: 1,
      contentVersion: contentVersion - 1,
      startedAt: new Date().toISOString(),
    });
    await write(key, { contentVersion: contentVersion - 1, gameId: "g1", state: {} });
    await useCaseStore.getState().hydrate();
    expect(useCaseStore.getState()).toMatchObject({ status: "ready", game: null });
    expect(row()?.result).toBe("abandoned");
    expect(await read(key)).toBeUndefined();
  });

  test("with nothing saved, there is no case", async () => {
    await remove(key);
    await useCaseStore.getState().hydrate();
    expect(useCaseStore.getState()).toMatchObject({ status: "ready", game: null, gameId: null });
  });
});

test("the shell's sign-out hook forgets the case in memory", () => {
  useCaseStore.getState().start("case.torta", 1, 1);
  useRounds.getState().hooks.giallo?.clearRound();
  expect(useCaseStore.getState().game).toBeNull();
});

test("resultOf maps a case's result to the games row's", () => {
  expect(resultOf({ solved: true, stars: 3 })).toBe("won");
  expect(resultOf({ solved: false })).toBe("lost");
  expect(resultOf({ solved: false, abandoned: true })).toBe("abandoned");
});

describe("isResumable", () => {
  const state = (over: Partial<CaseState> = {}) => ({
    caseId: "case.torta",
    phase: "asking",
    budget: 15,
    cast: {},
    notebook: [],
    cleared: [],
    ratedThisTurn: [],
    ...over,
  });
  test.each([
    [null],
    [42],
    [{}],
    [{ contentVersion, gameId: "g", state: {} }],
    [{ contentVersion: contentVersion + 1, gameId: "g", state: state() }],
    [{ contentVersion, state: state() }],
    [{ contentVersion, gameId: "g", state: state({ phase: "ended" }) }],
  ])("refuses %j", (value) => {
    expect(isResumable(value)).toBe(false);
  });
  test("accepts a case still being played, in either phase", () => {
    for (const phase of ["asking", "inspector"] as const)
      expect(isResumable({ contentVersion, gameId: "g", state: state({ phase }) })).toBe(true);
  });
});
