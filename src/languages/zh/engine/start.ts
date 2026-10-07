// Spec 2 and 4.1: a new round. Both secrets are drawn independently from the seed
// (they may be the same character), the CPU's question order is fixed, and the
// player goes first.
import { allQuestions } from "./questions.ts";
import { pickOne, seeded, shuffled } from "./random.ts";
import type { EngineContent, GameState, Level } from "./types.ts";

export function setupState(): GameState {
  return {
    phase: "setup",
    seed: 0,
    level: 1,
    turn: 0,
    playerSecret: "",
    cpuSecret: "",
    flipped: [],
    cpuCandidates: [],
    cpuQuestionOrder: [],
    history: [],
    ratedThisTurn: [],
  };
}

export function startGame(seed: number, level: Level, content: EngineContent): GameState {
  const random = seeded(seed);
  const ids = content.characters.map((c) => c.id);
  const cpuSecret = pickOne(random, ids);
  const playerSecret = pickOne(random, ids);
  return {
    phase: "playerTurn",
    seed,
    level,
    turn: 1,
    playerSecret,
    cpuSecret,
    flipped: [],
    cpuCandidates: ids,
    cpuQuestionOrder: shuffled(
      random,
      allQuestions(content).map((q) => q.key),
    ),
    history: [],
    ratedThisTurn: [],
  };
}
