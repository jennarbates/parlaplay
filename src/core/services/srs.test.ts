import fc from "fast-check";
import { rowsFor } from "../../languages/it/store/rows.ts";
import { cardIds } from "../../languages/it/cards.ts";
import { Rating } from "ts-fsrs";
import { describe, expect, test } from "vitest";
import { content } from "../../languages/it/content/index.ts";
import {
  allQuestions,
  step,
  type Action,
  type GameEvent,
  type GameState,
} from "../../languages/it/engine/index.ts";
import { evaluate } from "../../languages/it/engine/meaning.ts";
import { startGame } from "../../languages/it/engine/start.ts";
import { type ReviewLogRow } from "../store/progressStore.ts";
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

const ids = cardIds();
const t0 = new Date("2026-10-06T10:00:00Z");
const row = (
  over: Partial<ReviewLogRow> & Pick<ReviewLogRow, "lexiconId" | "rating">,
  minutes = 0,
): ReviewLogRow => ({
  id: crypto.randomUUID(),
  language: "it",
  gameId: "g",
  direction: "produce",
  localDay: "2026-10-06",
  createdAt: new Date(t0.getTime() + minutes * 60_000).toISOString(),
  ...over,
});

describe("cards (CHI-072)", () => {
  test("36 cards: 18 lemmas × 2 directions", () => {
    const cards = emptyCards(ids);
    expect(cards.size).toBe(36);
    const lemmas = new Set([...cards.values()].map((c) => c.lexiconId));
    expect(lemmas.size).toBe(18);
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
    const cards = replay(ids, [row({ lexiconId: "adj.biondo", rating: "slip" })]);
    expect(cards.get("adj.biondo|produce")?.reviews).toBe(0);
  });

  test("replay goes in createdAt order, whatever order the log arrives in", () => {
    const log = [
      row({ lexiconId: "n.barba", rating: "again" }, 0),
      row({ lexiconId: "n.barba", rating: "good" }, 60 * 24),
      row({ lexiconId: "n.barba", rating: "hard" }, 60 * 24 * 3),
    ];
    const inOrder = replay(ids, log);
    const shuffled = replay(ids, [log[2], log[0], log[1]] as ReviewLogRow[]);
    expect(shuffled).toEqual(inOrder);
  });

  test("good pushes the next review further out than again", () => {
    const good = replay(ids, [row({ lexiconId: "n.occhi", rating: "good" })]).get(
      "n.occhi|produce",
    );
    const again = replay(ids, [row({ lexiconId: "n.occhi", rating: "again" })]).get(
      "n.occhi|produce",
    );
    expect(good?.card.due.getTime()).toBeGreaterThan(again?.card.due.getTime() ?? Infinity);
  });

  test("a card unknown to the current ids (removed word) is still replayed", () => {
    const cards = replay(ids, [row({ lexiconId: "n.cane", rating: "good" })]);
    expect(cards.get("n.cane|produce")?.reviews).toBe(1);
  });

  test("isDue: reviewed cards due by the end of the day", () => {
    const cards = replay(ids, [
      row({ lexiconId: "n.donna", direction: "recognize", rating: "again" }),
    ]);
    const state = cards.get("n.donna|recognize");
    if (!state) throw new Error("no card");
    expect(isDue(state, endOfLocalDay(t0))).toBe(true);
    const unseen = cards.get("n.uomo|recognize");
    if (!unseen) throw new Error("no card");
    expect(isDue(unseen, endOfLocalDay(new Date(2099, 0, 1)))).toBe(false);
  });
});

describe("rebuilding from the log equals the incremental state (CHI-073)", () => {
  const lemmas = [...ids];
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
        const incremental = [...log].sort(logOrder).reduce(applyRow, emptyCards(ids));
        expect(replay(ids, log)).toEqual(incremental);
        // And it does not depend on the order rows arrive in, even with equal timestamps.
        expect(replay(ids, [...log].reverse())).toEqual(incremental);
        expect(
          replay(ids, [...log.filter((_, i) => i % 2 === 1), ...log.filter((_, i) => i % 2 === 0)]),
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
    return { state: s, log, cards: replay(ids, log) };
  }
  const reviewed = (cards: ReturnType<typeof replay>) =>
    [...cards.values()]
      .filter((c) => c.reviews > 0)
      .map((c) => `${c.lexiconId}|${c.direction}|${c.card.state}`);
  const g2 = { ...startGame(1, 2, content), cpuSecret: "c.giulia", playerSecret: "c.marco" };
  const g1 = { ...g2, level: 1 as const };
  const ask = (fill: { verb: string; art: string; noun: string; adj?: string }): Action => ({
    type: "ASK",
    templateId: fill.adj
      ? "t.have.adj"
      : fill.noun === "n.donna" || fill.noun === "n.uomo"
        ? "t.be"
        : "t.have",
    fill,
  });
  const capelli = { verb: "v.ha", art: "art.i", noun: "n.capelli", adj: "adj.biondo#mp" };

  test("Level 2 accepted, right form: produce noun and adjective good", () => {
    const { log } = play(g2, [ask(capelli)]);
    expect(log.map((r) => [r.lexiconId, r.direction, r.rating])).toEqual([
      ["n.capelli", "produce", "good"],
      ["adj.biondo", "produce", "good"],
    ]);
  });

  test("Level 2 accepted with a slip: noun good, adjective not rated, slip row logged", () => {
    const { log, cards } = play(g2, [ask({ ...capelli, adj: "adj.biondo#fp" })]);
    expect(log.map((r) => [r.lexiconId, r.rating])).toEqual([
      ["n.capelli", "good"],
      ["adj.biondo", "slip"],
    ]);
    expect(cards.get("adj.biondo|produce")?.reviews).toBe(0);
  });

  test("Level 2 rejected for grammar: produce noun again", () => {
    const { log } = play(g2, [ask({ ...capelli, art: "art.gli" })]);
    expect(log.map((r) => [r.lexiconId, r.direction, r.rating])).toEqual([
      ["n.capelli", "produce", "again"],
    ]);
  });

  test.each([
    ["a Level 1 question", g1, [ask(capelli)]],
    ["nonsense", g2, [ask({ ...capelli, adj: "adj.verde#mp" })]],
    ["a shape error (dispatches nothing)", g2, []],
  ] as const)("%s: no rating", (_, start, actions) => {
    expect(play(start, [...actions]).log).toEqual([]);
  });

  test("a duplicate: no rating", () => {
    const first = play(g2, [
      ask(capelli),
      { type: "END_TURN" },
      { type: "ANSWER", value: true, hintShown: true },
      { type: "END_TURN" },
    ]);
    const again = play(first.state, [ask(capelli)]);
    expect(again.log).toEqual([]);
  });

  function cpuAsking(start: GameState) {
    const s = play(start, [
      ask({ verb: "v.e", art: "art.una", noun: "n.donna" }),
      { type: "END_TURN" },
    ]).state;
    const q = allQuestions(content).find((x) => x.key === s.pendingCpuQuestion);
    const marco = content.characters.find((c) => c.id === "c.marco");
    if (!q || !marco) throw new Error("no CPU question");
    return { s, q, truth: evaluate(q.asked, marco.attrs) };
  }

  test.each([1, 2] as const)(
    "level %i, CPU question answered right without hint: recognize hard",
    (level) => {
      const { s, q, truth } = cpuAsking({ ...g2, level });
      const { log, cards } = play(s, [{ type: "ANSWER", value: truth, hintShown: false }]);
      const words = [q.fill.noun, ...(q.fill.adj ? [q.fill.adj.split("#")[0]] : [])];
      expect(log.map((r) => [r.lexiconId, r.direction, r.rating])).toEqual(
        words.map((w) => [w, "recognize", "hard"]),
      );
      for (const w of words) expect(cards.get(`${w}|recognize`)?.reviews).toBe(1);
    },
  );

  test("CPU question answered wrongly: recognize again, with the answer.wrong detail", () => {
    const { s, truth } = cpuAsking(g2);
    const { log } = play(s, [{ type: "ANSWER", value: !truth, hintShown: false }]);
    expect(log.length).toBeGreaterThan(0);
    for (const r of log) {
      expect(r).toMatchObject({
        direction: "recognize",
        rating: "again",
        detail: { slot: "answer", rule: "answer.wrong" },
      });
    }
  });

  test("hint shown before answering: no rating", () => {
    const { s } = cpuAsking({ ...g2, level: 1 });
    expect(play(s, [{ type: "ANSWER", value: true, hintShown: true }]).log).toEqual([]);
  });

  test("replayed cards reflect the ratings", () => {
    const { cards } = play(g2, [ask(capelli)]);
    expect(reviewed(cards).sort()).toEqual(["adj.biondo|produce|1", "n.capelli|produce|1"]);
  });
});
