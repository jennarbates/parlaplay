import { expect, test } from "vitest";
import type { ReviewLogRow } from "../../../core/store/progressStore.ts";
import { groupMistakes } from "./mistakes.ts";

const row = (
  lexiconId: string,
  rating: ReviewLogRow["rating"],
  given: string | undefined,
  expected: string,
  at: string,
): ReviewLogRow => ({
  id: `${lexiconId}${at}${given}`,
  language: "zh",
  gameId: "g",
  lexiconId,
  direction: "produce",
  rating,
  ...(given !== undefined && { detail: { slot: "verb", given, expected, rule: "r" } }),
  localDay: "2026-10-06",
  createdAt: `2026-10-06T${at}:00.000Z`,
});

test("groups by noun or grammar point, newest first, counting repeated mistakes", () => {
  const groups = groupMistakes([
    row("n.gou", "again", "是", "有", "10:00"),
    row("n.jia", "again", "有", "在", "10:05"),
    row("n.gou", "again", "是", "有", "10:10"),
    row("gp.neg.mei", "slip", "不有", "没有", "10:02"),
    row("n.gou", "again", "在", "有", "10:03"),
  ]);
  expect(groups.map((g) => g.lexiconId)).toEqual(["n.gou", "n.jia", "gp.neg.mei"]);
  expect(groups[0]?.pairs).toEqual([
    { given: "是", expected: "有", count: 2 },
    { given: "在", expected: "有", count: 1 },
  ]);
});

test("only again rows with detail and slip rows count", () => {
  expect(
    groupMistakes([
      row("n.a", "good", "x", "y", "10:00"),
      row("n.b", "hard", "x", "y", "10:00"),
      row("n.c", "again", undefined, "y", "10:00"),
    ]),
  ).toEqual([]);
});
