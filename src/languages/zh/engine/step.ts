// Spec 4.2: the transition table. One function moves the game forward, and every
// phase and action pair not in the table is rejected with wrongPhase.
import { ask, reject } from "./ask.ts";
import { indexContent } from "./content.ts";
import { answerCpu, cpuTurn } from "./cpu.ts";
import { startGame } from "./start.ts";
import type { Action, EngineContent, GameState, Phase, StepResult } from "./types.ts";

const flippable: Phase[] = ["playerTurn", "playerReview", "cpuTurn", "cpuReview"];

export function step(state: GameState, action: Action, content: EngineContent): StepResult {
  const index = indexContent(content);
  const { phase } = state;

  switch (action.type) {
    case "START":
      if (phase !== "setup" && phase !== "over") return reject(state, "wrongPhase");
      return { state: startGame(action.seed, action.level, content), events: [] };

    case "ASK":
      if (phase !== "playerTurn") return reject(state, "wrongPhase");
      return ask(state, action.tokens, content);

    case "GUESS": {
      if (phase !== "playerTurn") return reject(state, "wrongPhase");
      if (!index.character.has(action.characterId)) return reject(state, "unknownId");
      // Spec 2: a wrong guess loses, as in the board game.
      const result = action.characterId === state.cpuSecret ? "won" : "lost";
      return {
        state: { ...state, phase: "over", result, lastFeedback: undefined },
        events: [{ type: "gameOver", result }],
      };
    }

    case "FLIP": {
      if (!flippable.includes(phase)) return reject(state, "wrongPhase");
      if (!index.character.has(action.characterId)) return reject(state, "unknownId");
      const id = action.characterId;
      const flipped = state.flipped.includes(id)
        ? state.flipped.filter((f) => f !== id)
        : [...state.flipped, id];
      return { state: { ...state, flipped }, events: [] };
    }

    case "ANSWER":
      if (phase !== "cpuTurn") return reject(state, "wrongPhase");
      if (!index.answer.has(action.answerId)) return reject(state, "unknownId");
      return answerCpu(state, action.answerId, action.hintShown, content);

    case "END_TURN":
      if (phase === "playerReview") return cpuTurn(state, content);
      if (phase === "cpuReview") {
        return {
          state: {
            ...state,
            phase: "playerTurn",
            turn: state.turn + 1,
            ratedThisTurn: [],
            lastFeedback: undefined,
          },
          events: [],
        };
      }
      return reject(state, "wrongPhase");
  }
}
