// Spec 4.1: compile-time checks that the types accept the spec's own examples
// and reject what they should. If these stop compiling, `pnpm typecheck` fails.
import { expect, expectTypeOf, test } from "vitest";
import type {
  Action,
  AskedQuestion,
  Fill,
  GameEvent,
  GameState,
  Phase,
  Rating,
  SlotError,
} from "./types.ts";

test("the 4.5 traced turn fits the types", () => {
  const fill: Fill = { verb: "v.ha", art: "art.i", noun: "n.capelli", adj: "adj.biondo#mp" };
  const ask: Action = { type: "ASK", templateId: "t.have.adj", fill };
  const asked: AskedQuestion = {
    by: "player",
    key: "t.have.adj|n.capelli|adj.biondo",
    text: "Ha i capelli biondi?",
    answer: false,
    answerText: "No, non ha i capelli biondi.",
  };
  const state: GameState = {
    phase: "playerReview",
    seed: 1,
    level: 2,
    turn: 1,
    playerSecret: "c.marco",
    cpuSecret: "c.giulia",
    flipped: [],
    cpuCandidates: ["c.marco"],
    cpuQuestionOrder: [],
    history: [asked],
    ratedThisTurn: ["n.capelli|produce", "adj.biondo|produce"],
  };
  const error: SlotError = { slot: "art", given: "gli", expected: "i", rule: "art.mpl.consonant" };
  const events: GameEvent[] = [
    { type: "asked", by: "player", key: asked.key, answer: false },
    { type: "rating", lexiconId: "n.capelli", direction: "produce", rating: "good" },
    { type: "rejected", reason: "grammar", errors: [error] },
    { type: "agreementSlip", lexiconId: "adj.biondo", given: "bionde", expected: "biondi" },
    { type: "gameOver", result: "won" },
  ];
  expect([ask, state, events]).toBeDefined();
});

test("phases, actions and levels are closed sets", () => {
  expectTypeOf<Phase>().toEqualTypeOf<
    "setup" | "playerTurn" | "playerReview" | "cpuTurn" | "cpuReview" | "over"
  >();
  expectTypeOf<Action["type"]>().toEqualTypeOf<
    "START" | "ASK" | "GUESS" | "FLIP" | "ANSWER" | "END_TURN"
  >();
  expectTypeOf<GameState["level"]>().toEqualTypeOf<1 | 2>();
  // "easy" is never produced by the game (spec 6).
  expectTypeOf<Extract<Rating, "easy">>().toBeNever();
});
