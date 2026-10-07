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
  gameId: "g",
  lexiconId,
  direction: "produce",
  rating,
  ...(given !== undefined && { detail: { slot: "art", given, expected, rule: "r" } }),
  localDay: "2026-10-06",
  createdAt: `2026-10-06T${at}:00.000Z`,
});

test("groups by word, newest word first, counting repeated mistakes", () => {
  const groups = groupMistakes([
    row("n.capelli", "again", "gli", "i", "10:00"),
    row("n.barba", "again", "il", "la", "10:05"),
    row("n.capelli", "again", "gli", "i", "10:10"),
    row("adj.biondo", "slip", "bionde", "biondi", "10:02"),
    row("n.capelli", "again", "la", "i", "10:03"),
  ]);
  expect(groups.map((g) => g.lexiconId)).toEqual(["n.capelli", "n.barba", "adj.biondo"]);
  expect(groups[0]?.pairs).toEqual([
    { given: "gli", expected: "i", count: 2 },
    { given: "la", expected: "i", count: 1 },
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
