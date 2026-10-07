// Spec 4.2 and 10.2: every cell of the transition table.
import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import { setupState, startGame } from "./start.ts";
import { step } from "./step.ts";
import type { Action, GameState, Phase } from "./types.ts";

const ids = content.characters.map((c) => c.id);
const [a = "", b = ""] = ids;

function inPhase(phase: Phase): GameState {
  const s = { ...startGame(11, 2, content), cpuSecret: a, playerSecret: b };
  if (phase === "setup") return setupState();
  if (phase === "cpuTurn")
    return { ...s, phase, pendingCpuQuestion: { key: "v.you|n.gou", pron: "pr.ta.m" } };
  if (phase === "over") return { ...s, phase, result: "won" };
  return { ...s, phase };
}

const actions: Record<Action["type"], Action> = {
  START: { type: "START", seed: 5, level: 1 },
  ASK: { type: "ASK", tokens: ["pr.ta.m", "v.you", "n.gou", "pt.ma"] },
  GUESS: { type: "GUESS", characterId: a },
  FLIP: { type: "FLIP", characterId: a },
  ANSWER: { type: "ANSWER", answerId: "a.you", hintShown: false },
  END_TURN: { type: "END_TURN" },
};

// R = rejected with wrongPhase; anything else is the phase reached.
const table: Record<Phase, Record<Action["type"], Phase | "R">> = {
  setup: { START: "playerTurn", ASK: "R", GUESS: "R", FLIP: "R", ANSWER: "R", END_TURN: "R" },
  playerTurn: {
    START: "R",
    ASK: "playerReview",
    GUESS: "over",
    FLIP: "playerTurn",
    ANSWER: "R",
    END_TURN: "R",
  },
  playerReview: {
    START: "R",
    ASK: "R",
    GUESS: "R",
    FLIP: "playerReview",
    ANSWER: "R",
    END_TURN: "cpuTurn",
  },
  cpuTurn: {
    START: "R",
    ASK: "R",
    GUESS: "R",
    FLIP: "cpuTurn",
    ANSWER: "cpuReview",
    END_TURN: "R",
  },
  cpuReview: {
    START: "R",
    ASK: "R",
    GUESS: "R",
    FLIP: "cpuReview",
    ANSWER: "R",
    END_TURN: "playerTurn",
  },
  over: { START: "playerTurn", ASK: "R", GUESS: "R", FLIP: "R", ANSWER: "R", END_TURN: "R" },
};

describe.each(Object.entries(table))("from %s", (phase, row) => {
  test.each(Object.entries(row))("%s → %s", (type, to) => {
    const s = inPhase(phase as Phase);
    const { state, events } = step(s, actions[type as Action["type"]], content);
    if (to === "R") {
      expect(events).toEqual([{ type: "rejected", reason: "wrongPhase" }]);
      expect(state).toEqual(s);
    } else {
      expect(state.phase).toBe(to);
    }
  });
});

describe("START", () => {
  test("from over starts a new game at the chosen level", () => {
    const { state, events } = step(inPhase("over"), actions.START, content);
    expect(state).toEqual(startGame(5, 1, content));
    expect(events).toEqual([]);
  });
});

describe("GUESS", () => {
  test("right guess wins", () => {
    const { state, events } = step(
      inPhase("playerTurn"),
      { type: "GUESS", characterId: a },
      content,
    );
    expect(state).toMatchObject({ phase: "over", result: "won" });
    expect(events).toEqual([{ type: "gameOver", result: "won" }]);
  });

  test("wrong guess loses (the official rule)", () => {
    const { state, events } = step(
      inPhase("playerTurn"),
      { type: "GUESS", characterId: b },
      content,
    );
    expect(state).toMatchObject({ phase: "over", result: "lost" });
    expect(events).toEqual([{ type: "gameOver", result: "lost" }]);
  });

  test("a flipped card can still be guessed", () => {
    const s = { ...inPhase("playerTurn"), flipped: [a] };
    expect(step(s, { type: "GUESS", characterId: a }, content).state.result).toBe("won");
  });

  test("unknown character", () => {
    const s = inPhase("playerTurn");
    expect(step(s, { type: "GUESS", characterId: "c.nobody" }, content).events).toEqual([
      { type: "rejected", reason: "unknownId" },
    ]);
  });
});

describe("FLIP", () => {
  test("toggles, and never ends a turn", () => {
    const s = inPhase("cpuReview");
    const once = step(s, { type: "FLIP", characterId: a }, content).state;
    expect(once.flipped).toEqual([a]);
    expect(once.phase).toBe("cpuReview");
    expect(step(once, { type: "FLIP", characterId: a }, content).state.flipped).toEqual([]);
  });

  test("all 24 down is allowed", () => {
    let s = inPhase("playerTurn");
    for (const id of ids) s = step(s, { type: "FLIP", characterId: id }, content).state;
    expect(s.flipped).toHaveLength(24);
    expect(s.phase).toBe("playerTurn");
  });

  test("unknown character", () => {
    expect(
      step(inPhase("playerTurn"), { type: "FLIP", characterId: "c.x" }, content).events,
    ).toEqual([{ type: "rejected", reason: "unknownId" }]);
  });
});

describe("END_TURN", () => {
  test("from cpuReview: next turn, ratings cleared (invariant 9)", () => {
    const s = {
      ...inPhase("cpuReview"),
      turn: 3,
      ratedThisTurn: ["n.gou|recognize"],
      lastFeedback: [],
    };
    const { state } = step(s, actions.END_TURN, content);
    expect(state).toMatchObject({ phase: "playerTurn", turn: 4, ratedThisTurn: [] });
    expect(state.lastFeedback).toBeUndefined();
  });

  test("from playerReview with one candidate left: the CPU guesses right and the player loses", () => {
    const s = { ...inPhase("playerReview"), cpuCandidates: [b] };
    const { state, events } = step(s, actions.END_TURN, content);
    expect(state).toMatchObject({ phase: "over", result: "lost" });
    expect(events).toEqual([{ type: "gameOver", result: "lost" }]);
  });

  test("from playerReview otherwise: the CPU asks", () => {
    const { state } = step(inPhase("playerReview"), actions.END_TURN, content);
    expect(state.pendingCpuQuestion?.key).toMatch(/^v\.(shi|you|zai)\|n\./);
    expect(["pr.ta.m", "pr.ta.f"]).toContain(state.pendingCpuQuestion?.pron);
  });
});
