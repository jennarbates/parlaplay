import { describe, expect, test } from "vitest";
import type { GameEvent } from "../engine/index.ts";
import { localDay } from "../../../core/services/localDay.ts";
import { rowsFor } from "./rows.ts";

const at = new Date(2026, 9, 6, 23, 30); // 23:30 local time on 6 October
let n = 0;
const ids = () => `id-${++n}`;

describe("rowsFor (CHI-070)", () => {
  test("each rating becomes a row with a client id, gameId, localDay and createdAt", () => {
    const events: GameEvent[] = [
      { type: "asked", by: "player", key: "k", answer: true },
      { type: "rating", lexiconId: "n.capelli", direction: "produce", rating: "good" },
      {
        type: "rating",
        lexiconId: "n.occhi",
        direction: "recognize",
        rating: "again",
        detail: { slot: "answer", given: "Sì", expected: "No", rule: "answer.wrong" },
      },
    ];
    n = 0;
    expect(rowsFor("g1", events, at, ids)).toEqual([
      {
        id: "id-1",
        gameId: "g1",
        lexiconId: "n.capelli",
        direction: "produce",
        rating: "good",
        localDay: "2026-10-06",
        createdAt: at.toISOString(),
      },
      {
        id: "id-2",
        gameId: "g1",
        lexiconId: "n.occhi",
        direction: "recognize",
        rating: "again",
        detail: { slot: "answer", given: "Sì", expected: "No", rule: "answer.wrong" },
        localDay: "2026-10-06",
        createdAt: at.toISOString(),
      },
    ]);
  });

  test("a grammar slip becomes a slip row keyed by the grammar point (spec 6, 7.1)", () => {
    const rows = rowsFor(
      "g1",
      [
        { type: "grammarSlip", point: "gp.order", given: "他狗有吗", expected: "他有狗吗？" },
        { type: "grammarSlip", point: "gp.neg.mei", given: "不有", expected: "没有" },
      ],
      at,
    );
    expect(rows).toEqual([
      expect.objectContaining({
        lexiconId: "gp.order",
        direction: "produce",
        rating: "slip",
        detail: { slot: "order", given: "他狗有吗", expected: "他有狗吗？", rule: "gp.order" },
      }),
      // Answer-side slips are filed under recognize.
      expect.objectContaining({
        lexiconId: "gp.neg.mei",
        direction: "recognize",
        rating: "slip",
        detail: { slot: "answer", given: "不有", expected: "没有", rule: "gp.neg.mei" },
      }),
    ]);
  });

  test("events that are not learning data make no rows", () => {
    expect(
      rowsFor(
        "g1",
        [
          { type: "asked", by: "cpu", key: "k", answer: false },
          { type: "rejected", reason: "offBoard" },
          { type: "gameOver", result: "won" },
        ],
        at,
      ),
    ).toEqual([]);
  });

  test("ids are real uuids by default, all different", () => {
    const rows = rowsFor(
      "g",
      Array.from({ length: 50 }, (): GameEvent => ({
        type: "rating",
        lexiconId: "n.x",
        direction: "produce",
        rating: "good",
      })),
      at,
    );
    expect(new Set(rows.map((r) => r.id)).size).toBe(50);
    for (const r of rows) expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("localDay is the learner's own date, not UTC", () => {
    expect(localDay(new Date(2026, 0, 2, 0, 5))).toBe("2026-01-02");
    expect(localDay(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
});
