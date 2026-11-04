// Chi è stato? GS 2 and GS 9.1: the accusation's sentence and the case end's solution.
import { describe, expect, test } from "vitest";
import { accusationSentence, caseSolution } from "./accusation.ts";
import { answerFor } from "./ask.ts";
import { caseById, start } from "./start.ts";
import { culprit, solve, solved } from "./solve.ts";
import { engineContent } from "./testing.ts";
import { builtFor } from "./question.ts";
import { shortestSolution } from "./invariants.ts";
import { variantOf } from "./start.ts";

const begin = (seed = 7) => start(seed, "case.torta", 1, engineContent);
const person = (s: ReturnType<typeof begin>, role: string) =>
  engineContent.characters.find((c) => c.id === s.cast[role]);

describe("accusationSentence", () => {
  test("names the person, the room's in form and the slot, agreeing with their gender", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = begin(seed);
      const who = person(s, "r.seen");
      const verb = who?.attrs.gender === "n.donna" ? "È stata" : "È stato";
      seen.add(verb);
      expect(accusationSentence(s, { role: "r.seen", room: 2, slot: 1 }, engineContent)).toBe(
        `${verb} ${who?.name}, in biblioteca, tra le otto e le nove.`,
      );
    }
    expect(seen.size).toBe(2);
  });
});

describe("caseSolution", () => {
  test("is the culprit, the hiding room and the crime slot", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = begin(seed);
      const c = caseById(engineContent, s.caseId);
      const { person: who, sentence } = caseSolution(s, engineContent);
      expect(who?.role).toBe(culprit);
      expect(sentence).toContain(`${who?.character.name}, ${c.rooms[s.hide]?.in}, `);
      expect(sentence).toContain(`, ${c.slots[s.crime]}.`);
    }
  });

  test("its answers prove the case, as the people gave them", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = begin(seed);
      const c = caseById(engineContent, s.caseId);
      const { proofs } = caseSolution(s, engineContent);
      const questions = shortestSolution(c, engineContent.frames, variantOf(s)) ?? [];
      const entries = questions.map((q) =>
        answerFor(s, builtFor(q, engineContent.frames, engineContent.lexicon), engineContent),
      );
      expect(solved(c, solve(c, entries))).toBe(true);
      expect(proofs.map((p) => p.answer)).toEqual(entries.map((e) => e.answer));
      expect(proofs.length).toBeGreaterThan(0);
      for (const p of proofs) {
        expect(p.question).toMatch(/\?$/);
        expect(`${p.name}${p.question}${p.answer}`).not.toContain("{");
      }
    }
  });
});
