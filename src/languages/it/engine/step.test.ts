import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import { indexContent } from "./content.ts";
import { chooseCpuMove } from "./cpu.ts";
import { evaluate } from "./meaning.ts";
import { allQuestions, questionByKey } from "./questions.ts";
import { setupState, startGame } from "./start.ts";
import { step } from "./step.ts";
import { parseTiles, type Tiles } from "./tiles.ts";
import type { Action, Fill, GameEvent, GameState, Level, Phase } from "./types.ts";

const index = indexContent(content);
const attrs = (id: string) => {
  const c = index.character.get(id);
  if (!c) throw new Error(id);
  return c.attrs;
};

// A started game with chosen secrets. Giulia in our deck: rosso corto verde, no glasses.
function game(level: Level = 2, overrides: Partial<GameState> = {}): GameState {
  return {
    ...startGame(7, level, content),
    cpuSecret: "c.giulia",
    playerSecret: "c.marco",
    ...overrides,
  };
}

const fills = {
  capelliBiondi: { verb: "v.ha", art: "art.i", noun: "n.capelli", adj: "adj.biondo#mp" },
  capelliRossi: { verb: "v.ha", art: "art.i", noun: "n.capelli", adj: "adj.rosso#mp" },
  occhiCastani: { verb: "v.ha", art: "art.gli", noun: "n.occhi", adj: "adj.castano#mp" },
  occhiMarroni: { verb: "v.ha", art: "art.gli", noun: "n.occhi", adj: "adj.marrone#mp" },
  barba: { verb: "v.ha", art: "art.la", noun: "n.barba" },
  donna: { verb: "v.e", art: "art.una", noun: "n.donna" },
} satisfies Record<string, Fill>;

const ask = (
  fill: Fill,
  templateId = fill.adj
    ? "t.have.adj"
    : fill.noun === "n.donna" || fill.noun === "n.uomo"
      ? "t.be"
      : "t.have",
): Action => ({
  type: "ASK",
  templateId,
  fill,
});

function run(state: GameState, ...actions: Action[]) {
  let s = state;
  let events: GameEvent[] = [];
  for (const a of actions) {
    const r = step(s, a, content);
    s = r.state;
    events = r.events;
  }
  return { state: s, events };
}

// One state in every phase, reached by real play.
function inPhase(phase: Phase): GameState {
  const g = game();
  switch (phase) {
    case "setup":
      return setupState();
    case "playerTurn":
      return g;
    case "playerReview":
      return run(g, ask(fills.barba)).state;
    case "cpuTurn":
      return run(g, ask(fills.barba), { type: "END_TURN" }).state;
    case "cpuReview":
      return run(
        g,
        ask(fills.barba),
        { type: "END_TURN" },
        { type: "ANSWER", value: true, hintShown: false },
      ).state;
    case "over":
      return run(g, { type: "GUESS", characterId: "c.giulia" }).state;
  }
}

const phases: Phase[] = ["setup", "playerTurn", "playerReview", "cpuTurn", "cpuReview", "over"];
const actions: Record<Action["type"], Action> = {
  START: { type: "START", seed: 3, level: 1 },
  ASK: ask(fills.donna),
  GUESS: { type: "GUESS", characterId: "c.giulia" },
  FLIP: { type: "FLIP", characterId: "c.anna" },
  ANSWER: { type: "ANSWER", value: true, hintShown: false },
  END_TURN: { type: "END_TURN" },
};

// Spec 4.2: which cells are allowed. Everything else is wrongPhase.
const allowed: Record<Phase, Action["type"][]> = {
  setup: ["START"],
  playerTurn: ["ASK", "GUESS", "FLIP"],
  playerReview: ["FLIP", "END_TURN"],
  cpuTurn: ["FLIP", "ANSWER"],
  cpuReview: ["FLIP", "END_TURN"],
  over: ["START"],
};

describe("CHI-032 transition table (spec 4.2)", () => {
  test("every phase is reachable", () => {
    for (const p of phases) expect(inPhase(p).phase).toBe(p);
  });

  describe.each(phases)("%s", (phase) => {
    test.each(Object.keys(actions) as Action["type"][])("%s", (type) => {
      const before = inPhase(phase);
      const { state, events } = step(before, actions[type], content);
      if (allowed[phase].includes(type)) {
        expect(
          events.find((e) => e.type === "rejected" && e.reason === "wrongPhase"),
        ).toBeUndefined();
      } else {
        expect(events).toEqual([{ type: "rejected", reason: "wrongPhase" }]);
        expect(state).toEqual(before);
      }
    });
  });

  test("the target phase of each allowed cell", () => {
    const after = (p: Phase, t: Action["type"]) =>
      step(inPhase(p), actions[t], content).state.phase;
    expect(after("setup", "START")).toBe("playerTurn");
    expect(after("over", "START")).toBe("playerTurn");
    expect(after("playerTurn", "ASK")).toBe("playerReview");
    expect(after("playerTurn", "GUESS")).toBe("over");
    expect(after("playerReview", "END_TURN")).toBe("cpuTurn");
    expect(after("cpuTurn", "ANSWER")).toBe("cpuReview");
    expect(after("cpuReview", "END_TURN")).toBe("playerTurn");
  });

  test.each(["playerTurn", "playerReview", "cpuTurn", "cpuReview"] as Phase[])(
    "FLIP toggles in %s",
    (phase) => {
      const s = inPhase(phase);
      const once = step(s, actions.FLIP, content).state;
      expect(once.flipped).toEqual([...s.flipped, "c.anna"]);
      expect(once.phase).toBe(phase);
      const twice = step(once, actions.FLIP, content).state;
      expect(twice.flipped).toEqual(s.flipped);
    },
  );

  test("FLIP can flip the CPU's actual secret, and an unknown card is rejected", () => {
    expect(step(game(), { type: "FLIP", characterId: "c.giulia" }, content).state.flipped).toEqual([
      "c.giulia",
    ]);
    expect(step(game(), { type: "FLIP", characterId: "c.nobody" }, content).events).toEqual([
      { type: "rejected", reason: "unknownId" },
    ]);
  });

  test("END_TURN from cpuReview increments turn and clears ratedThisTurn", () => {
    const s = inPhase("cpuReview");
    expect(s.ratedThisTurn.length).toBeGreaterThan(0);
    const next = step(s, { type: "END_TURN" }, content).state;
    expect(next.turn).toBe(s.turn + 1);
    expect(next.ratedThisTurn).toEqual([]);
  });

  test("over accepts only START, which starts a new game", () => {
    const over = inPhase("over");
    const next = step(over, { type: "START", seed: 99, level: 2 }, content).state;
    expect(next).toEqual(startGame(99, 2, content));
  });
});

describe("CHI-039 GUESS", () => {
  test("a correct guess wins", () => {
    const r = step(game(), { type: "GUESS", characterId: "c.giulia" }, content);
    expect(r.state).toMatchObject({ phase: "over", result: "won" });
    expect(r.events).toEqual([{ type: "gameOver", result: "won" }]);
  });

  test("a wrong guess loses", () => {
    const r = step(game(), { type: "GUESS", characterId: "c.anna" }, content);
    expect(r.state).toMatchObject({ phase: "over", result: "lost" });
    expect(r.events).toEqual([{ type: "gameOver", result: "lost" }]);
  });

  test("guessing a flipped card is allowed", () => {
    const flipped = run(game(), { type: "FLIP", characterId: "c.giulia" }).state;
    expect(step(flipped, { type: "GUESS", characterId: "c.giulia" }, content).state.result).toBe(
      "won",
    );
  });

  test("an unknown character is rejected and the turn is not used", () => {
    const g = game();
    const r = step(g, { type: "GUESS", characterId: "c.nobody" }, content);
    expect(r.events).toEqual([{ type: "rejected", reason: "unknownId" }]);
    expect(r.state).toEqual(g);
  });
});

describe("CHI-035 ASK validation pipeline", () => {
  test("an accepted question answers truthfully about cpuSecret", () => {
    const r = step(game(), ask(fills.capelliRossi), content);
    const truth = attrs("c.giulia").hairColor === "adj.rosso";
    expect(r.state.phase).toBe("playerReview");
    expect(r.state.history).toEqual([
      {
        by: "player",
        key: "t.have.adj|n.capelli|adj.rosso",
        text: "Ha i capelli rossi?",
        answer: truth,
        answerText: truth ? "Sì, ha i capelli rossi." : "No, non ha i capelli rossi.",
      },
    ]);
    expect(r.events[0]).toEqual({
      type: "asked",
      by: "player",
      key: "t.have.adj|n.capelli|adj.rosso",
      answer: truth,
    });
  });

  describe("order: phase, unknownId, grammar, nonsense, duplicate", () => {
    test("phase comes first, even with unknown ids", () => {
      const r = step(
        inPhase("cpuTurn"),
        ask({ verb: "v.x", art: "art.x", noun: "n.x" }, "t.x"),
        content,
      );
      expect(r.events).toEqual([{ type: "rejected", reason: "wrongPhase" }]);
    });

    test("unknown ids come before grammar", () => {
      const r = step(
        game(),
        ask({ verb: "v.e", art: "art.la", noun: "n.capelli", adj: "adj.giallo#mp" }),
        content,
      );
      expect(r.events).toEqual([{ type: "rejected", reason: "unknownId" }]);
    });

    test("grammar comes before nonsense", () => {
      // gli capelli is a grammar error; marroni on capelli would also be nonsense.
      const r = step(
        game(),
        ask({ ...fills.capelliBiondi, art: "art.gli", adj: "adj.marrone#mp" }),
        content,
      );
      expect(r.events[0]).toMatchObject({ type: "rejected", reason: "grammar" });
    });

    test("grammar comes before duplicate", () => {
      const asked = run(
        game(),
        ask(fills.barba),
        { type: "END_TURN" },
        { type: "ANSWER", value: true, hintShown: false },
        { type: "END_TURN" },
      ).state;
      const r = step(asked, ask({ ...fills.barba, art: "art.il" }), content);
      expect(r.events[0]).toMatchObject({ type: "rejected", reason: "grammar" });
    });

    test("nonsense comes before duplicate", () => {
      const r = step(game(), ask({ ...fills.capelliBiondi, adj: "adj.verde#mp" }), content);
      expect(r.events).toEqual([{ type: "rejected", reason: "nonsense" }]);
    });
  });

  test.each([
    ["unknown template", ask(fills.barba, "t.nope")],
    ["unknown noun", ask({ ...fills.barba, noun: "n.nope" }, "t.have")],
    ["unknown verb", ask({ ...fills.barba, verb: "v.nope" })],
    ["unknown article", ask({ ...fills.barba, art: "art.nope" })],
    ["unknown adjective", ask({ ...fills.capelliBiondi, adj: "adj.nope#mp" })],
    ["bad form key", ask({ ...fills.capelliBiondi, adj: "adj.biondo#xx" })],
    ["template that is not the noun's", ask(fills.barba, "t.be")],
    ["missing adjective", ask({ verb: "v.ha", art: "art.i", noun: "n.capelli" }, "t.have.adj")],
    ["adjective where none fits", ask({ ...fills.barba, adj: "adj.nero#fs" }, "t.have")],
  ])("unknownId: %s", (_, action) => {
    const g = game();
    const r = step(g, action, content);
    expect(r.events).toEqual([{ type: "rejected", reason: "unknownId" }]);
    expect(r.state).toEqual(g);
  });

  describe("grammar returns one SlotError per wrong slot with the right rule key", () => {
    test.each([
      [
        "wrong article on capelli",
        ask({ ...fills.capelliBiondi, art: "art.gli" }),
        [{ slot: "art", given: "gli", expected: "i", rule: "art.mpl.consonant" }],
      ],
      [
        "wrong article on occhi",
        ask({ ...fills.occhiMarroni, art: "art.i" }),
        [{ slot: "art", given: "i", expected: "gli", rule: "art.mpl.vowel" }],
      ],
      [
        "wrong article on barba",
        ask({ ...fills.barba, art: "art.il" }),
        [{ slot: "art", given: "il", expected: "la", rule: "art.fsg" }],
      ],
      [
        "wrong article on cappello",
        ask({ verb: "v.ha", art: "art.la", noun: "n.cappello" }),
        [{ slot: "art", given: "la", expected: "il", rule: "art.msg.consonant" }],
      ],
      [
        "wrong article on uomo",
        ask({ verb: "v.e", art: "art.una", noun: "n.uomo" }),
        [{ slot: "art", given: "una", expected: "un", rule: "art.indef.m" }],
      ],
      [
        "wrong article on donna",
        ask({ ...fills.donna, art: "art.un" }),
        [{ slot: "art", given: "un", expected: "una", rule: "art.indef.f" }],
      ],
      [
        "è for avere",
        ask({ ...fills.barba, verb: "v.e" }),
        [{ slot: "verb", given: "è", expected: "ha", rule: "verb.avere" }],
      ],
      [
        "ha for essere",
        ask({ ...fills.donna, verb: "v.ha" }),
        [{ slot: "verb", given: "ha", expected: "è", rule: "verb.essere" }],
      ],
      [
        "verb and article both wrong",
        ask({ ...fills.capelliBiondi, verb: "v.e", art: "art.gli" }),
        [
          { slot: "verb", given: "è", expected: "ha", rule: "verb.avere" },
          { slot: "art", given: "gli", expected: "i", rule: "art.mpl.consonant" },
        ],
      ],
      [
        "article and agreement both wrong (spec 4.5)",
        ask({ ...fills.capelliBiondi, art: "art.gli", adj: "adj.biondo#fp" }),
        [
          { slot: "art", given: "gli", expected: "i", rule: "art.mpl.consonant" },
          { slot: "adj", given: "bionde", expected: "biondi", rule: "agreement" },
        ],
      ],
    ] as const)("%s", (_, action, errors) => {
      const g = game();
      const r = step(g, action, content);
      expect(r.events[0]).toEqual({ type: "rejected", reason: "grammar", errors });
      expect(r.state.phase).toBe("playerTurn");
      expect(r.state.history).toEqual([]);
    });

    test("feedback names each rule with its words", () => {
      const r = step(
        game(),
        ask({ ...fills.capelliBiondi, verb: "v.e", art: "art.gli", adj: "adj.biondo#fp" }),
        content,
      );
      expect(r.state.lastFeedback).toEqual([
        { messageKey: "verb.avere", params: { art: "i", noun: "capelli" } },
        { messageKey: "art.mpl.consonant", params: { noun: "capelli" } },
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
    });
  });

  test("capelli marroni is rejected with meaning.wordChoice", () => {
    const g = game();
    const r = step(g, ask({ ...fills.capelliBiondi, adj: "adj.marrone#mp" }), content);
    expect(r.events).toEqual([{ type: "rejected", reason: "nonsense" }]);
    expect(r.state.lastFeedback).toEqual([
      { messageKey: "meaning.wordChoice", params: { noun: "capelli", use: "castani" } },
    ]);
    expect(r.state.ratedThisTurn).toEqual(g.ratedThisTurn);
  });

  test("occhi biondi is rejected with meaning.mismatch", () => {
    const r = step(game(), ask({ ...fills.occhiMarroni, adj: "adj.biondo#mp" }), content);
    expect(r.events).toEqual([{ type: "rejected", reason: "nonsense" }]);
    expect(r.state.lastFeedback).toEqual([
      {
        messageKey: "meaning.mismatch",
        params: { noun: "occhi", given: "biondi", allowed: "eye color" },
      },
    ]);
  });

  test("capelli verdi lists both things hair can be", () => {
    const r = step(game(), ask({ ...fills.capelliBiondi, adj: "adj.verde#mp" }), content);
    expect(r.state.lastFeedback?.[0]?.params.allowed).toBe("hair color or hair length");
  });

  test("occhi castani and occhi marroni share one QuestionKey, so the second is a duplicate", () => {
    const first = run(
      game(),
      ask(fills.occhiCastani),
      { type: "END_TURN" },
      { type: "ANSWER", value: true, hintShown: false },
      { type: "END_TURN" },
    ).state;
    const r = step(first, ask(fills.occhiMarroni), content);
    expect(r.events).toEqual([{ type: "rejected", reason: "duplicate" }]);
  });

  test("castani eyes render as castani, and answer about brown eyes", () => {
    const r = step(game(1, { cpuSecret: "c.anna" }), ask(fills.occhiCastani), content);
    const truth = attrs("c.anna").eyeColor === "adj.marrone";
    expect(r.state.history[0]).toMatchObject({
      text: "Ha gli occhi castani?",
      answer: truth,
      key: "t.have.adj|n.occhi|adj.marrone",
    });
  });

  test("a duplicate shows the previous answer and does not use the turn", () => {
    const asked = run(
      game(),
      ask(fills.barba),
      { type: "END_TURN" },
      { type: "ANSWER", value: true, hintShown: false },
      { type: "END_TURN" },
    ).state;
    const previous = asked.history.find((h) => h.by === "player");
    const r = step(asked, ask(fills.barba), content);
    expect(r.events).toEqual([{ type: "rejected", reason: "duplicate" }]);
    expect(r.state.lastFeedback).toEqual([
      { messageKey: "duplicate", params: { answerText: previous?.answerText } },
    ]);
    expect(r.state.phase).toBe("playerTurn");
    expect(r.state.history).toEqual(asked.history);
  });

  test("asking a question the CPU already asked is allowed", () => {
    const barba = "t.have|n.barba|";
    const s = run({ ...game(), cpuQuestionOrder: [barba] }, ask(fills.donna), {
      type: "END_TURN",
    }).state;
    expect(s.pendingCpuQuestion).toBe(barba);
    const back = run(
      s,
      { type: "ANSWER", value: false, hintShown: false },
      { type: "END_TURN" },
    ).state;
    const r = step(back, ask(fills.barba), content);
    expect(r.state.phase).toBe("playerReview");
    expect(r.events[0]).toMatchObject({ type: "asked", by: "player", key: barba });
  });
});

describe("CHI-036 soft agreement slips", () => {
  const bionde = ask({ ...fills.capelliBiondi, adj: "adj.biondo#fp" });

  test("the question is rendered with the correct form", () => {
    const r = step(game(), bionde, content);
    expect(r.state.phase).toBe("playerReview");
    expect(r.state.history[0]?.text).toBe("Ha i capelli biondi?");
    expect(r.state.history[0]?.answerText).toMatch(/capelli biondi\.$/);
  });

  test("agreementSlip event with given and expected, and the adjective is not rated (spec 4.5)", () => {
    const r = step(game(), bionde, content);
    expect(r.events).toEqual([
      {
        type: "asked",
        by: "player",
        key: "t.have.adj|n.capelli|adj.biondo",
        answer: expect.any(Boolean),
      },
      { type: "rating", lexiconId: "n.capelli", direction: "produce", rating: "good" },
      { type: "agreementSlip", lexiconId: "adj.biondo", given: "bionde", expected: "biondi" },
    ]);
    expect(r.state.ratedThisTurn).toEqual(["n.capelli|produce"]);
    expect(r.state.lastFeedback).toEqual([
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
  });

  test("forms are compared by text: marroni given as fp is right for occhi", () => {
    const r = step(game(), ask({ ...fills.occhiMarroni, adj: "adj.marrone#fp" }), content);
    expect(r.events.some((e) => e.type === "agreementSlip")).toBe(false);
    expect(r.events).toContainEqual({
      type: "rating",
      lexiconId: "adj.marrone",
      direction: "produce",
      rating: "good",
    });
  });

  test("marrone (singular) on occhi is a slip", () => {
    const r = step(game(), ask({ ...fills.occhiMarroni, adj: "adj.marrone#ms" }), content);
    expect(r.events).toContainEqual({
      type: "agreementSlip",
      lexiconId: "adj.marrone",
      given: "marrone",
      expected: "marroni",
    });
    expect(r.state.history[0]?.text).toBe("Ha gli occhi marroni?");
  });

  test("a grammar-rejected question reports the agreement error but emits no agreementSlip (spec 4.5)", () => {
    const r = step(
      game(),
      ask({ ...fills.capelliBiondi, art: "art.gli", adj: "adj.biondo#fp" }),
      content,
    );
    expect(r.events).toEqual([
      {
        type: "rejected",
        reason: "grammar",
        errors: [
          { slot: "art", given: "gli", expected: "i", rule: "art.mpl.consonant" },
          { slot: "adj", given: "bionde", expected: "biondi", rule: "agreement" },
        ],
      },
      {
        type: "rating",
        lexiconId: "n.capelli",
        direction: "produce",
        rating: "again",
        detail: { slot: "art", given: "gli", expected: "i", rule: "art.mpl.consonant" },
      },
    ]);
  });

  test("at level 1 a wrong form is corrected silently", () => {
    const r = step(game(1), bionde, content);
    expect(r.events.map((e) => e.type)).toEqual(["asked"]);
    expect(r.state.history[0]?.text).toBe("Ha i capelli biondi?");
    expect(r.state.lastFeedback).toBeUndefined();
  });
});

describe("CHI-037 parseTiles", () => {
  const parse = (tiles: Tiles) => parseTiles(tiles, content);

  test.each([
    [{ verb: "v.ha", art: "art.i", noun: "n.capelli", adj: "adj.biondo#mp" }, "t.have.adj"],
    [{ verb: "v.ha", art: "art.la", noun: "n.barba" }, "t.have"],
    [{ verb: "v.e", art: "art.una", noun: "n.donna" }, "t.be"],
    // The noun picks the template even when the verb is wrong; grammar catches the verb.
    [{ verb: "v.e", art: "art.la", noun: "n.barba" }, "t.have"],
    [{ verb: "v.ha", art: "art.una", noun: "n.donna" }, "t.be"],
  ])("%o → %s", (tiles, templateId) => {
    expect(parse(tiles)).toEqual({ templateId, fill: tiles });
  });

  test.each([
    [{ art: "art.i", noun: "n.capelli", adj: "adj.biondo#mp" }, "noVerb"],
    [{}, "noVerb"],
    [{ verb: "v.ha", noun: "n.capelli", adj: "adj.biondo#mp" }, "noArt"],
    [{ verb: "v.ha", art: "art.i", adj: "adj.biondo#mp" }, "noNoun"],
    [{ verb: "v.ha", art: "art.i", noun: "n.capelli" }, "needsAdj"],
    [{ verb: "v.ha", art: "art.gli", noun: "n.occhi" }, "needsAdj"],
    [{ verb: "v.ha", art: "art.la", noun: "n.barba", adj: "adj.nero#fs" }, "noAdjAllowed"],
    [{ verb: "v.e", art: "art.una", noun: "n.donna", adj: "adj.biondo#fs" }, "noAdjAllowed"],
  ] as [Tiles, string][])("%o → %s", (tiles, kind) => {
    expect(parse(tiles)).toEqual({ shapeError: { kind } });
  });

  test("an unknown noun parses with no template, and ASK rejects it as unknownId", () => {
    const parsed = parse({ verb: "v.ha", art: "art.i", noun: "n.nope" });
    expect(parsed).toEqual({
      templateId: "",
      fill: { verb: "v.ha", art: "art.i", noun: "n.nope" },
    });
    if (!("templateId" in parsed)) throw new Error("expected a parse");
    expect(step(game(), { type: "ASK", ...parsed }, content).events).toEqual([
      { type: "rejected", reason: "unknownId" },
    ]);
  });

  test("shape errors dispatch nothing and log nothing: parseTiles is pure", () => {
    const g = game();
    const before = structuredClone(g);
    parse({ verb: "v.ha", art: "art.i", noun: "n.capelli" });
    expect(g).toEqual(before);
  });
});

describe("CHI-038 ratings and ANSWER", () => {
  test("ratedThisTurn prevents a second rating: a fixed question keeps the noun's again", () => {
    const failed = step(game(), ask({ ...fills.capelliBiondi, art: "art.gli" }), content);
    expect(failed.state.ratedThisTurn).toEqual(["n.capelli|produce"]);
    const fixed = step(failed.state, ask(fills.capelliBiondi), content);
    const ratings = fixed.events.filter((e) => e.type === "rating");
    expect(ratings).toEqual([
      { type: "rating", lexiconId: "adj.biondo", direction: "produce", rating: "good" },
    ]);
    expect(fixed.state.ratedThisTurn).toEqual(["n.capelli|produce", "adj.biondo|produce"]);
  });

  test("failing twice in a turn rates once", () => {
    const once = step(game(), ask({ ...fills.barba, art: "art.il" }), content);
    const twice = step(once.state, ask({ ...fills.barba, verb: "v.e" }), content);
    expect(twice.events.filter((e) => e.type === "rating")).toEqual([]);
  });

  test("a level 2 question accepted with the right form rates noun and adjective good (spec 4.5)", () => {
    const r = step(game(), ask(fills.capelliBiondi), content);
    expect(r.events.slice(1)).toEqual([
      { type: "rating", lexiconId: "n.capelli", direction: "produce", rating: "good" },
      { type: "rating", lexiconId: "adj.biondo", direction: "produce", rating: "good" },
    ]);
    expect(r.state.ratedThisTurn).toEqual(["n.capelli|produce", "adj.biondo|produce"]);
  });

  test("level 1 ASKs emit no produce rating or agreementSlip", () => {
    for (const fill of [
      fills.capelliBiondi,
      fills.barba,
      fills.donna,
      { ...fills.capelliBiondi, adj: "adj.biondo#fp" },
    ]) {
      const r = step(game(1), ask(fill), content);
      expect(r.events.map((e) => e.type)).toEqual(["asked"]);
      expect(r.state.ratedThisTurn).toEqual([]);
    }
    const rejected = step(game(1), ask({ ...fills.barba, art: "art.il" }), content);
    expect(rejected.events.map((e) => e.type)).toEqual(["rejected"]);
  });

  function cpuAsking(level: Level, playerSecret = "c.marco") {
    return run(game(level, { playerSecret }), ask(fills.donna), { type: "END_TURN" }).state;
  }

  test.each([1, 2] as const)(
    "level %i: a correct Sì/No without hint rates recognize hard",
    (level) => {
      const s = cpuAsking(level);
      const q = questionByKey(content, s.pendingCpuQuestion ?? "");
      if (!q) throw new Error("no CPU question");
      const truth = evaluate(q.asked, attrs(s.playerSecret));
      const r = step(s, { type: "ANSWER", value: truth, hintShown: false }, content);
      const words = [q.fill.noun, ...(q.fill.adj ? [q.fill.adj.split("#")[0]] : [])];
      expect(r.events).toEqual([
        { type: "asked", by: "cpu", key: q.key, answer: truth },
        ...words.map((w) => ({
          type: "rating",
          lexiconId: w,
          direction: "recognize",
          rating: "hard",
        })),
      ]);
      expect(r.state.lastFeedback).toBeUndefined();
    },
  );

  test.each([1, 2] as const)(
    "level %i: a wrong Sì/No rates again with an answer.wrong detail",
    (level) => {
      const s = cpuAsking(level);
      const q = questionByKey(content, s.pendingCpuQuestion ?? "");
      if (!q) throw new Error("no CPU question");
      const truth = evaluate(q.asked, attrs(s.playerSecret));
      const r = step(s, { type: "ANSWER", value: !truth, hintShown: false }, content);
      const detail = {
        slot: "answer",
        given: truth ? "No" : "Sì",
        expected: truth ? "Sì" : "No",
        rule: "answer.wrong",
      };
      for (const e of r.events.filter((e) => e.type === "rating")) {
        expect(e).toMatchObject({ direction: "recognize", rating: "again", detail });
      }
      expect(r.events.filter((e) => e.type === "rating").length).toBeGreaterThan(0);
    },
  );

  test("an answer after a shown hint produces no rating", () => {
    const s = cpuAsking(2);
    const r = step(s, { type: "ANSWER", value: true, hintShown: true }, content);
    expect(r.events.map((e) => e.type)).toEqual(["asked"]);
    expect(r.state.ratedThisTurn).toEqual(s.ratedThisTurn);
  });

  test("the CPU's question is added to history with the player's answer", () => {
    const s = cpuAsking(2);
    const q = questionByKey(content, s.pendingCpuQuestion ?? "");
    const r = step(s, { type: "ANSWER", value: false, hintShown: false }, content);
    const truth = q ? evaluate(q.asked, attrs(s.playerSecret)) : undefined;
    expect(r.state.history.at(-1)).toEqual({
      by: "cpu",
      key: q?.key,
      text: q?.text,
      answer: truth,
      answerText: truth
        ? `Sì, ${q?.text.charAt(0).toLowerCase()}${q?.text.slice(1, -1)}.`
        : `No, non ${q?.text.charAt(0).toLowerCase()}${q?.text.slice(1, -1)}.`,
      playerAnswer: false,
    });
    expect(r.state.pendingCpuQuestion).toBeUndefined();
  });
});

describe("CHI-045 CPU chooses its move", () => {
  test("guesses only with one candidate left, and the guess is right", () => {
    const s = { ...inPhase("playerReview"), cpuCandidates: ["c.marco"] };
    const r = step(s, { type: "END_TURN" }, content);
    expect(r.state).toMatchObject({ phase: "over", result: "lost" });
    expect(r.events).toEqual([{ type: "gameOver", result: "lost" }]);
  });

  test("with two or more candidates it asks", () => {
    const s = { ...inPhase("playerReview"), cpuCandidates: ["c.marco", "c.anna"] };
    expect(step(s, { type: "END_TURN" }, content).state.phase).toBe("cpuTurn");
  });

  test("picks the question whose yes count is closest to half", () => {
    const s = inPhase("playerReview");
    const move = chooseCpuMove(s, content, index);
    if (!("ask" in move)) throw new Error("expected a question");
    const distance = (key: string) => {
      const q = questionByKey(content, key);
      const yes = s.cpuCandidates.filter((id) => q && evaluate(q.asked, attrs(id))).length;
      return Math.abs(yes - s.cpuCandidates.length / 2);
    };
    const best = Math.min(...allQuestions(content).map((q) => distance(q.key)));
    expect(distance(move.ask)).toBe(best);
  });

  test("ties go to the earlier question in cpuQuestionOrder", () => {
    // 12 men and 12 women: uomo and donna both split exactly in half.
    const s = inPhase("playerReview");
    const men = "t.be|n.uomo|";
    const women = "t.be|n.donna|";
    const rest = s.cpuQuestionOrder.filter((k) => k !== men && k !== women);
    expect(
      chooseCpuMove({ ...s, cpuQuestionOrder: [men, women, ...rest] }, content, index),
    ).toEqual({ ask: men });
    expect(
      chooseCpuMove({ ...s, cpuQuestionOrder: [women, men, ...rest] }, content, index),
    ).toEqual({ ask: women });
  });

  test("never asks the same question twice", () => {
    let s = startGame(5, 2, content);
    const asked: string[] = [];
    for (let i = 0; i < 6 && s.phase !== "over"; i++) {
      s = run(s, ask(fills.donna), { type: "END_TURN" }).state;
      if (s.phase === "over") break;
      asked.push(s.pendingCpuQuestion ?? "");
      s = run(s, { type: "ANSWER", value: true, hintShown: false }, { type: "END_TURN" }).state;
      s = { ...s, history: s.history.filter((h) => h.by === "cpu") }; // let the player re-ask donna
    }
    expect(new Set(asked).size).toBe(asked.length);
  });

  test("uses the default brown-eyes wording", () => {
    const key = "t.have.adj|n.occhi|adj.marrone";
    const s = { ...inPhase("playerReview"), cpuQuestionOrder: [key] };
    const pending = step(s, { type: "END_TURN" }, content).state;
    expect(pending.pendingCpuQuestion).toBe(key);
    const answered = step(
      pending,
      { type: "ANSWER", value: true, hintShown: false },
      content,
    ).state;
    expect(answered.history.at(-1)?.text).toBe("Ha gli occhi marroni?");
  });
});

describe("CHI-046 CPU filters candidates on the true answer", () => {
  test.each([true, false])("player answers %s: candidates follow the truth either way", (value) => {
    const s = run(game(2, { playerSecret: "c.anna" }), ask(fills.donna), {
      type: "END_TURN",
    }).state;
    const q = questionByKey(content, s.pendingCpuQuestion ?? "");
    if (!q) throw new Error("no CPU question");
    const truth = evaluate(q.asked, attrs("c.anna"));
    const r = step(s, { type: "ANSWER", value, hintShown: false }, content);
    expect(r.state.cpuCandidates).toEqual(
      s.cpuCandidates.filter((id) => evaluate(q.asked, attrs(id)) === truth),
    );
    expect(r.state.cpuCandidates).toContain("c.anna");
  });

  test("a wrong answer shows the correct one and logs a mistake", () => {
    const s = run(game(2, { playerSecret: "c.anna" }), ask(fills.donna), {
      type: "END_TURN",
    }).state;
    const q = questionByKey(content, s.pendingCpuQuestion ?? "");
    if (!q) throw new Error("no CPU question");
    const truth = evaluate(q.asked, attrs("c.anna"));
    const r = step(s, { type: "ANSWER", value: !truth, hintShown: false }, content);
    const answerText = r.state.history.at(-1)?.answerText ?? "";
    expect(answerText.startsWith(truth ? "Sì, " : "No, non ")).toBe(true);
    expect(r.state.lastFeedback).toEqual([{ messageKey: "answer.wrong", params: { answerText } }]);
    expect(
      r.events.some(
        (e) => e.type === "rating" && e.rating === "again" && e.detail?.rule === "answer.wrong",
      ),
    ).toBe(true);
  });

  test("cpuCandidates always contains playerSecret through whole games", () => {
    for (let seed = 0; seed < 50; seed++) {
      let s = startGame(seed, 2, content);
      let wrong = false;
      while (s.phase !== "over") {
        if (s.phase === "playerTurn") {
          const unasked = allQuestions(content).find(
            (q) => !s.history.some((h) => h.by === "player" && h.key === q.key),
          );
          s = unasked
            ? step(s, { type: "ASK", templateId: unasked.templateId, fill: unasked.fill }, content)
                .state
            : step(s, { type: "GUESS", characterId: s.cpuSecret }, content).state;
        } else if (s.phase === "cpuTurn") {
          wrong = !wrong; // answer wrongly every other time
          s = step(s, { type: "ANSWER", value: wrong, hintShown: false }, content).state;
        } else {
          s = step(s, { type: "END_TURN" }, content).state;
        }
        if (s.phase !== "over") expect(s.cpuCandidates).toContain(s.playerSecret);
      }
    }
  });
});
