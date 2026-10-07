// Spec 5 and 10.2: the CPU always splits, never guesses wrong, is deterministic,
// and picks its pronoun by the rule of section 5.
import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import { indexContent } from "./content.ts";
import { chooseCpuMove, cpuPronoun } from "./cpu.ts";
import { evaluate, parseKey } from "./predicate.ts";
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
const ids = content.characters.map((c) => c.id);
const women = content.characters.filter((c) => c.attrs.gender === "n.nvde").map((c) => c.id);
const men = content.characters.filter((c) => c.attrs.gender === "n.nande").map((c) => c.id);

// Plays a game where the player never guesses, answering truthfully, and returns
// every state in which the CPU had to choose.
function cpuDecisions(seed: number): GameState[] {
  let s = startGame(seed, 2, content);
  const out: GameState[] = [];
  const order = [...index.noun.values()].map((n) => ["pr.ta.m", n.verb, n.id, "pt.ma"]);
  let i = 0;
  while (s.phase !== "over") {
    if (s.phase === "playerTurn")
      s = step(s, { type: "ASK", tokens: order[i++] ?? [] }, content).state;
    else if (s.phase === "playerReview") {
      out.push(s);
      s = step(s, { type: "END_TURN" }, content).state;
    } else if (s.phase === "cpuTurn") {
      const { verbId } = parseKey(s.pendingCpuQuestion?.key ?? "");
      s = step(
        s,
        { type: "ANSWER", answerId: index.verb.get(verbId)?.no ?? "", hintShown: false },
        content,
      ).state;
    } else s = step(s, { type: "END_TURN" }, content).state;
  }
  return out;
}

describe.each([1, 2, 3, 50, 999])("seed %i", (seed) => {
  const decisions = cpuDecisions(seed);

  test("every question it asks splits its candidates", () => {
    for (const s of decisions) {
      const move = chooseCpuMove(s, content);
      if ("guess" in move) continue;
      const noun = index.noun.get(parseKey(move.ask).nounId);
      const yes = s.cpuCandidates.filter((id) => noun && evaluate(noun, attrsOf(id))).length;
      expect(yes).toBeGreaterThan(0);
      expect(yes).toBeLessThan(s.cpuCandidates.length);
    }
  });

  test("it guesses only with one candidate left, and the guess is right", () => {
    for (const s of decisions) {
      const move = chooseCpuMove(s, content);
      if ("guess" in move) {
        expect(s.cpuCandidates).toEqual([s.playerSecret]);
        expect(move.guess).toBe(s.playerSecret);
      }
    }
  });

  test("the same seed gives the same game", () => {
    expect(cpuDecisions(seed)).toEqual(decisions);
  });
});

describe("pronoun (spec 5, D8)", () => {
  test("她 when every candidate is a woman", () => {
    expect(cpuPronoun(women, index)).toBe("pr.ta.f");
  });
  test("他 when every candidate is a man", () => {
    expect(cpuPronoun(men, index)).toBe("pr.ta.m");
  });
  test("他 when gender is unknown", () => {
    expect(cpuPronoun(ids, index)).toBe("pr.ta.m");
  });
  test("is stored with the CPU's question", () => {
    const s = {
      ...startGame(4, 2, content),
      phase: "playerReview" as const,
      cpuCandidates: women.slice(0, 5),
    };
    expect(step(s, { type: "END_TURN" }, content).state.pendingCpuQuestion?.pron).toBe("pr.ta.f");
  });
});

test("ties go to the earlier key in cpuQuestionOrder", () => {
  const s = startGame(8, 2, content);
  const reversed = { ...s, cpuQuestionOrder: [...s.cpuQuestionOrder].reverse() };
  // 12 men and 12 women: both gender questions split 12/12, so the order decides.
  const pick = (g: GameState) => chooseCpuMove(g, content);
  const first = s.cpuQuestionOrder.find((k) => k.startsWith("v.shi|n.n"));
  const last = reversed.cpuQuestionOrder.find((k) => k.startsWith("v.shi|n.n"));
  expect(pick(s)).toEqual({ ask: first });
  expect(pick(reversed)).toEqual({ ask: last });
});

describe("simulation (spec 5)", () => {
  test("the CPU needs at most 5 questions, and about log2 24 on average", () => {
    const r = simulate(300, "passive", content);
    expect(r.playerWinRate).toBe(0);
    expect(r.maxCpuQuestionsToWin).toBe(5);
    expect(r.avgCpuQuestionsToWin).toBeGreaterThan(4.3);
    expect(r.avgCpuQuestionsToWin).toBeLessThan(5);
  });

  test("a smart player who goes first wins some games", () => {
    const r = simulate(100, "smart", content);
    expect(r.playerWinRate).toBeGreaterThan(0.3);
  });

  test("simulateGame is deterministic", () => {
    expect(simulateGame(12, "smart", content)).toEqual(simulateGame(12, "smart", content));
  });
});
