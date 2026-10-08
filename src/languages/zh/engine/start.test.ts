import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import { allQuestions, questionByKey, questionTokens } from "./questions.ts";
import { pickOne, seeded, shuffled } from "./random.ts";
import { setupState, startGame } from "./start.ts";

describe("startGame (spec 2)", () => {
  test("the player goes first, on turn 1, with every card up", () => {
    const s = startGame(1, 2, content);
    expect(s).toMatchObject({
      phase: "playerTurn",
      turn: 1,
      level: 2,
      flipped: [],
      history: [],
      ratedThisTurn: [],
    });
    expect(s.cpuCandidates).toHaveLength(24);
  });

  test("the same seed gives the same game", () => {
    expect(startGame(42, 1, content)).toEqual(startGame(42, 1, content));
  });

  test("secrets are drawn independently and may be the same character", () => {
    const pairs = Array.from({ length: 500 }, (_, seed) => startGame(seed, 1, content));
    expect(pairs.some((s) => s.cpuSecret === s.playerSecret)).toBe(true);
    expect(new Set(pairs.map((s) => s.cpuSecret)).size).toBe(24);
    expect(new Set(pairs.map((s) => s.playerSecret)).size).toBe(24);
  });

  test("the CPU's question order is a shuffle of the 14 questions", () => {
    const s = startGame(9, 1, content);
    expect([...s.cpuQuestionOrder].sort()).toEqual(
      allQuestions(content)
        .map((q) => q.key)
        .sort(),
    );
    expect(startGame(10, 1, content).cpuQuestionOrder).not.toEqual(s.cpuQuestionOrder);
  });

  test("setupState waits for START", () => {
    expect(setupState()).toMatchObject({ phase: "setup", history: [], flipped: [] });
  });
});

describe("questions (spec 3.1)", () => {
  test("14, one per noun, asked with its verb", () => {
    expect(allQuestions(content).map((q) => q.key)).toEqual([
      "v.shi|n.nande",
      "v.shi|n.nvde",
      "v.shi|n.laoshi",
      "v.shi|n.xuesheng",
      "v.shi|n.yisheng",
      "v.you|n.gou",
      "v.you|n.mao",
      "v.you|n.shouji",
      "v.you|n.shu",
      "v.you|n.diannao",
      "v.zai|n.jia",
      "v.zai|n.xuexiao",
      "v.zai|n.yiyuan",
      "v.zai|n.fandian",
    ]);
  });

  test("lookup by key, and the tokens Level 1 sends", () => {
    const q = questionByKey(content, "v.you|n.gou");
    expect(q && questionTokens(q, "pr.ta.f")).toEqual(["pr.ta.f", "v.you", "n.gou", "pt.ma"]);
    expect(questionByKey(content, "v.you|n.laoshi")).toBeUndefined();
  });

  test("a retired noun is no longer asked", () => {
    const retired = {
      ...content,
      lexicon: content.lexicon.map((e) => (e.id === "n.mao" ? { ...e, retired: true } : e)),
    };
    expect(allQuestions(retired)).toHaveLength(13);
  });
});

describe("random", () => {
  test("seeded is deterministic", () => {
    const a = seeded(3);
    const b = seeded(3);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  test("pickOne refuses an empty list", () => {
    expect(() => pickOne(seeded(1), [])).toThrow();
  });

  test("shuffled keeps every item", () => {
    expect(shuffled(seeded(1), [1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});
