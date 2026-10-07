// Spec 4.3, 4.6 and the Grammar row of 10.2: the player's ASK.
import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import type { Character, Noun } from "../content/schemas.ts";
import { startGame } from "./start.ts";
import { step } from "./step.ts";
import type { EngineContent, GameEvent, GameState, Level } from "./types.ts";

// 李丽 as in the spec's traced turn: woman, doctor, at the hospital, cat and phone.
const liliAttrs: Character["attrs"] = {
  gender: "n.nvde",
  job: "n.yisheng",
  place: "n.yiyuan",
  dog: false,
  cat: true,
  phone: true,
  book: false,
  computer: false,
};
const traced: EngineContent = {
  ...content,
  characters: content.characters.map((c) => (c.id === "c.lili" ? { ...c, attrs: liliAttrs } : c)),
};
const man = content.characters.find((c) => c.attrs.gender === "n.nande")?.id ?? "";

function game(level: Level = 2, overrides: Partial<GameState> = {}): GameState {
  return { ...startGame(7, level, traced), cpuSecret: "c.lili", ...overrides };
}
const ask = (tokens: string[], s = game()) => step(s, { type: "ASK", tokens }, traced);
const rejected = (events: GameEvent[]) => events.find((e) => e.type === "rejected");
const nouns = content.lexicon.filter((e): e is Noun => e.pos === "noun");
const verbs = ["v.shi", "v.you", "v.zai"] as const;
const hanzi = new Map(content.lexicon.map((e) => [e.id, e.hanzi]));

describe("4.6 traced turn and its variants", () => {
  test("他有狗吗？ is accepted and rated", () => {
    const { state, events } = ask(["pr.ta.m", "v.you", "n.gou", "pt.ma"]);
    expect(state.phase).toBe("playerReview");
    expect(state.history.at(-1)).toEqual({
      by: "player",
      key: "v.you|n.gou",
      pron: "pr.ta.m",
      text: "他有狗吗？",
      answer: false,
      answerText: "没有，他没有狗。",
    });
    expect(state.ratedThisTurn).toEqual(["n.gou|produce"]);
    expect(events).toEqual([
      { type: "asked", by: "player", key: "v.you|n.gou", answer: false },
      { type: "rating", lexiconId: "n.gou", direction: "produce", rating: "good" },
    ]);
    expect(state.lastFeedback).toBeUndefined();
  });

  test("wrong verb: 他是狗吗", () => {
    const s = game();
    const { state, events } = ask(["pr.ta.m", "v.shi", "n.gou", "pt.ma"], s);
    const detail = { slot: "verb", given: "是", expected: "有", rule: "verb.you" };
    expect(events).toEqual([
      { type: "rejected", reason: "grammar", errors: [detail] },
      { type: "rating", lexiconId: "n.gou", direction: "produce", rating: "again", detail },
    ]);
    expect(state.phase).toBe("playerTurn");
    expect(state.lastFeedback).toEqual([
      { messageKey: "verb.you", params: { pron: "他", obj: "狗" } },
    ]);
    expect(state.history).toEqual(s.history);
  });

  test("two errors and more: 你狗有", () => {
    const { events } = ask(["pr.ni", "n.gou", "v.you"]);
    expect(rejected(events)?.errors).toEqual([
      { slot: "pron", given: "你", expected: "他 / 她", rule: "gp.pron.you" },
      { slot: "ma", given: "你狗有", expected: "他有狗吗？", rule: "gp.ma" },
      { slot: "order", given: "你狗有", expected: "他有狗吗？", rule: "gp.order" },
    ]);
    expect(
      events
        .filter((e) => e.type === "grammarSlip")
        .map((e) => e.type === "grammarSlip" && e.point),
    ).toEqual(["gp.pron.you", "gp.ma", "gp.order"]);
    expect(events.some((e) => e.type === "rating")).toBe(false);
  });

  test("pronoun slip after the gender is known", () => {
    const first = ask(["pr.ta.m", "v.shi", "n.nvde", "pt.ma"]).state;
    expect(first.history.at(-1)?.answerText).toBe("是，他是女的。");
    // Skip the CPU's turn: the slip only depends on the player's history.
    const again = { ...first, phase: "playerTurn" as const, ratedThisTurn: [] };
    const { state, events } = ask(["pr.ta.m", "v.you", "n.mao", "pt.ma"], again);
    expect(state.history.at(-1)?.answerText).toBe("有，他有猫。");
    expect(events).toEqual([
      { type: "asked", by: "player", key: "v.you|n.mao", answer: true },
      { type: "rating", lexiconId: "n.mao", direction: "produce", rating: "good" },
      { type: "grammarSlip", point: "gp.pron.gender", given: "他", expected: "她" },
    ]);
    expect(state.lastFeedback).toEqual([
      { messageKey: "gp.pron.gender", params: { genderGloss: "a woman", expected: "她" } },
    ]);
  });
});

describe("pronouns (spec 2, D7)", () => {
  test("他 or 她 before any gender question gets no feedback", () => {
    for (const p of ["pr.ta.m", "pr.ta.f"]) {
      const { state, events } = ask([p, "v.you", "n.gou", "pt.ma"]);
      expect(state.lastFeedback).toBeUndefined();
      expect(events.some((e) => e.type === "grammarSlip")).toBe(false);
    }
  });

  test("the gender question itself does not slip, even with the wrong pronoun", () => {
    const { events } = ask(["pr.ta.m", "v.shi", "n.nvde", "pt.ma"]);
    expect(events.some((e) => e.type === "grammarSlip")).toBe(false);
  });

  test("the right pronoun after the gender is known gets no feedback", () => {
    const first = ask(["pr.ta.f", "v.shi", "n.nande", "pt.ma"]).state;
    const { events, state } = ask(["pr.ta.f", "v.you", "n.mao", "pt.ma"], {
      ...first,
      phase: "playerTurn",
    });
    expect(events.some((e) => e.type === "grammarSlip")).toBe(false);
    expect(state.lastFeedback).toBeUndefined();
  });

  test("a man's secret: 她 slips to 他", () => {
    const s = game(2, { cpuSecret: man });
    const first = ask(["pr.ta.m", "v.shi", "n.nande", "pt.ma"], s).state;
    const { events } = ask(["pr.ta.f", "v.you", "n.mao", "pt.ma"], {
      ...first,
      phase: "playerTurn",
    });
    expect(events).toContainEqual({
      type: "grammarSlip",
      point: "gp.pron.gender",
      given: "她",
      expected: "他",
    });
  });

  test("Level 1 slips too, but never rates", () => {
    const first = ask(["pr.ta.m", "v.shi", "n.nvde", "pt.ma"], game(1)).state;
    const { events } = ask(["pr.ta.m", "v.you", "n.mao", "pt.ma"], {
      ...first,
      phase: "playerTurn",
    });
    expect(events.map((e) => e.type)).toEqual(["asked", "grammarSlip"]);
  });

  test("你 is rejected and the turn is not used", () => {
    const s = game();
    const { state, events } = ask(["pr.ni", "v.you", "n.gou", "pt.ma"], s);
    expect(rejected(events)).toMatchObject({ reason: "grammar" });
    expect(state.phase).toBe("playerTurn");
    expect(state.lastFeedback).toEqual([{ messageKey: "gp.pron.you", params: {} }]);
  });
});

describe("each wrong verb for each noun gives the rule for the right verb", () => {
  const cases = nouns.flatMap((n) =>
    verbs
      .filter((v) => v !== n.verb && !n.offBoardVerbs?.includes(v))
      .map((v) => [n.id, v, n] as const),
  );
  test("25 cases (14 nouns × 2 wrong verbs, less 有 with the 3 jobs, which is off board)", () => {
    expect(cases).toHaveLength(25);
  });
  test.each(cases)("%s with %s", (_, v, n) => {
    const { events } = ask(["pr.ta.f", v, n.id, "pt.ma"]);
    expect(rejected(events)).toEqual({
      type: "rejected",
      reason: "grammar",
      errors: [
        {
          slot: "verb",
          given: hanzi.get(v),
          expected: hanzi.get(n.verb),
          rule: `verb.${n.verb.slice(2)}`,
        },
      ],
    });
  });
});

describe("有 with a job is off board (D11)", () => {
  test.each(nouns.filter((n) => n.category === "job").map((n) => [n.hanzi, n] as const))(
    "他有%s吗？",
    (_, n) => {
      const s = game();
      const { state, events } = ask(["pr.ta.m", "v.you", n.id, "pt.ma"], s);
      expect(events).toEqual([{ type: "rejected", reason: "offBoard" }]);
      expect(state.lastFeedback).toEqual([
        {
          messageKey: "offBoard.youJob",
          params: { given: `他有${n.hanzi}吗？`, gloss: n.gloss, pron: "他", obj: n.hanzi },
        },
      ]);
      expect(state.ratedThisTurn).toEqual(s.ratedThisTurn);
    },
  );

  test("but grammar comes first: 他有老师 without 吗 is a grammar error", () => {
    expect(rejected(ask(["pr.ta.m", "v.you", "n.laoshi"]).events)?.reason).toBe("grammar");
  });
});

describe("missing 吗 (gp.ma)", () => {
  test("他有狗", () => {
    const { state, events } = ask(["pr.ta.m", "v.you", "n.gou"]);
    expect(rejected(events)?.errors).toEqual([
      { slot: "ma", given: "他有狗", expected: "他有狗吗？", rule: "gp.ma" },
    ]);
    expect(events).toContainEqual({
      type: "grammarSlip",
      point: "gp.ma",
      given: "他有狗",
      expected: "他有狗吗？",
    });
    expect(state.lastFeedback).toEqual([{ messageKey: "gp.ma", params: {} }]);
  });

  test("without 吗 the remaining order still counts: 狗他有", () => {
    expect(rejected(ask(["n.gou", "pr.ta.m", "v.you"]).events)?.errors?.map((e) => e.rule)).toEqual(
      ["gp.ma", "gp.order"],
    );
  });
});

describe("word order: each of the 23 wrong orders of 4 tokens (gp.order)", () => {
  const right = ["pr.ta.m", "v.you", "n.gou", "pt.ma"];
  const perms = (xs: string[]): string[][] =>
    xs.length <= 1
      ? [xs]
      : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
  const wrong = perms(right).filter((p) => p.join() !== right.join());

  test("23 of them", () => expect(wrong).toHaveLength(23));

  test.each(wrong.map((p) => [p.map((id) => hanzi.get(id)).join(""), p] as const))(
    "%s",
    (given, p) => {
      const { state, events } = ask(p);
      expect(rejected(events)?.errors).toEqual([
        { slot: "order", given, expected: "他有狗吗？", rule: "gp.order" },
      ]);
      expect(state.lastFeedback).toEqual([
        { messageKey: "gp.order", params: { expected: "他有狗吗？" } },
      ]);
      expect(events.some((e) => e.type === "rating")).toBe(false);
    },
  );

  test("wrong order and wrong verb: both reported, the verb rated", () => {
    const { events } = ask(["pr.ta.m", "n.gou", "v.shi", "pt.ma"]);
    expect(rejected(events)?.errors?.map((e) => e.rule)).toEqual(["verb.you", "gp.order"]);
    expect(events.filter((e) => e.type === "rating")).toHaveLength(1);
  });
});

describe("shape errors (nothing logged, no rating)", () => {
  test.each([
    ["empty", []],
    ["noPron", ["v.you", "n.gou", "pt.ma"]],
    ["noVerb", ["pr.ta.m", "n.gou", "pt.ma"]],
    ["noObj", ["pr.ta.m", "v.you", "pt.ma"]],
    ["extra", ["pr.ta.m", "pr.ta.f", "v.you", "n.gou", "pt.ma"]],
    ["extra", ["pr.ta.m", "v.you", "v.shi", "n.gou", "pt.ma"]],
    ["extra", ["pr.ta.m", "v.you", "n.gou", "n.mao", "pt.ma"]],
    ["extra", ["pr.ta.m", "v.you", "n.gou", "pt.ma", "pt.ma"]],
  ] as const)("%s: %j", (kind, tokens) => {
    const s = game();
    const { state, events } = ask([...tokens], s);
    expect(events).toEqual([{ type: "rejected", reason: "shape", shape: { kind } }]);
    expect(state.lastFeedback).toEqual([{ messageKey: `shape.${kind}`, params: {} }]);
    expect({ ...state, lastFeedback: undefined }).toEqual({ ...s, lastFeedback: undefined });
  });
});

describe("unknown ids", () => {
  test.each([["n.chef"], ["a.you"], ["c.lili"]])("%s", (id) => {
    expect(rejected(ask(["pr.ta.m", "v.you", id, "pt.ma"]).events)?.reason).toBe("unknownId");
  });
});

describe("duplicates (spec 2)", () => {
  test("the same question with the other pronoun is a duplicate", () => {
    const first = ask(["pr.ta.m", "v.you", "n.gou", "pt.ma"]).state;
    const s = { ...first, phase: "playerTurn" as const };
    const { state, events } = ask(["pr.ta.f", "v.you", "n.gou", "pt.ma"], s);
    expect(events).toEqual([{ type: "rejected", reason: "duplicate" }]);
    expect(state.lastFeedback).toEqual([
      { messageKey: "duplicate", params: { answerText: "没有，他没有狗。" } },
    ]);
    expect(state.history).toEqual(s.history);
  });

  test("a question the CPU asked is allowed", () => {
    const s = game(2, {
      history: [
        {
          by: "cpu",
          key: "v.you|n.gou",
          pron: "pr.ta.m",
          text: "他有狗吗？",
          answer: true,
          answerText: "有，他有狗。",
        },
      ],
    });
    expect(ask(["pr.ta.m", "v.you", "n.gou", "pt.ma"], s).state.phase).toBe("playerReview");
  });

  test("是男的吗 after 是女的吗 is a different question", () => {
    const first = ask(["pr.ta.f", "v.shi", "n.nvde", "pt.ma"]).state;
    const { state } = ask(["pr.ta.f", "v.shi", "n.nande", "pt.ma"], {
      ...first,
      phase: "playerTurn",
    });
    expect(state.history.at(-1)?.answerText).toBe("不是，她不是男的。");
  });
});

test("Level 1 accepted questions are not rated (invariant 11)", () => {
  const { events } = ask(["pr.ta.m", "v.you", "n.gou", "pt.ma"], game(1));
  expect(events.map((e) => e.type)).toEqual(["asked"]);
});

test("a second rating for the same card in a turn is dropped (invariant 8)", () => {
  const s = game();
  const wrong = ask(["pr.ta.m", "v.shi", "n.gou", "pt.ma"], s).state;
  const { events } = ask(["pr.ta.m", "v.you", "n.gou", "pt.ma"], wrong);
  expect(events.filter((e) => e.type === "rating")).toEqual([]);
});
