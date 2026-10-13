import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { content } from "../../content/index.ts";
import { allQuestions, parseKey, type AskedQuestion } from "../../engine/index.ts";
import { answer, logOf, question } from "./sentences.ts";

// zh-desktop.md ZS 3: the round log's invariants, over histories built from every
// question the game can ask, by either side, with either pronoun and either truth.

const questions = allQuestions(content);
const answerIds = content.lexicon.filter((e) => e.pos === "answer").map((e) => e.id);

const asked = fc
  .record({
    q: fc.constantFrom(...questions),
    by: fc.constantFrom("player" as const, "cpu" as const),
    pron: fc.constantFrom("pr.ta.m", "pr.ta.f"),
    truth: fc.boolean(),
    said: fc.constantFrom(...answerIds),
  })
  .map(({ q, by, pron, truth, said }): AskedQuestion => {
    const h = { by, key: q.key, pron, answer: truth };
    return {
      ...h,
      text: question(q.key, pron).hanzi,
      answerText: answer(h).hanzi,
      ...(by === "cpu" && { playerAnswer: said }),
    };
  });
const histories = fc.array(asked, { maxLength: 20 });

describe("roundLog", () => {
  test("one entry per question, newest first", () => {
    fc.assert(
      fc.property(histories, (history) => {
        const log = logOf(history);
        expect(log).toHaveLength(history.length);
        log.forEach((entry, i) => {
          const h = history[history.length - 1 - i];
          expect(entry.by).toBe(h?.by);
          // The sentences are the engine's own text for that row.
          expect(entry.question.hanzi).toBe(h?.text);
          expect(entry.answer.hanzi).toBe(h?.answerText);
        });
      }),
    );
  });

  test("the English is the question, then Yes or No for the true answer", () => {
    fc.assert(
      fc.property(histories, (history) => {
        logOf(history).forEach((entry, i) => {
          const h = history[history.length - 1 - i];
          expect(entry.english).toMatch(/^(Is|Does) (he|she|this person) .+\? (Yes|No)\.$/);
          expect(entry.english.endsWith(h?.answer ? "Yes." : "No.")).toBe(true);
        });
      }),
    );
  });

  test("only the computer's questions carry the learner's answer, and whether it was right", () => {
    fc.assert(
      fc.property(histories, (history) => {
        logOf(history).forEach((entry, i) => {
          const h = history[history.length - 1 - i];
          if (!h) throw new Error("no row");
          if (h.by === "player") {
            expect(entry.playerAnswerId).toBeUndefined();
            expect(entry.right).toBeUndefined();
            return;
          }
          expect(entry.playerAnswerId).toBe(h.playerAnswer);
          const verb = content.lexicon.find((e) => e.id === parseKey(h.key).verbId);
          if (verb?.pos !== "verb") throw new Error("no verb");
          expect(entry.right).toBe(h.playerAnswer === (h.answer ? verb.yes : verb.no));
        });
      }),
    );
  });

  test("the spec's example: the computer asks 他是医生吗？, the learner says 不是, rightly", () => {
    const key = questions.find((q) => q.nounId === "n.yisheng")?.key ?? "";
    const h = { by: "cpu" as const, key, pron: "pr.ta.m", answer: false };
    const [entry] = logOf([
      { ...h, text: "他是医生吗？", answerText: answer(h).hanzi, playerAnswer: "a.bushi" },
    ]);
    expect(entry).toMatchObject({
      by: "cpu",
      english: "Is he a doctor? No.",
      playerAnswerId: "a.bushi",
      right: true,
    });
    expect(entry?.question).toMatchObject({ hanzi: "他是医生吗？", pinyin: "Tā shì yīshēng ma?" });
    expect(entry?.answer).toMatchObject({
      hanzi: "不是，他不是医生。",
      pinyin: "Bú shì, tā bú shì yīshēng.",
    });
  });

  test("an empty round has an empty log, and the history is not changed", () => {
    expect(logOf([])).toEqual([]);
    const history: AskedQuestion[] = [];
    logOf(history);
    expect(history).toEqual([]);
  });
});
