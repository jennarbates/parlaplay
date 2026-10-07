import { describe, expect, test } from "vitest";
import { checkInvariants, questions, yesCount } from "../../src/languages/it/content/invariants.ts";
import type { Attrs } from "../../src/languages/it/content/schemas.ts";
import { generateCharacters } from "./generate-characters.ts";

const valid = generateCharacters(3).characters;
const withAttrs = (i: number, attrs: Partial<Attrs>) =>
  valid.map((c, j) => (j === i ? { ...c, attrs: { ...c.attrs, ...attrs } } : c));

test("16 questions, as in spec 3.1", () => {
  expect(questions).toHaveLength(16);
  expect(new Set(questions.map((q) => q.label)).size).toBe(16);
});

test("a valid set has no problems", () => {
  expect(checkInvariants(valid)).toEqual([]);
});

describe("each invariant is caught", () => {
  test("wrong count", () => {
    expect(checkInvariants(valid.slice(1))).toContain("23 characters, expected 24");
  });

  test("two characters with the same attributes", () => {
    const copy = valid.map((c, i) => (i === 1 ? { ...c, attrs: valid[0]?.attrs ?? c.attrs } : c));
    expect(checkInvariants(copy)).toContain("characters 0 and 1 have the same 8 attributes");
  });

  test("a woman with a beard", () => {
    const i = valid.findIndex((c) => c.attrs.gender === "n.donna");
    expect(checkInvariants(withAttrs(i, { beard: true }))).toContain(
      `character ${i} is a woman with a beard or mustache`,
    );
  });

  test("a woman with a mustache", () => {
    const i = valid.findIndex((c) => c.attrs.gender === "n.donna");
    expect(checkInvariants(withAttrs(i, { mustache: true }))).toContain(
      `character ${i} is a woman with a beard or mustache`,
    );
  });

  test("13 men and 11 women", () => {
    const i = valid.findIndex((c) => c.attrs.gender === "n.donna");
    expect(checkInvariants(withAttrs(i, { gender: "n.uomo" }))).toContain(
      "13 men and 11 women, expected 12 and 12",
    );
  });

  test("a question with too few yeses", () => {
    const noHats = valid.map((c) => ({ ...c, attrs: { ...c.attrs, hat: false } }));
    expect(checkInvariants(noHats)).toContain("hat is yes for 0, expected 3 to 15");
  });

  test("a question with too many yeses", () => {
    const allGlasses = valid.map((c) => ({ ...c, attrs: { ...c.attrs, glasses: true } }));
    expect(checkInvariants(allGlasses)).toContain("glasses is yes for 24, expected 3 to 15");
  });
});

test("yesCount counts characters matching the question", () => {
  const men = questions.find((q) => q.label === "gender=n.uomo");
  expect(men && yesCount(valid, men)).toBe(12);
});
