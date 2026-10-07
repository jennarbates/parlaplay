// Spec 4.4 and 10.2: every ANSWER combination, 7 answers × 3 verbs × 2 truths.
import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import type { Answer } from "../content/schemas.ts";
import { indexContent } from "./content.ts";
import { evaluate } from "./predicate.ts";
import { startGame } from "./start.ts";
import { step } from "./step.ts";
import type { GameState } from "./types.ts";

const index = indexContent(content);
const answers = content.lexicon.filter((e): e is Answer => e.pos === "answer");
const secret = content.characters[0];
if (!secret) throw new Error("no characters");

// One question per verb, and a noun that gives each truth for the secret.
const nounFor = (verb: string, truth: boolean) => {
  const n = [...index.noun.values()].find(
    (n) => n.verb === verb && evaluate(n, secret.attrs) === truth,
  );
  if (!n) throw new Error(`no ${verb} noun with ${truth}`);
  return n;
};

function asked(verb: string, noun: string, pron = "pr.ta.m"): GameState {
  return {
    ...startGame(3, 2, content),
    playerSecret: secret.id,
    phase: "cpuTurn",
    pendingCpuQuestion: { key: `${verb}|${noun}`, pron },
  };
}

const cases = ["v.shi", "v.you", "v.zai"].flatMap((verb) =>
  [true, false].flatMap((truth) => answers.map((a) => [verb, truth, a] as const)),
);

test("42 cases", () => expect(cases).toHaveLength(42));

describe.each(cases)("%s, truth %s, answered %o", (verb, truth, a) => {
  const noun = nounFor(verb, truth);
  const v = index.verb.get(verb);
  const expected = index.answer.get(truth ? (v?.yes ?? "") : (v?.no ?? ""));
  const s = asked(verb, noun.id);
  const { state, events } = step(s, { type: "ANSWER", answerId: a.id, hintShown: false }, content);
  const verbRight = a.verb === verb;
  const polarityRight = a.polarity === truth;
  const correct = verbRight && a.valid && polarityRight;

  test("events in the order of spec 4.4", () => {
    expect(events).toEqual([
      { type: "asked", by: "cpu", key: `${verb}|${noun.id}`, answer: truth },
      ...(verbRight
        ? []
        : [
            {
              type: "grammarSlip",
              point: "gp.answer.verb",
              given: a.hanzi,
              expected: expected?.hanzi,
            },
          ]),
      ...(a.valid
        ? []
        : [{ type: "grammarSlip", point: "gp.neg.mei", given: "不有", expected: "没有" }]),
      {
        type: "rating",
        lexiconId: noun.id,
        direction: "recognize",
        rating: polarityRight ? "hard" : "again",
        ...(!polarityRight && {
          detail: {
            slot: "answer",
            given: a.hanzi,
            expected: expected?.hanzi,
            rule: "answer.wrong",
          },
        }),
      },
    ]);
  });

  test("feedback only when something was wrong, ending with the full answer", () => {
    const answerText = state.history.at(-1)?.answerText ?? "";
    if (correct) expect(state.lastFeedback).toBeUndefined();
    else
      expect(state.lastFeedback?.at(-1)).toEqual({
        messageKey: "answer.wrong",
        params: { answerText },
      });
    expect(answerText).toBe(`${expected?.hanzi}，他${expected?.hanzi}${noun.hanzi}。`);
  });

  test("the CPU learns the truth whatever was tapped", () => {
    expect(state.phase).toBe("cpuReview");
    expect(state.pendingCpuQuestion).toBeUndefined();
    expect(state.history.at(-1)).toMatchObject({ by: "cpu", answer: truth, playerAnswer: a.id });
    for (const id of state.cpuCandidates)
      expect(evaluate(noun, index.character.get(id)?.attrs ?? secret.attrs)).toBe(truth);
    expect(state.cpuCandidates).toContain(secret.id);
  });
});

test("a shown hint means no rating, but slips are still logged", () => {
  const noun = nounFor("v.you", false);
  const { events } = step(
    asked("v.you", noun.id),
    { type: "ANSWER", answerId: "a.buyou", hintShown: true },
    content,
  );
  expect(events.map((e) => e.type)).toEqual(["asked", "grammarSlip"]);
});

test("the CPU's pronoun is kept in its question and answer", () => {
  const noun = nounFor("v.zai", true);
  const { state } = step(
    asked("v.zai", noun.id, "pr.ta.f"),
    { type: "ANSWER", answerId: "a.zai", hintShown: false },
    content,
  );
  expect(state.history.at(-1)).toMatchObject({
    pron: "pr.ta.f",
    text: `她在${noun.hanzi}吗？`,
    answerText: `在，她在${noun.hanzi}。`,
  });
});

test("an unknown answer id is rejected", () => {
  const noun = nounFor("v.you", true);
  const s = asked("v.you", noun.id);
  expect(step(s, { type: "ANSWER", answerId: "n.gou", hintShown: false }, content)).toEqual({
    state: s,
    events: [{ type: "rejected", reason: "unknownId" }],
  });
});
