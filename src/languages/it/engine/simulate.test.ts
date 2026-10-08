// CHI-047: the CPU always splits, never guesses wrong, is deterministic, and
// finds the player's character in about log2(24) questions.
import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import { indexContent } from "./content.ts";
import { chooseCpuMove } from "./cpu.ts";
import { evaluate } from "./meaning.ts";
import { allQuestions, questionByKey } from "./questions.ts";
import { simulate, simulateGame } from "./simulate.ts";
import { startGame } from "./start.ts";
import { step } from "./step.ts";
import type { GameState } from "./types.ts";

const index = indexContent(content);
const attrsOf = (id: string) => {
  const c = index.character.get(id);
  if (!c) throw new Error(id);
  return c.attrs;
};

// Every CPU decision of a passive game: the state just before END_TURN from playerReview.
function cpuDecisions(seed: number): GameState[] {
  const questions = allQuestions(content);
  let s = startGame(seed, 2, content);
  const decisions: GameState[] = [];
  let i = 0;
  while (s.phase !== "over") {
    if (s.phase === "playerTurn") {
      const q = questions[i++ % questions.length];
      if (!q) throw new Error("no questions");
      // The CPU wins long before the player runs out of questions.
      s = step(s, { type: "ASK", templateId: q.templateId, fill: q.fill }, content).state;
    } else if (s.phase === "playerReview") {
      decisions.push(s);
      s = step(s, { type: "END_TURN" }, content).state;
    } else if (s.phase === "cpuTurn") {
      s = step(s, { type: "ANSWER", value: seed % 2 === 0, hintShown: false }, content).state; // half the games answer wrongly at times
    } else {
      s = step(s, { type: "END_TURN" }, content).state;
    }
  }
  return decisions;
}

const seeds = Array.from({ length: 300 }, (_, i) => i);

describe("CHI-047 CPU", () => {
  test("always finds a splitting question while two or more candidates remain", () => {
    for (const seed of seeds) {
      for (const s of cpuDecisions(seed)) {
        if (s.cpuCandidates.length < 2) continue;
        const move = chooseCpuMove(s, content, index);
        if (!("ask" in move))
          throw new Error(`seed ${seed}: guessed with ${s.cpuCandidates.length} candidates`);
        const q = questionByKey(content, move.ask);
        const yes = s.cpuCandidates.filter((id) => q && evaluate(q.asked, attrsOf(id))).length;
        expect(yes, `seed ${seed}`).toBeGreaterThan(0);
        expect(yes, `seed ${seed}`).toBeLessThan(s.cpuCandidates.length);
      }
    }
  });

  test("never guesses wrong", () => {
    for (const seed of seeds) {
      const decisions = cpuDecisions(seed);
      const last = decisions.at(-1);
      if (!last) throw new Error(`seed ${seed}: no CPU decision`);
      expect(chooseCpuMove(last, content, index)).toEqual({ guess: last.playerSecret });
      expect(step(last, { type: "END_TURN" }, content).state.result).toBe("lost");
    }
  });

  test("same seed gives the same game", () => {
    for (const seed of seeds.slice(0, 50)) {
      expect(simulateGame(seed, "smart", content)).toEqual(simulateGame(seed, "smart", content));
      expect(cpuDecisions(seed)).toEqual(cpuDecisions(seed));
    }
  });

  test("against a passive player the CPU always wins, in about log2(24) ≈ 4.6 questions", () => {
    const r = simulate(1000, "passive", content);
    expect(r.playerWinRate).toBe(0);
    expect(r.avgCpuQuestionsToWin).toBeGreaterThan(4.3);
    expect(r.avgCpuQuestionsToWin).toBeLessThan(5.5);
    expect(r.maxCpuQuestionsToWin).toBeLessThanOrEqual(6);
  });

  test("a player as smart as the CPU wins most games, because they go first", () => {
    const r = simulate(1000, "smart", content);
    expect(r.playerWinRate).toBeGreaterThan(0.6);
    expect(r.playerWinRate).toBeLessThan(0.95);
  });
});
