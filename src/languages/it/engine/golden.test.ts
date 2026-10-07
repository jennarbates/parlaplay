// CHI-040: the spec 4.5 traced turn, golden question and answer strings, and speed.
import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import { allQuestions } from "./questions.ts";
import { renderAnswer } from "./render.ts";
import { startGame } from "./start.ts";
import { step } from "./step.ts";
import { parseTiles } from "./tiles.ts";
import type { Action, EngineContent, GameState } from "./types.ts";

describe("spec 4.5 traced turn", () => {
  // The spec's Giulia: castano, lungo, verde, glasses.
  const specContent: EngineContent = {
    ...content,
    characters: content.characters.map((c) =>
      c.id === "c.giulia"
        ? {
            ...c,
            attrs: {
              gender: "n.donna",
              hairColor: "adj.castano",
              hairLength: "adj.lungo",
              eyeColor: "adj.verde",
              glasses: true,
              hat: false,
              beard: false,
              mustache: false,
            },
          }
        : c,
    ),
  };
  const start: GameState = { ...startGame(1, 2, specContent), cpuSecret: "c.giulia" };
  const tiles = (adj: string, art = "art.i") => ({ verb: "v.ha", art, noun: "n.capelli", adj });

  test("1–6: Ha i capelli biondi?", () => {
    const parsed = parseTiles(tiles("adj.biondo#mp"), specContent);
    expect(parsed).toEqual({
      templateId: "t.have.adj",
      fill: { verb: "v.ha", art: "art.i", noun: "n.capelli", adj: "adj.biondo#mp" },
    });
    if (!("templateId" in parsed)) throw new Error("shape error");
    const { state, events } = step(start, { type: "ASK", ...parsed }, specContent);
    expect(state.phase).toBe("playerReview");
    expect(state.history).toEqual([
      {
        by: "player",
        key: "t.have.adj|n.capelli|adj.biondo",
        text: "Ha i capelli biondi?",
        answer: false,
        answerText: "No, non ha i capelli biondi.",
      },
    ]);
    expect(state.ratedThisTurn).toEqual(["n.capelli|produce", "adj.biondo|produce"]);
    expect(events).toEqual([
      { type: "asked", by: "player", key: "t.have.adj|n.capelli|adj.biondo", answer: false },
      { type: "rating", lexiconId: "n.capelli", direction: "produce", rating: "good" },
      { type: "rating", lexiconId: "adj.biondo", direction: "produce", rating: "good" },
    ]);
  });

  test("the same question at level 1 emits only asked", () => {
    const { events } = step(
      { ...start, level: 1 },
      { type: "ASK", templateId: "t.have.adj", fill: tiles("adj.biondo#mp") },
      specContent,
    );
    expect(events).toEqual([
      { type: "asked", by: "player", key: "t.have.adj|n.capelli|adj.biondo", answer: false },
    ]);
  });

  test("with bionde: accepted, rendered biondi, one good rating and a slip", () => {
    const { state, events } = step(
      start,
      { type: "ASK", templateId: "t.have.adj", fill: tiles("adj.biondo#fp") },
      specContent,
    );
    expect(state.history[0]?.text).toBe("Ha i capelli biondi?");
    expect(state.lastFeedback).toEqual([
      {
        messageKey: "agreement",
        params: {
          expected: "biondi",
          given: "bionde",
          noun: "capelli",
          genderNumber: "masculine plural",
        },
      },
    ]);
    expect(events).toEqual([
      { type: "asked", by: "player", key: "t.have.adj|n.capelli|adj.biondo", answer: false },
      { type: "rating", lexiconId: "n.capelli", direction: "produce", rating: "good" },
      { type: "agreementSlip", lexiconId: "adj.biondo", given: "bionde", expected: "biondi" },
    ]);
  });

  test("with gli: rejected for grammar, noun rated again, phase stays", () => {
    const { state, events } = step(
      start,
      { type: "ASK", templateId: "t.have.adj", fill: tiles("adj.biondo#mp", "art.gli") },
      specContent,
    );
    const error = { slot: "art", given: "gli", expected: "i", rule: "art.mpl.consonant" };
    expect(events).toEqual([
      { type: "rejected", reason: "grammar", errors: [error] },
      {
        type: "rating",
        lexiconId: "n.capelli",
        direction: "produce",
        rating: "again",
        detail: error,
      },
    ]);
    expect(state.phase).toBe("playerTurn");
  });

  test("with gli and bionde: both errors, one again rating, nothing else", () => {
    const { state, events } = step(
      start,
      { type: "ASK", templateId: "t.have.adj", fill: tiles("adj.biondo#fp", "art.gli") },
      specContent,
    );
    const art = { slot: "art", given: "gli", expected: "i", rule: "art.mpl.consonant" };
    expect(events).toEqual([
      {
        type: "rejected",
        reason: "grammar",
        errors: [art, { slot: "adj", given: "bionde", expected: "biondi", rule: "agreement" }],
      },
      {
        type: "rating",
        lexiconId: "n.capelli",
        direction: "produce",
        rating: "again",
        detail: art,
      },
    ]);
    expect(state.ratedThisTurn).toEqual(["n.capelli|produce"]);
  });
});

describe("golden strings: 17 questions and 34 answers", () => {
  // The 16 default questions plus castani for brown eyes, the one alternative wording.
  const golden: [string, string, string][] = [
    ["È un uomo?", "Sì, è un uomo.", "No, non è un uomo."],
    ["È una donna?", "Sì, è una donna.", "No, non è una donna."],
    ["Ha i capelli biondi?", "Sì, ha i capelli biondi.", "No, non ha i capelli biondi."],
    ["Ha i capelli castani?", "Sì, ha i capelli castani.", "No, non ha i capelli castani."],
    ["Ha i capelli neri?", "Sì, ha i capelli neri.", "No, non ha i capelli neri."],
    ["Ha i capelli rossi?", "Sì, ha i capelli rossi.", "No, non ha i capelli rossi."],
    ["Ha i capelli bianchi?", "Sì, ha i capelli bianchi.", "No, non ha i capelli bianchi."],
    ["Ha i capelli corti?", "Sì, ha i capelli corti.", "No, non ha i capelli corti."],
    ["Ha i capelli lunghi?", "Sì, ha i capelli lunghi.", "No, non ha i capelli lunghi."],
    ["Ha gli occhi azzurri?", "Sì, ha gli occhi azzurri.", "No, non ha gli occhi azzurri."],
    ["Ha gli occhi marroni?", "Sì, ha gli occhi marroni.", "No, non ha gli occhi marroni."],
    ["Ha gli occhi castani?", "Sì, ha gli occhi castani.", "No, non ha gli occhi castani."],
    ["Ha gli occhi verdi?", "Sì, ha gli occhi verdi.", "No, non ha gli occhi verdi."],
    ["Ha gli occhiali?", "Sì, ha gli occhiali.", "No, non ha gli occhiali."],
    ["Ha il cappello?", "Sì, ha il cappello.", "No, non ha il cappello."],
    ["Ha la barba?", "Sì, ha la barba.", "No, non ha la barba."],
    ["Ha i baffi?", "Sì, ha i baffi.", "No, non ha i baffi."],
  ];

  test("17 questions, 34 answers", () => {
    expect(golden).toHaveLength(17);
    expect(new Set(golden.flatMap(([, yes, no]) => [yes, no])).size).toBe(34);
  });

  test("the engine renders every default question exactly", () => {
    const texts = allQuestions(content).map((q) => q.text);
    expect(texts.sort()).toEqual(
      golden
        .map(([q]) => q)
        .filter((q) => q !== "Ha gli occhi castani?")
        .sort(),
    );
  });

  test.each(golden)("%s", (question, yes, no) => {
    expect([renderAnswer(question, true), renderAnswer(question, false)]).toEqual([yes, no]);
  });

  test("castani eyes go through the engine and come back in the player's words", () => {
    const fill = { verb: "v.ha", art: "art.gli", noun: "n.occhi", adj: "adj.castano#mp" };
    const { state } = step(
      startGame(3, 2, content),
      { type: "ASK", templateId: "t.have.adj", fill },
      content,
    );
    expect(state.history[0]?.text).toBe("Ha gli occhi castani?");
    expect(["Sì, ha gli occhi castani.", "No, non ha gli occhi castani."]).toContain(
      state.history[0]?.answerText,
    );
  });
});

test("step() takes under 5 ms per action", () => {
  const questions = allQuestions(content);
  let s = startGame(11, 2, content);
  const timings: number[] = [];
  for (let i = 0; i < 2000; i++) {
    const q = questions[i % questions.length];
    const action: Action =
      s.phase === "playerTurn" && q
        ? { type: "ASK", templateId: q.templateId, fill: q.fill }
        : s.phase === "cpuTurn"
          ? { type: "ANSWER", value: i % 2 === 0, hintShown: false }
          : s.phase === "over"
            ? { type: "START", seed: i, level: 2 }
            : { type: "END_TURN" };
    const t0 = performance.now();
    s = step(s, action, content).state;
    timings.push(performance.now() - t0);
  }
  timings.sort((a, b) => a - b);
  const p99 = timings[Math.floor(timings.length * 0.99)] ?? Infinity;
  expect(p99).toBeLessThan(5);
  expect(Math.max(...timings)).toBeLessThan(50); // even the first, cold call
});
