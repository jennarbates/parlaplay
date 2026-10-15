import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { content } from "../../content/index.ts";
import { allQuestions, type AskedQuestion } from "../../engine/index.ts";
import { factsOf } from "./facts.ts";
import { answer, question } from "./sentences.ts";

const questions = allQuestions(content);
const asked = fc
  .record({
    q: fc.constantFrom(...questions),
    by: fc.constantFrom("player" as const, "cpu" as const),
    pron: fc.constantFrom("pr.ta.m", "pr.ta.f"),
    truth: fc.boolean(),
  })
  .map(({ q, by, pron, truth }): AskedQuestion => {
    const h = { by, key: q.key, pron, answer: truth };
    return {
      ...h,
      text: question(q.key, pron).hanzi,
      answerText: answer(h).hanzi,
      ...(by === "cpu" && { playerAnswer: "a.shi" }),
    };
  });
const hanzi = (segments: { hanzi: string }[]) => segments.map((s) => s.hanzi).join("");

describe("factsOf", () => {
  test("one fact per question the player asked, newest first: the answer after its comma", () => {
    fc.assert(
      fc.property(fc.array(asked, { maxLength: 20 }), (history) => {
        const mine = history.filter((h) => h.by === "player").reverse();
        const facts = factsOf(history);
        expect(facts).toHaveLength(mine.length);
        facts.forEach((fact, i) => {
          const full = mine[i]?.answerText ?? "";
          expect(hanzi(fact)).toBe(full.slice(full.indexOf("，") + 1));
          expect(hanzi(fact)).toMatch(/^[他她].*。$/u);
          // Every word keeps its pinyin for ruby; only the full stop has none.
          expect(fact.filter((s) => !s.lexiconId).map((s) => s.hanzi)).toEqual(["。"]);
        });
      }),
    );
  });

  test("没有，她没有狗。 gives 她没有狗。", () => {
    const h = { by: "player" as const, key: "v.you|n.gou", pron: "pr.ta.f", answer: false };
    const history = [{ ...h, text: question(h.key, h.pron).hanzi, answerText: answer(h).hanzi }];
    expect(hanzi(factsOf(history)[0] ?? [])).toBe("她没有狗。");
  });
});
