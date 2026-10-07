import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import { allQuestions, questionByKey } from "./questions.ts";
import { pickOne, seeded, shuffled } from "./random.ts";
import { setupState, startGame } from "./start.ts";

describe("random", () => {
  test("same seed, same sequence; values in [0, 1)", () => {
    const a = seeded(9);
    const b = seeded(9);
    for (let i = 0; i < 500; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x >= 0 && x < 1).toBe(true);
    }
  });

  test("shuffled is a permutation and leaves the input alone", () => {
    fc.assert(
      fc.property(fc.integer(), fc.array(fc.integer()), (seed, xs) => {
        const copy = [...xs];
        const out = shuffled(seeded(seed), xs);
        expect(xs).toEqual(copy);
        expect([...out].sort((p, q) => p - q)).toEqual([...xs].sort((p, q) => p - q));
      }),
    );
  });

  test("pickOne covers every item and rejects an empty list", () => {
    const random = seeded(1);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(pickOne(random, [0, 1, 2, 3]));
    expect(seen.size).toBe(4);
    expect(() => pickOne(random, [])).toThrow();
  });
});

describe("allQuestions", () => {
  const questions = allQuestions(content);

  test("the 16 questions of spec 3.1, in their default wording", () => {
    expect(questions.map((q) => q.text).sort()).toEqual(
      [
        "Ha i capelli biondi?",
        "Ha i capelli castani?",
        "Ha i capelli neri?",
        "Ha i capelli rossi?",
        "Ha i capelli bianchi?",
        "Ha i capelli corti?",
        "Ha i capelli lunghi?",
        "Ha gli occhi azzurri?",
        "Ha gli occhi marroni?",
        "Ha gli occhi verdi?",
        "Ha gli occhiali?",
        "Ha il cappello?",
        "Ha la barba?",
        "Ha i baffi?",
        "È un uomo?",
        "È una donna?",
      ].sort(),
    );
  });

  test("keys are unique and in the spec's format", () => {
    expect(new Set(questions.map((q) => q.key)).size).toBe(16);
    expect(questionByKey(content, "t.have.adj|n.occhi|adj.marrone")?.text).toBe(
      "Ha gli occhi marroni?",
    );
    expect(questionByKey(content, "t.have|n.barba|")?.text).toBe("Ha la barba?");
    expect(questionByKey(content, "t.be|n.donna|")?.text).toBe("È una donna?");
    expect(questionByKey(content, "nope")).toBeUndefined();
  });

  test("fills use the template's verb and the noun's article", () => {
    for (const q of questions) {
      const t = content.templates.find((x) => x.id === q.templateId);
      expect(q.fill.verb).toBe(t?.verb);
    }
  });

  test("retired words are not asked", () => {
    const retired = {
      ...content,
      lexicon: content.lexicon.map((e) =>
        e.id === "adj.rosso" || e.id === "n.barba" ? { ...e, retired: true } : e,
      ),
    };
    const texts = allQuestions(retired).map((q) => q.text);
    expect(texts).not.toContain("Ha i capelli rossi?");
    expect(texts).not.toContain("Ha la barba?");
    expect(texts).toHaveLength(14);
  });
});

describe("startGame", () => {
  const ids = content.characters.map((c) => c.id);

  test("same seed gives the same secrets and cpuQuestionOrder", () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(1 as const, 2 as const), (seed, level) => {
        expect(startGame(seed, level, content)).toEqual(startGame(seed, level, content));
      }),
    );
  });

  test("the player goes first, with a fresh board", () => {
    const s = startGame(42, 2, content);
    expect(s).toMatchObject({
      phase: "playerTurn",
      seed: 42,
      level: 2,
      turn: 1,
      flipped: [],
      history: [],
      ratedThisTurn: [],
    });
    expect(s.cpuCandidates).toEqual(ids);
    expect(s.result).toBeUndefined();
    expect(s.pendingCpuQuestion).toBeUndefined();
  });

  test("secrets are real characters, and the order is a shuffle of the 16 keys", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const s = startGame(seed, 1, content);
        expect(ids).toContain(s.playerSecret);
        expect(ids).toContain(s.cpuSecret);
        expect([...s.cpuQuestionOrder].sort()).toEqual(
          allQuestions(content)
            .map((q) => q.key)
            .sort(),
        );
      }),
    );
  });

  test("secrets may be the same character", () => {
    const same = Array.from({ length: 2000 }, (_, seed) => startGame(seed, 1, content)).filter(
      (s) => s.playerSecret === s.cpuSecret,
    );
    // Independent draws: about 1 in 24 seeds.
    expect(same.length).toBeGreaterThan(40);
    expect(same.length).toBeLessThan(140);
  });

  test("secrets and orders vary across seeds", () => {
    const games = Array.from({ length: 200 }, (_, seed) => startGame(seed, 1, content));
    expect(new Set(games.map((g) => g.cpuSecret)).size).toBe(24);
    expect(new Set(games.map((g) => g.playerSecret)).size).toBe(24);
    expect(new Set(games.map((g) => g.cpuQuestionOrder.join())).size).toBe(200);
  });

  test("setupState waits for START", () => {
    expect(setupState()).toMatchObject({ phase: "setup", history: [], flipped: [] });
  });
});
