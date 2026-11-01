// Chi è stato? GS 6: the inspector's questions, built from the notebook.
import { describe, expect, test } from "vitest";
import { seeded, shuffled } from "../../engine/random.ts";
import { answerFor } from "./ask.ts";
import { inspectorQuestion, kinds } from "./inspector.ts";
import { qwordById, usualForm } from "./question.ts";
import { start } from "./start.ts";
import { askOf, engineContent, everyQuestion, run } from "./testing.ts";
import type { Built, CaseState } from "./types.ts";

const questions = everyQuestion("case.torta");
const begin = (seed = 7) => start(seed, "case.torta", 2, engineContent);

// A state whose notebook holds these questions and their answers.
const withNotebook = (built: Built[], s = begin()): CaseState => ({
  ...s,
  notebook: built.map((b) => answerFor(s, b, engineContent)),
});

const kindOf = (qword: string) => kinds.findIndex((k) => k.includes(qword));
const name = (s: CaseState, role: string) =>
  engineContent.characters.find((c) => c.id === s.cast[role])?.name;

// As the learner would build it: the usual form, with the lemma's preposition.
const tiles = (to: string, frame: string, qword: string, slot: number): Built => {
  const q = qwordById(engineContent.lexicon, qword);
  const f = engineContent.frames.find((x) => x.id === frame);
  return {
    to,
    frame,
    qword,
    form: q && f ? usualForm(q, f) : "",
    slot,
    ...(q?.prep && { prep: q.prep }),
  };
};
const at = (to: string, qword: string, slot = 0) => tiles(to, "f.at.slot", qword, slot);
const doing = (to: string, slot = 0) => tiles(to, "f.doing.slot", "q.cosa", slot);

describe("options", () => {
  test("are always a place, a time or companion, and a thing or person, from the notebook", () => {
    let asked = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = begin(seed);
      const n = 4 * (1 + (seed % 3));
      const state = withNotebook(shuffled(seeded(seed), questions).slice(0, n), s);
      const q = inspectorQuestion(state, engineContent);
      if (!q) continue;
      asked++;
      expect(q.options).toHaveLength(3);
      expect(new Set(q.options).size).toBe(3);
      expect(q.options).toContain(q.answer);
      // Each option is the answer of a notebook entry of its own kind, and the
      // right one is the answer to the question word she asks with.
      const kindsOf = (text: string) =>
        new Set(
          state.notebook
            .filter((e) => e.key !== null && e.answer === text)
            .map((e) => kindOf(e.built.qword)),
        );
      expect(kindsOf(q.answer).has(kindOf(q.qword))).toBe(true);
      const [x, y] = q.options.filter((o) => o !== q.answer) as [string, string];
      const rest = [0, 1, 2].filter((k) => k !== kindOf(q.qword)) as [number, number];
      const covered =
        (kindsOf(x).has(rest[0]) && kindsOf(y).has(rest[1])) ||
        (kindsOf(x).has(rest[1]) && kindsOf(y).has(rest[0]));
      expect(covered).toBe(true);
      expect(state.notebook.some((e) => e.built.qword === q.qword && e.answer === q.answer)).toBe(
        true,
      );
    }
    expect(asked).toBeGreaterThan(50);
  });

  test("never the case's default", () => {
    const s = begin();
    // "Non lo so." is the default: the culprit at an unknown frame has none here.
    const state = withNotebook(
      [at("r.pairA", "q.dove"), at("r.pairA", "q.con_chi"), doing("r.pairA")],
      s,
    );
    const withDefault = {
      ...state,
      notebook: [...state.notebook, { built: doing("r.seen", 1), key: null, answer: "Non lo so." }],
    };
    for (let seed = 1; seed <= 50; seed++)
      expect(inspectorQuestion({ ...withDefault, seed }, engineContent)?.options).not.toContain(
        "Non lo so.",
      );
  });

  test("are the same for the same state (deterministic)", () => {
    const state = withNotebook(shuffled(seeded(3), questions).slice(0, 12));
    expect(inspectorQuestion(state, engineContent)).toEqual(
      inspectorQuestion(structuredClone(state), engineContent),
    );
  });
});

describe("skipping", () => {
  test("she skips with an empty notebook", () => {
    expect(inspectorQuestion(begin(), engineContent)).toBeUndefined();
  });

  test("she skips when the notebook lacks a kind of answer", () => {
    // Places and companions, but no thing or person.
    const state = withNotebook([
      at("r.pairA", "q.dove"),
      at("r.pairB", "q.dove"),
      at("r.pairA", "q.con_chi"),
      at("r.seen", "q.con_chi"),
    ]);
    expect(inspectorQuestion(state, engineContent)).toBeUndefined();
  });

  test("she skips when only the default answered", () => {
    const s = begin();
    const notebook = [at("r.pairA", "q.dove"), at("r.pairA", "q.con_chi"), doing("r.pairA")].map(
      (built) => ({ built, key: null, answer: "Non lo so." }),
    );
    expect(inspectorQuestion({ ...s, notebook }, engineContent)).toBeUndefined();
  });

  test("she asks once the notebook has all three kinds", () => {
    const state = withNotebook([
      at("r.pairA", "q.dove"),
      at("r.pairA", "q.con_chi"),
      doing("r.pairA"),
    ]);
    expect(inspectorQuestion(state, engineContent)).toBeDefined();
  });
});

describe("the question", () => {
  // The entry to ask about, last, with one answer of each other kind as its options.
  const only = (built: Built, s = begin()) => {
    const others = [at("r.pairA", "q.dove"), at("r.pairA", "q.con_chi"), doing("r.pairA")].filter(
      (b) => kindOf(b.qword) !== kindOf(built.qword),
    );
    return withNotebook([...others, built], s);
  };
  const asked = (built: Built, s = begin()) => {
    const state = only(built, s);
    for (let seed = 1; seed <= 100; seed++) {
      const q = inspectorQuestion({ ...state, seed }, engineContent);
      if (q?.qword === built.qword) return { q, state };
    }
    throw new Error(`never asked ${built.qword}`);
  };

  test.each<[string, Built, (n: string, slot: string) => string]>([
    ["dove, elided", at("r.seen", "q.dove", 2), (n, slot) => `Dov'era ${n} ${slot}?`],
    ["con chi", at("r.seen", "q.con_chi", 2), (n, slot) => `Con chi era ${n} ${slot}?`],
    ["che cosa", doing("r.seen", 2), (n, slot) => `Che cosa faceva ${n} ${slot}?`],
    [
      "chi, after the auxiliary and participle",
      { to: "r.seen", frame: "f.saw.slot", qword: "q.chi", form: "", slot: 2 },
      (n, slot) => `Chi ha visto ${n} ${slot}?`,
    ],
    [
      "da dove",
      { to: "r.seen", frame: "f.from", qword: "q.da_dove", form: "" },
      (n) => `Da dove viene ${n}?`,
    ],
    [
      "a frame not about the person",
      { to: "r.witness", frame: "f.stolen.torta", qword: "q.quando", form: "" },
      (n) => `Secondo ${n}, quando è sparita la torta?`,
    ],
    [
      "an owner frame",
      { to: "r.witness", frame: "f.owner.umbrella", qword: "q.di_chi", form: "" },
      (n) => `Secondo ${n}, di chi è questo ombrello?`,
    ],
  ])("%s", (_, built, text) => {
    const { q, state } = asked(built);
    expect(q.text).toBe(text(name(state, built.to) ?? "", slotText(built)));
    expect(q.answer).toBe(state.notebook.at(-1)?.answer);
  });

  test("the participle agrees with the person asked", () => {
    const built: Built = { to: "r.seen", frame: "f.arrive", qword: "q.quando", form: "" };
    for (let seed = 1; seed <= 40; seed++) {
      const s = begin(seed);
      const { q, state } = asked(built, s);
      const woman =
        engineContent.characters.find((c) => c.id === state.cast["r.seen"])?.attrs.gender ===
        "n.donna";
      expect(q.text).toBe(
        `Quando è ${woman ? "arrivata" : "arrivato"} ${name(state, "r.seen")} alla villa?`,
      );
    }
  });
});

describe("in play", () => {
  // One of each kind, then a fourth: she asks after it.
  const four = [
    at("r.pairA", "q.dove"),
    at("r.pairA", "q.con_chi"),
    doing("r.pairA"),
    doing("r.seen"),
  ];

  test("she asks after the 4th accepted question, and never uses the budget", () => {
    const third = run(begin(), ...four.slice(0, 3).map(askOf));
    expect(third.state.phase).toBe("asking");
    const { state, events } = run(third.state, askOf(four[3] as Built));
    expect(state.phase).toBe("inspector");
    expect(state.budget).toBe(11);
    expect(events.at(-1)).toEqual({ type: "inspectorAsked", question: state.inspector });

    const question = state.inspector;
    if (!question) throw new Error("no question");
    const answered = run(state, { type: "ANSWER_INSPECTOR", choice: question.answer });
    expect(answered.state.phase).toBe("asking");
    expect(answered.state.budget).toBe(11);
    expect(answered.events).toEqual([
      { type: "rating", lexiconId: question.qword, direction: "recognize", rating: "hard" },
    ]);
  });

  test("she asks again after the 8th, and skips when the notebook cannot answer", () => {
    // Four places and companions: nothing to ask after the 4th.
    const placesFirst = [
      at("r.pairA", "q.dove"),
      at("r.pairB", "q.dove"),
      at("r.pairA", "q.con_chi"),
      at("r.seen", "q.con_chi"),
    ];
    const skipped = run(begin(), ...placesFirst.map(askOf));
    expect(skipped.state.phase).toBe("asking");
    expect(skipped.events.some((e) => e.type === "inspectorAsked")).toBe(false);

    const more = [doing("r.pairA"), doing("r.seen"), doing("r.pairB"), doing("r.witness")];
    const seventh = run(skipped.state, ...more.slice(0, 3).map(askOf));
    expect(seventh.state.phase).toBe("asking");
    const eighth = run(seventh.state, askOf(more[3] as Built));
    expect(eighth.state.phase).toBe("inspector");
    expect(eighth.state.budget).toBe(7);
  });
});

function slotText(built: Built): string {
  const c = engineContent.cases.find((x) => x.id === "case.torta");
  return built.slot === undefined ? "" : (c?.slots[built.slot] ?? "");
}
