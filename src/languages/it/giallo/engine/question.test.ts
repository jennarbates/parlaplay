// Chi è stato? GS 3.2 and GS 5.3: every rule of the question words, what is not an
// error, joining, and the traced example of GS 5.5.
import { describe, expect, test } from "vitest";
import { questionFor } from "./ask.ts";
import { joinQuestion, lemmaOf } from "./question.ts";
import { start } from "./start.ts";
import { askOf, engineContent, run } from "./testing.ts";
import type { Built, Level } from "./types.ts";

const begin = (level: Level = 2) => start(7, "case.torta", level, engineContent);
const lexicon = engineContent.lexicon;

// A question as the Level 2 builder makes it: the lemma comes from the tiles.
const tiles = (to: string, frame: string, form: string, prep?: string, slot?: number): Built => ({
  to,
  frame,
  form,
  qword: lemmaOf(lexicon, form, prep) ?? "",
  ...(prep && { prep }),
  ...(slot !== undefined && { slot }),
});

describe("lemmaOf: the lemma a preposition and a question-word tile make", () => {
  test.each([
    ["chi", undefined, "q.chi"],
    ["chi", "prep.di", "q.di_chi"],
    ["chi", "prep.con", "q.con_chi"],
    ["chi", "prep.da", "q.chi"],
    ["dove", "prep.da", "q.da_dove"],
    ["dov'", undefined, "q.dove"],
    ["che ora", undefined, "q.a_che_ora"],
    ["che ora", "prep.a", "q.a_che_ora"],
    ["che", undefined, "q.cosa"],
    ["qual'", undefined, "q.quale"],
  ] as const)("%s with %s is %s", (form, prep, lemma) => {
    expect(lemmaOf(lexicon, form, prep)).toBe(lemma);
  });
});

describe("GS 3.2: each rule's wrong form", () => {
  // Slips: accepted, correct form shown and in the notebook, a slip row, no rating.
  test.each([
    ["agree.quanto", tiles("r.witness", "f.people.cucina.slot", "quanti", undefined, 1), "quante"],
    ["agree.quale", tiles("r.pairA", "f.shoes", "quale"), "quali"],
    ["trunc.qualE", tiles("r.pairA", "f.job", "qual'"), "qual"],
  ] as const)("%s is a slip", (rule, built, expected) => {
    const s = begin();
    const { state, events } = run(s, askOf(built));
    const slip = { slot: "qword", given: built.form, expected, rule };
    const entry = state.notebook[0];
    expect(state.budget).toBe(14);
    expect(entry?.built.form).toBe(expected);
    expect(events).toEqual([
      { type: "asked", entry, slip },
      { type: "slip", error: slip },
    ]);
  });

  // Rejected, mistake logged: again for the card the learner should have built.
  test.each([
    [
      "elide.consonant",
      tiles("r.witness", "f.saw.slot", "dov'", undefined, 1),
      { slot: "qword", given: "dov'", expected: "dove" },
      "q.dove",
    ],
    [
      "prep.diChi",
      tiles("r.witness", "f.owner.umbrella", "chi"),
      { slot: "prep", given: "", expected: "di" },
      "q.di_chi",
    ],
    [
      "prep.aCheOra",
      tiles("r.pairA", "f.arrive", "che ora"),
      { slot: "prep", given: "", expected: "a" },
      "q.a_che_ora",
    ],
    [
      "prep.daDove",
      tiles("r.pairA", "f.from", "dove"),
      { slot: "prep", given: "", expected: "da" },
      "q.da_dove",
    ],
  ] as const)("%s is rejected with a mistake", (rule, built, error, lemma) => {
    const s = begin();
    const { state, events } = run(s, askOf(built));
    expect(state.budget).toBe(15);
    expect(state.notebook).toEqual([]);
    expect(events).toEqual([
      { type: "rejected", reason: "grammar", errors: [{ ...error, rule }] },
      { type: "rating", lexiconId: lemma, direction: "produce", rating: "again" },
    ]);
  });

  test.each([
    ["prep.conChi", tiles("r.pairA", "f.at.slot", "chi", undefined, 1)],
    ["word.choice", tiles("r.pairA", "f.arrive", "quanto")],
    [
      "a preposition the lemma doesn't take",
      tiles("r.pairA", "f.owner.umbrella", "chi", "prep.da"),
    ],
  ] as const)("%s is rejected as nonsense, with no mistake", (_, built) => {
    const s = begin();
    const { state, events } = run(s, askOf(built));
    expect(state).toBe(s);
    expect(events).toEqual([{ type: "rejected", reason: "nonsense" }]);
  });

  test("at Level 1 a rejection rates nothing", () => {
    const { events } = run(begin(1), askOf(tiles("r.witness", "f.owner.umbrella", "chi")));
    expect(events.filter((e) => e.type === "rating")).toEqual([]);
  });

  test("a form that isn't the lemma's is a shape error", () => {
    const built = { ...tiles("r.pairA", "f.arrive", "quando"), form: "Quando" };
    expect(run(begin(), askOf(built)).events).toEqual([{ type: "rejected", reason: "shape" }]);
  });
});

describe("GS 3.2: not errors, accepted with no slip", () => {
  test.each(["che cosa", "cosa", "che"])("%s faceva…?", (form) => {
    const { state, events } = run(
      begin(),
      askOf(tiles("r.pairA", "f.doing.slot", form, undefined, 1)),
    );
    expect(state.budget).toBe(14);
    expect(events).toEqual([
      { type: "asked", entry: state.notebook[0] },
      { type: "rating", lexiconId: "q.cosa", direction: "produce", rating: "good" },
    ]);
  });

  test.each([
    ["dove era", tiles("r.pairA", "f.at.slot", "dove", undefined, 1)],
    ["dov'era", tiles("r.pairA", "f.at.slot", "dov'", undefined, 1)],
    ["come è", tiles("r.pairA", "f.arrive", "come")],
    ["com'è", tiles("r.pairA", "f.arrive", "com'")],
    ["quale è", tiles("r.pairA", "f.job", "quale")],
    ["qual è", tiles("r.pairA", "f.job", "qual")],
    ["quanti anni", tiles("r.pairA", "f.age", "quanti")],
    ["quanto tempo", tiles("r.pairA", "f.time.garden", "quanto")],
    ["quanta torta", tiles("r.pairA", "f.cake", "quanta")],
  ] as const)("%s", (_, built) => {
    const { state, events } = run(begin(), askOf(built));
    expect(state.notebook[0]?.built.form).toBe(built.form);
    expect(events.map((e) => e.type)).toEqual(["asked", "rating"]);
  });

  test("quando and a che ora are both accepted in the arrival frame, with different answers", () => {
    const { state } = run(
      begin(),
      askOf(tiles("r.pairA", "f.arrive", "quando")),
      askOf(tiles("r.pairA", "f.arrive", "che ora", "prep.a")),
    );
    const [quando, aCheOra] = state.notebook;
    expect(state.budget).toBe(13);
    expect(quando?.answer).not.toBe(aCheOra?.answer);
  });
});

describe("two errors at once, as it.md 4.3", () => {
  test("an elided quant' before persone is both elision and agreement, rejected once", () => {
    const { events } = run(
      begin(),
      askOf(tiles("r.witness", "f.people.cucina.slot", "quant'", undefined, 1)),
    );
    expect(events[0]).toEqual({
      type: "rejected",
      reason: "grammar",
      errors: [
        { slot: "qword", given: "quant'", expected: "quante", rule: "elide.consonant" },
        { slot: "qword", given: "quant'", expected: "quante", rule: "agree.quanto" },
      ],
    });
    expect(events.filter((e) => e.type === "rating")).toHaveLength(1);
  });

  test("elision and a known error both show, each card rated again", () => {
    const { events } = run(begin(), askOf(tiles("r.pairA", "f.from", "dov'")));
    expect(events).toEqual([
      {
        type: "rejected",
        reason: "grammar",
        errors: [
          { slot: "qword", given: "dov'", expected: "dove", rule: "elide.consonant" },
          { slot: "prep", given: "", expected: "da", rule: "prep.daDove" },
        ],
      },
      { type: "rating", lexiconId: "q.dove", direction: "produce", rating: "again" },
      { type: "rating", lexiconId: "q.da_dove", direction: "produce", rating: "again" },
    ]);
  });
});

describe("GS 5.3, Joining", () => {
  test.each([
    [["dov'", "era tra le otto e le nove?"], "Dov'era tra le otto e le nove?"],
    [["dove", "era tra le otto e le nove?"], "Dove era tra le otto e le nove?"],
    [["di", "chi", "è questo ombrello?"], "Di chi è questo ombrello?"],
    [["", "qual", "è il Suo lavoro?"], "Qual è il Suo lavoro?"],
    [["perché", "è arrivata alla villa?"], "Perché è arrivata alla villa?"],
    [["quant'", "anni ha?"], "Quant'anni ha?"],
  ])("%j → %s", (words, text) => {
    expect(joinQuestion(words)).toBe(text);
  });

  test("questionFor fills the slot and takes the body for the person's gender", () => {
    const s = begin();
    const built = tiles("r.pairA", "f.arrive", "che ora", "prep.a");
    const gender = engineContent.characters.find((x) => x.id === s.cast["r.pairA"])?.attrs.gender;
    expect(questionFor(s, built, engineContent)).toBe(
      `A che ora è ${gender === "n.donna" ? "arrivata" : "arrivato"} alla villa?`,
    );
    expect(questionFor(s, tiles("r.pairA", "f.at.slot", "dov'", undefined, 1), engineContent)).toBe(
      "Dov'era tra le otto e le nove?",
    );
  });
});

describe("GS 5.5, traced example", () => {
  test("chi è questo ombrello? is rejected; di chi is accepted and keeps its again", () => {
    const s = begin();
    expect(s.budget).toBe(15);
    const wrong = run(s, askOf(tiles("r.witness", "f.owner.umbrella", "chi")));
    expect(wrong.state.budget).toBe(15);
    expect(wrong.events).toEqual([
      {
        type: "rejected",
        reason: "grammar",
        errors: [{ slot: "prep", given: "", expected: "di", rule: "prep.diChi" }],
      },
      { type: "rating", lexiconId: "q.di_chi", direction: "produce", rating: "again" },
    ]);
    const right = tiles("r.witness", "f.owner.umbrella", "chi", "prep.di");
    expect(questionFor(wrong.state, right, engineContent)).toBe("Di chi è questo ombrello?");
    const { state, events } = run(wrong.state, askOf(right));
    const pairB = engineContent.characters.find((x) => x.id === s.cast["r.pairB"])?.name;
    expect(state.budget).toBe(14);
    expect(state.notebook[0]?.answer).toBe(`È di ${pairB}.`);
    // No good for q.di_chi: a card keeps its again for the turn (it.md 6).
    expect(events).toEqual([{ type: "asked", entry: state.notebook[0] }]);
    expect(state.ratedThisTurn).toEqual([]);
  });
});
