import fc from "fast-check";
import { Rating } from "ts-fsrs";
import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import { parseKey, step, type Action, type GameEvent, type GameState } from "../engine/index.ts";
import { startGame } from "../engine/start.ts";
import { rowsFor, type ReviewLogRow } from "../store/progressStore.ts";
import {
  applyRow,
  cardKey,
  emptyCards,
  endOfLocalDay,
  grades,
  isDue,
  logOrder,
  replay,
} from "./srs.ts";

const lexicon = content.lexicon;
const t0 = new Date("2026-10-06T10:00:00Z");
const row = (
  over: Partial<ReviewLogRow> & Pick<ReviewLogRow, "lexiconId" | "rating">,
  minutes = 0,
): ReviewLogRow => ({
  id: crypto.randomUUID(),
  gameId: "g",
  direction: "produce",
  localDay: "2026-10-06",
  createdAt: new Date(t0.getTime() + minutes * 60_000).toISOString(),
  ...over,
});

describe("cards (CHI-072)", () => {
  test("28 cards: 14 nouns × 2 directions (spec 6)", () => {
    const cards = emptyCards(lexicon);
    expect(cards.size).toBe(28);
    const lemmas = new Set([...cards.values()].map((c) => c.lexiconId));
    expect(lemmas.size).toBe(14);
    for (const id of lemmas) {
      expect(cards.has(cardKey(id, "recognize"))).toBe(true);
      expect(cards.has(cardKey(id, "produce"))).toBe(true);
    }
    expect([...cards.values()].every((c) => c.reviews === 0)).toBe(true);
  });

  test("easy is never produced: only Again, Hard and Good exist", () => {
    expect(Object.values(grades).sort()).toEqual([Rating.Again, Rating.Hard, Rating.Good].sort());
    expect(Object.values(grades)).not.toContain(Rating.Easy);
  });

  test("slip rows are skipped", () => {
    const cards = replay(lexicon, [row({ lexiconId: "gp.neg.mei", rating: "slip" })]);
    expect(cards.get("gp.neg.mei|produce")).toBeUndefined();
    expect([...cards.values()].every((c) => c.reviews === 0)).toBe(true);
  });

  test("replay goes in createdAt order, whatever order the log arrives in", () => {
    const log = [
      row({ lexiconId: "n.barba", rating: "again" }, 0),
      row({ lexiconId: "n.barba", rating: "good" }, 60 * 24),
      row({ lexiconId: "n.barba", rating: "hard" }, 60 * 24 * 3),
    ];
    const inOrder = replay(lexicon, log);
    const shuffled = replay(lexicon, [log[2], log[0], log[1]] as ReviewLogRow[]);
    expect(shuffled).toEqual(inOrder);
  });

  test("good pushes the next review further out than again", () => {
    const good = replay(lexicon, [row({ lexiconId: "n.occhi", rating: "good" })]).get(
      "n.occhi|produce",
    );
    const again = replay(lexicon, [row({ lexiconId: "n.occhi", rating: "again" })]).get(
      "n.occhi|produce",
    );
    expect(good?.card.due.getTime()).toBeGreaterThan(again?.card.due.getTime() ?? Infinity);
  });

  test("a card unknown to the current lexicon (removed word) is still replayed", () => {
    const cards = replay(lexicon, [row({ lexiconId: "n.cane", rating: "good" })]);
    expect(cards.get("n.cane|produce")?.reviews).toBe(1);
  });

  test("isDue: reviewed cards due by the end of the day", () => {
    const cards = replay(lexicon, [
      row({ lexiconId: "n.donna", direction: "recognize", rating: "again" }),
    ]);
    const state = cards.get("n.donna|recognize");
    if (!state) throw new Error("no card");
    expect(isDue(state, endOfLocalDay(t0))).toBe(true);
    const unseen = cards.get("n.nande|recognize");
    if (!unseen) throw new Error("no card");
    expect(isDue(unseen, endOfLocalDay(new Date(2099, 0, 1)))).toBe(false);
  });
});

describe("rebuilding from the log equals the incremental state (CHI-073)", () => {
  const lemmas = lexicon.filter((e) => e.pos === "noun").map((e) => e.id);
  const logArb = fc.array(
    fc.record({
      lexiconId: fc.constantFrom(...lemmas),
      direction: fc.constantFrom("recognize" as const, "produce" as const),
      rating: fc.constantFrom("again" as const, "hard" as const, "good" as const, "slip" as const),
      gap: fc.integer({ min: 0, max: 60 * 24 * 10 }), // minutes since the previous row
    }),
    { maxLength: 60, size: "max" },
  );

  test("folding rows one at a time in order gives the same cards as replay", () => {
    fc.assert(
      fc.property(logArb, (entries) => {
        let minutes = 0;
        const log = entries.map((e) => {
          minutes += e.gap;
          return row({ lexiconId: e.lexiconId, direction: e.direction, rating: e.rating }, minutes);
        });
        const incremental = [...log].sort(logOrder).reduce(applyRow, emptyCards(lexicon));
        expect(replay(lexicon, log)).toEqual(incremental);
        // And it does not depend on the order rows arrive in, even with equal timestamps.
        expect(replay(lexicon, [...log].reverse())).toEqual(incremental);
        expect(
          replay(lexicon, [
            ...log.filter((_, i) => i % 2 === 1),
            ...log.filter((_, i) => i % 2 === 0),
          ]),
        ).toEqual(incremental);
        const reviews = [...incremental.values()].reduce((n, c) => n + c.reviews, 0);
        expect(reviews).toBe(log.filter((r) => r.rating !== "slip").length);
      }),
      { numRuns: 200 },
    );
  });
});

describe("the spec 6 event → rating table, end to end (CHI-073)", () => {
  // Play actions through the engine, turn the events into log rows, replay them.
  function play(state: GameState, actions: Action[]) {
    let s = state;
    const events: GameEvent[] = [];
    for (const a of actions) {
      const r = step(s, a, content);
      s = r.state;
      events.push(...r.events);
    }
    const log = rowsFor("g", events, t0);
    return { state: s, log, cards: replay(lexicon, log) };
  }
  const reviewed = (cards: ReturnType<typeof replay>) =>
    [...cards.values()]
      .filter((c) => c.reviews > 0)
      .map((c) => `${c.lexiconId}|${c.direction}|${c.card.state}`);
  const woman = content.characters.find((c) => c.attrs.gender === "n.nvde");
  const man = content.characters.find((c) => c.attrs.gender === "n.nande");
  if (!woman || !man) throw new Error("no characters");
  const g2 = { ...startGame(1, 2, content), cpuSecret: woman.id, playerSecret: man.id };
  const g1 = { ...g2, level: 1 as const };
  const ask = (...tokens: string[]): Action => ({ type: "ASK", tokens });
  const dog = ["pr.ta.f", "v.you", "n.gou", "pt.ma"];
  const lines = (log: ReviewLogRow[]) => log.map((r) => [r.lexiconId, r.direction, r.rating]);

  test("Level 2 question accepted: produce the noun, good", () => {
    expect(lines(play(g2, [ask(...dog)]).log)).toEqual([["n.gou", "produce", "good"]]);
  });

  test("Level 2 accepted with a pronoun slip: noun good, plus a slip row", () => {
    const { log, cards } = play(g2, [
      ask("pr.ta.f", "v.shi", "n.nvde", "pt.ma"),
      { type: "END_TURN" },
      { type: "ANSWER", answerId: "a.shi", hintShown: true },
      { type: "END_TURN" },
      ask("pr.ta.m", "v.you", "n.gou", "pt.ma"),
    ]);
    expect(lines(log)).toEqual([
      ["n.nvde", "produce", "good"],
      ["n.gou", "produce", "good"],
      ["gp.pron.gender", "produce", "slip"],
    ]);
    expect(cards.get("gp.pron.gender|produce")).toBeUndefined();
  });

  test("Level 2 rejected for the wrong verb: produce the noun, again", () => {
    const { log } = play(g2, [ask("pr.ta.f", "v.shi", "n.gou", "pt.ma")]);
    expect(lines(log)).toEqual([["n.gou", "produce", "again"]]);
    expect(log[0]?.detail).toEqual({ slot: "verb", given: "是", expected: "有", rule: "verb.you" });
  });

  test("Level 2 rejected for 你, missing 吗 or order: one slip row per grammar point, no rating", () => {
    const { log } = play(g2, [ask("pr.ni", "n.gou", "v.you")]);
    expect(lines(log)).toEqual([
      ["gp.pron.you", "produce", "slip"],
      ["gp.ma", "produce", "slip"],
      ["gp.order", "produce", "slip"],
    ]);
  });

  test.each([
    ["a Level 1 question", g1, [ask(...dog)]],
    ["off board", g2, [ask("pr.ta.f", "v.you", "n.laoshi", "pt.ma")]],
    ["a shape error", g2, [ask("pr.ta.f", "n.gou", "pt.ma")]],
  ] as const)("%s: no rating", (_, start, actions) => {
    expect(play(start, [...actions]).log).toEqual([]);
  });

  test("a duplicate: no rating", () => {
    const first = play(g2, [
      ask(...dog),
      { type: "END_TURN" },
      { type: "ANSWER", answerId: "a.shi", hintShown: true },
      { type: "END_TURN" },
    ]);
    expect(play(first.state, [ask("pr.ta.m", "v.you", "n.gou", "pt.ma")]).log).toEqual([]);
  });

  function cpuAsking(start: GameState) {
    const s = play(start, [ask(...dog), { type: "END_TURN" }]).state;
    const { verbId, nounId } = parseKey(s.pendingCpuQuestion?.key ?? "");
    const verb = lexicon.find((e) => e.id === verbId);
    const noun = lexicon.find((e) => e.id === nounId);
    if (verb?.pos !== "verb" || noun?.pos !== "noun") throw new Error("no CPU question");
    const truth =
      noun.category === "gender" || noun.category === "job" || noun.category === "place"
        ? man?.attrs[noun.category] === noun.id
        : !!noun.attr && !!man?.attrs[noun.attr];
    return {
      s,
      noun: noun.id,
      right: truth ? verb.yes : verb.no,
      wrong: truth ? verb.no : verb.yes,
    };
  }

  test.each([1, 2] as const)("level %i, right without hint: recognize the noun, hard", (level) => {
    const { s, noun, right } = cpuAsking({ ...g2, level });
    const { log, cards } = play(s, [{ type: "ANSWER", answerId: right, hintShown: false }]);
    expect(lines(log)).toEqual([[noun, "recognize", "hard"]]);
    expect(cards.get(`${noun}|recognize`)?.reviews).toBe(1);
  });

  test("wrong polarity: recognize again, with the answer.wrong detail", () => {
    const { s, noun, wrong } = cpuAsking(g2);
    const { log } = play(s, [{ type: "ANSWER", answerId: wrong, hintShown: false }]);
    expect(log).toEqual([
      expect.objectContaining({
        lexiconId: noun,
        direction: "recognize",
        rating: "again",
        detail: expect.objectContaining({ slot: "answer", rule: "answer.wrong" }),
      }),
    ]);
  });

  test("不有: rated as polarity says, plus a recognize slip row", () => {
    const { s } = cpuAsking(g2);
    const { log } = play(s, [{ type: "ANSWER", answerId: "a.buyou", hintShown: false }]);
    expect(
      log.filter((r) => r.rating === "slip").map((r) => [r.lexiconId, r.direction]),
    ).toContainEqual(["gp.neg.mei", "recognize"]);
  });

  test("hint shown before answering: no rating", () => {
    const { s, right } = cpuAsking({ ...g2, level: 1 });
    expect(play(s, [{ type: "ANSWER", answerId: right, hintShown: true }]).log).toEqual([]);
  });

  test("replayed cards reflect the ratings", () => {
    const { cards } = play(g2, [ask(...dog)]);
    expect(reviewed(cards)).toEqual(["n.gou|produce|1"]);
  });
});
