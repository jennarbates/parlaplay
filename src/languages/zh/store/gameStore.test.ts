import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { contentVersion } from "../content/index.ts";
import { allQuestions, questionTokens } from "../engine/index.ts";
import { read, resetForTests, write } from "../../../core/services/storage.ts";
import { randomSeed, savesSettled, useGameStore, type SavedRound } from "./gameStore.ts";
import { progressSaved, useProgressStore } from "../../../core/store/progressStore.ts";

const q = allQuestions((await import("../content/index.ts")).content)[0];
if (!q) throw new Error("no questions");
const ask = { type: "ASK" as const, tokens: questionTokens(q, "pr.ta.m") };

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  useGameStore.setState({ status: "loading", game: null, gameId: null, lastEvents: [] });
  useProgressStore.setState({ games: [], reviewLog: [], loaded: false, owner: "guest" });
});

const withId = (state: unknown) => ({
  contentVersion,
  gameId: useGameStore.getState().gameId,
  state,
});

async function saved() {
  await savesSettled();
  return read<SavedRound>("round");
}

describe("start and dispatch", () => {
  test("start begins a round at the chosen level and saves it", async () => {
    useGameStore.getState().start(2, 123);
    const { game } = useGameStore.getState();
    expect(game).toMatchObject({ phase: "playerTurn", level: 2, seed: 123 });
    expect(await saved()).toEqual(withId(game));
  });

  test("state is saved after every action", async () => {
    const store = useGameStore.getState();
    store.start(1, 5);
    for (const action of [
      ask,
      { type: "FLIP" as const, characterId: "c.lili" },
      { type: "END_TURN" as const },
    ]) {
      store.dispatch(action);
      expect(await saved()).toEqual(withId(useGameStore.getState().game));
    }
  });

  test("dispatch returns the engine's events and keeps them as lastEvents", () => {
    useGameStore.getState().start(1, 5);
    const events = useGameStore.getState().dispatch(ask);
    expect(events[0]).toMatchObject({ type: "asked", by: "player" });
    expect(useGameStore.getState().lastEvents).toBe(events);
  });

  test("a finished round is not kept as a saved round", async () => {
    const store = useGameStore.getState();
    store.start(1, 5);
    const cpuSecret = useGameStore.getState().game?.cpuSecret ?? "";
    store.dispatch({ type: "GUESS", characterId: cpuSecret });
    expect(useGameStore.getState().game?.result).toBe("won");
    expect(await saved()).toBeUndefined();
  });

  test("start after a finished round begins a fresh one", () => {
    const store = useGameStore.getState();
    store.start(1, 5);
    store.dispatch({ type: "GUESS", characterId: "c.lili" });
    store.start(2, 6);
    expect(useGameStore.getState().game).toMatchObject({
      phase: "playerTurn",
      seed: 6,
      history: [],
    });
  });

  test("dispatch with no round does nothing", () => {
    expect(useGameStore.getState().dispatch(ask)).toEqual([]);
    expect(useGameStore.getState().game).toBeNull();
  });

  test("quit forgets the round and its save", async () => {
    useGameStore.getState().start(1, 5);
    useGameStore.getState().quit();
    expect(useGameStore.getState().game).toBeNull();
    expect(await saved()).toBeUndefined();
  });

  test("randomSeed gives 32-bit seeds", () => {
    const seeds = Array.from({ length: 50 }, randomSeed);
    for (const s of seeds) expect(Number.isInteger(s) && s >= 0 && s < 2 ** 32).toBe(true);
    expect(new Set(seeds).size).toBeGreaterThan(45);
  });
});

describe("hydrate", () => {
  test("a reload mid-round resumes exactly where it was", async () => {
    const store = useGameStore.getState();
    store.start(2, 77);
    store.dispatch(ask);
    store.dispatch({ type: "FLIP", characterId: "c.marco" });
    const before = useGameStore.getState().game;
    await savesSettled();

    // A reload: fresh store state, fresh database connection.
    useGameStore.setState({ status: "loading", game: null, gameId: null, lastEvents: [] });
    resetForTests();
    await useGameStore.getState().hydrate();
    expect(useGameStore.getState()).toMatchObject({ status: "ready", game: before });

    // And play carries on from there.
    useGameStore.getState().dispatch({ type: "END_TURN" });
    expect(useGameStore.getState().game?.phase).toBe("cpuTurn");
  });

  test("with nothing saved, ready with no round", async () => {
    await useGameStore.getState().hydrate();
    expect(useGameStore.getState()).toMatchObject({ status: "ready", game: null });
  });

  test("a saved round with an older contentVersion is discarded, not resumed", async () => {
    useGameStore.getState().start(1, 5);
    const state = useGameStore.getState().game;
    await savesSettled();
    await write("round", { contentVersion: contentVersion - 1, gameId: "g", state });
    useGameStore.setState({ status: "loading", game: null });
    await useGameStore.getState().hydrate();
    expect(useGameStore.getState().game).toBeNull();
    expect(await read("round")).toBeUndefined();
  });

  test.each([
    ["nothing useful", { contentVersion }],
    ["an unknown secret", "unknown"],
    ["a finished round", "over"],
    ["missing history", "noHistory"],
    ["no game id", "noGameId"],
  ])("a damaged save (%s) is discarded", async (_, kind) => {
    useGameStore.getState().start(1, 5);
    const state = useGameStore.getState().game;
    await savesSettled();
    const damaged =
      kind === "unknown"
        ? { contentVersion, gameId: "g", state: { ...state, cpuSecret: "c.nobody" } }
        : kind === "over"
          ? { contentVersion, gameId: "g", state: { ...state, phase: "over" } }
          : kind === "noHistory"
            ? { contentVersion, gameId: "g", state: { ...state, history: undefined } }
            : kind === "noGameId"
              ? { contentVersion, state }
              : kind;
    await write("round", damaged);
    useGameStore.setState({ status: "loading", game: null });
    await useGameStore.getState().hydrate();
    expect(useGameStore.getState().game).toBeNull();
    expect(await read("round")).toBeUndefined();
  });

  test("broken storage still gets the app to ready", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new Error("nope");
      },
    });
    resetForTests();
    await useGameStore.getState().hydrate();
    expect(useGameStore.getState().status).toBe("ready");
    useGameStore.getState().start(1, 5);
    expect(useGameStore.getState().game?.phase).toBe("playerTurn");
  });
});

describe("games rows and the review log (CHI-070, CHI-071)", () => {
  const games = () => useProgressStore.getState().games;
  const log = () => useProgressStore.getState().reviewLog;

  test("START writes a games row before anything points at it", () => {
    useGameStore.getState().start(2, 99);
    const { gameId } = useGameStore.getState();
    expect(games()).toEqual([
      {
        id: gameId,
        seed: 99,
        level: 2,
        contentVersion,
        startedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
      },
    ]);
  });

  test("ratings and slips from play are appended to the log with the game's id", () => {
    useGameStore.getState().start(2, 99);
    const { gameId } = useGameStore.getState();
    useGameStore.getState().dispatch({ type: "ASK", tokens: ["pr.ni", "v.you", "n.gou", "pt.ma"] });
    useGameStore
      .getState()
      .dispatch({ type: "ASK", tokens: ["pr.ta.m", "v.you", "n.gou", "pt.ma"] });
    expect(log()).toEqual([
      expect.objectContaining({
        gameId,
        lexiconId: "gp.pron.you",
        direction: "produce",
        rating: "slip",
        detail: { slot: "pron", given: "你", expected: "他 / 她", rule: "gp.pron.you" },
      }),
      expect.objectContaining({
        gameId,
        lexiconId: "n.gou",
        direction: "produce",
        rating: "good",
      }),
    ]);
  });

  test("the end of a round updates its row with ended_at and the result", () => {
    useGameStore.getState().start(1, 5);
    const { game, gameId } = useGameStore.getState();
    useGameStore.getState().dispatch({ type: "GUESS", characterId: game?.cpuSecret ?? "" });
    expect(games().find((g) => g.id === gameId)).toMatchObject({
      result: "won",
      endedAt: expect.any(String),
    });
  });

  test("quitting records abandoned and keeps the ratings already logged", () => {
    useGameStore.getState().start(2, 99);
    const { gameId } = useGameStore.getState();
    useGameStore.getState().dispatch({
      type: "ASK",
      tokens: ["pr.ta.m", "v.shi", "n.gou", "pt.ma"],
    });
    const logged = log();
    expect(logged).toHaveLength(1);
    useGameStore.getState().quit();
    expect(games().find((g) => g.id === gameId)).toMatchObject({ result: "abandoned" });
    expect(log()).toEqual(logged);
  });

  test("starting a new round over an unfinished one records the old one abandoned", () => {
    useGameStore.getState().start(1, 5);
    const first = useGameStore.getState().gameId;
    useGameStore.getState().start(1, 6);
    expect(games().find((g) => g.id === first)?.result).toBe("abandoned");
    expect(games().find((g) => g.id === useGameStore.getState().gameId)?.result).toBeUndefined();
  });

  test("a finished round is not marked abandoned by the next start", () => {
    useGameStore.getState().start(1, 5);
    const first = useGameStore.getState().gameId;
    useGameStore.getState().dispatch({ type: "GUESS", characterId: "c.lili" });
    const result = games().find((g) => g.id === first)?.result;
    useGameStore.getState().start(1, 6);
    expect(games().find((g) => g.id === first)?.result).toBe(result);
  });

  test("everything survives a reload", async () => {
    useGameStore.getState().start(2, 99);
    useGameStore.getState().dispatch({
      type: "ASK",
      tokens: ["pr.ta.m", "v.you", "n.gou", "pt.ma"],
    });
    const before = { games: games(), reviewLog: log() };
    await progressSaved();
    useProgressStore.setState({ games: [], reviewLog: [], loaded: false });
    resetForTests();
    await useProgressStore.getState().hydrate();
    expect({ games: games(), reviewLog: log() }).toEqual(before);
  });
});
