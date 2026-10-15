import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { content } from "../../content/index.ts";
import { allQuestions, type AskedQuestion } from "../../engine/index.ts";
import { renderAnswer } from "../../engine/render.ts";
import { factsOf, statement } from "./facts.ts";

const questions = allQuestions(content);
const asked = fc
  .record({
    q: fc.constantFrom(...questions),
    by: fc.constantFrom("player" as const, "cpu" as const),
    truth: fc.boolean(),
  })
  .map(({ q, by, truth }): AskedQuestion => ({
    by,
    key: q.key,
    text: q.text,
    answer: truth,
    answerText: renderAnswer(q.text, truth),
    ...(by === "cpu" && { playerAnswer: truth }),
  }));

describe("factsOf", () => {
  test("one fact per question the player asked, newest first", () => {
    fc.assert(
      fc.property(fc.array(asked, { maxLength: 20 }), (history) => {
        const mine = history.filter((h) => h.by === "player").reverse();
        expect(factsOf(history)).toEqual(mine.map((h) => statement(h.answerText)));
      }),
    );
  });

  test("a fact is the answer without its Sì or No, as a sentence", () => {
    expect(statement("No, non ha i capelli biondi.")).toBe("Non ha i capelli biondi.");
    expect(statement("Sì, ha gli occhi azzurri.")).toBe("Ha gli occhi azzurri.");
    fc.assert(
      fc.property(fc.constantFrom(...questions), fc.boolean(), (q, truth) => {
        const fact = statement(renderAnswer(q.text, truth));
        expect(fact).toMatch(/^[A-ZÈ].*\.$/u);
        expect(fact).not.toMatch(/^(Sì|No)\b/);
        expect(fact.toLowerCase().startsWith("non ")).toBe(!truth);
      }),
    );
  });
});
