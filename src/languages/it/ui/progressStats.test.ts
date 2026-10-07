import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import { endOfLocalDay, isDue, replay } from "../../../core/services/srs.ts";
import { localDay, type GameRow, type ReviewLogRow } from "../../../core/store/progressStore.ts";
import { progressStats } from "./progressStats.ts";

// Desktop spec DS 3: the definitions and invariants of the dashboard's totals.

const words = content.lexicon.filter((e) => e.pos === "noun" || e.pos === "adj").map((e) => e.id);
const now = new Date(2026, 9, 14, 15, 0); // Wed 14 Oct 2026, 3 pm local

let n = 0;
function row(over: Partial<ReviewLogRow> & { at: Date }): ReviewLogRow {
  const { at, ...rest } = over;
  n += 1;
  return {
    id: `r${String(n).padStart(4, "0")}`,
    gameId: "g1",
    lexiconId: words[0] ?? "",
    direction: "recognize",
    rating: "good",
    localDay: localDay(at),
    createdAt: at.toISOString(),
    ...rest,
  };
}
const game = (id: string, endedAt?: string): GameRow => ({
  id,
  seed: 1,
  level: 1,
  contentVersion: 1,
  startedAt: "2026-10-01T10:00:00.000Z",
  ...(endedAt ? { endedAt, result: "won" as const } : {}),
});
const daysAgo = (d: number, hour = 12) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, hour);

// What the Due list on the Progress screen shows for the same moment.
const dueListLength = (log: ReviewLogRow[], at: Date) =>
  [...replay(content.lexicon, log).values()]
    .filter((c) => c.reviews > 0)
    .filter((c) => isDue(c, endOfLocalDay(at))).length;

test("with empty data, all zeros", () => {
  expect(progressStats({ games: [], reviewLog: [] }, now)).toEqual({
    wordsSeen: 0,
    dueToday: 0,
    mistakesThisWeek: 0,
    roundsPlayed: 0,
  });
});

test("a learner who has played 3 rounds", () => {
  const [a, b, c] = words;
  const log = [
    row({ lexiconId: a, at: daysAgo(10) }),
    row({ lexiconId: a, direction: "produce", rating: "again", at: daysAgo(10) }),
    row({ lexiconId: b, rating: "again", at: daysAgo(6) }),
    row({ lexiconId: b, rating: "slip", at: daysAgo(2) }),
    row({ lexiconId: c, rating: "hard", at: daysAgo(0, 9) }),
    row({ lexiconId: c, rating: "again", at: daysAgo(0, 10) }),
  ];
  const stats = progressStats(
    {
      games: [
        game("g1", "2026-10-04T10:00:00.000Z"),
        game("g2", "2026-10-08T10:00:00.000Z"),
        game("g3", "2026-10-14T10:00:00.000Z"),
        game("g4"), // still in progress
      ],
      reviewLog: log,
    },
    now,
  );
  expect(stats.wordsSeen).toBe(3);
  // 6 days ago is inside the week, today included; 10 days ago is not.
  expect(stats.mistakesThisWeek).toBe(3);
  expect(stats.roundsPlayed).toBe(3);
  expect(stats.dueToday).toBe(dueListLength(log, now));
  expect(stats.dueToday).toBeGreaterThan(0);
});

test("a mistake from 7 local days ago does not count", () => {
  const log = [
    row({ rating: "again", at: daysAgo(7, 23) }),
    row({ rating: "slip", at: daysAgo(6, 0) }),
  ];
  expect(progressStats({ games: [], reviewLog: log }, now).mistakesThisWeek).toBe(1);
});

// Any log the app could write, over the last month.
const anyLog = fc.array(
  fc.record({
    lexiconId: fc.constantFrom(...words),
    direction: fc.constantFrom("recognize", "produce") as fc.Arbitrary<ReviewLogRow["direction"]>,
    rating: fc.constantFrom("again", "hard", "good", "slip") as fc.Arbitrary<
      ReviewLogRow["rating"]
    >,
    day: fc.integer({ min: 0, max: 30 }),
    hour: fc.integer({ min: 0, max: 23 }),
  }),
  { maxLength: 60 },
);

describe("invariants", () => {
  test("0 ≤ dueToday ≤ reviewed cards ≤ 2 × wordsSeen, and it matches the Due list", () => {
    fc.assert(
      fc.property(anyLog, (rows) => {
        const log = rows.map((r) => row({ ...r, at: daysAgo(r.day, r.hour) }));
        const s = progressStats({ games: [], reviewLog: log }, now);
        const reviewed = [...replay(content.lexicon, log).values()].filter((c) => c.reviews > 0);
        expect(s.dueToday).toBeGreaterThanOrEqual(0);
        expect(s.dueToday).toBeLessThanOrEqual(reviewed.length);
        expect(reviewed.length).toBeLessThanOrEqual(2 * s.wordsSeen);
        expect(s.dueToday).toBe(dueListLength(log, now));
      }),
    );
  });

  test("mistakesThisWeek never counts a row older than 7 local days", () => {
    fc.assert(
      fc.property(anyLog, (rows) => {
        const log = rows.map((r) => row({ ...r, at: daysAgo(r.day, r.hour) }));
        const recent = rows.filter(
          (r) => r.day <= 6 && (r.rating === "again" || r.rating === "slip"),
        );
        expect(progressStats({ games: [], reviewLog: log }, now).mistakesThisWeek).toBe(
          recent.length,
        );
      }),
    );
  });
});
