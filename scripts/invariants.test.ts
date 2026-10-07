import { describe, expect, test } from "vitest";
import { checkInvariants, questions, yesCount } from "../src/content/invariants.ts";
import type { Attrs } from "../src/content/schemas.ts";
import { generateCharacters } from "./generate-characters.ts";

const valid = generateCharacters(3).characters;
const withAttrs = (i: number, attrs: Partial<Attrs>) =>
  valid.map((c, j) => (j === i ? { ...c, attrs: { ...c.attrs, ...attrs } } : c));
const allWith = (attrs: Partial<Attrs>) =>
  valid.map((c) => ({ ...c, attrs: { ...c.attrs, ...attrs } }));

test("14 questions, as in spec 3.1", () => {
  expect(questions).toHaveLength(14);
  expect(new Set(questions.map((q) => q.label)).size).toBe(14);
});

test("a valid set has no problems", () => {
  expect(checkInvariants(valid)).toEqual([]);
});

describe("each invariant is caught", () => {
  test("wrong count", () => {
    expect(checkInvariants(valid.slice(1))).toContain("23 characters, expected 24");
  });

  test("1. two characters with the same attributes", () => {
    const copy = valid.map((c, i) => (i === 1 ? { ...c, attrs: valid[0]?.attrs ?? c.attrs } : c));
    expect(checkInvariants(copy)).toContain("characters 0 and 1 have the same 8 attributes");
  });

  test("2. 13 men and 11 women", () => {
    const i = valid.findIndex((c) => c.attrs.gender === "n.nvde");
    expect(checkInvariants(withAttrs(i, { gender: "n.nande" }))).toContain(
      "13 men and 11 women, expected 12 and 12",
    );
  });

  test("3. a job outside 7 to 9", () => {
    expect(checkInvariants(allWith({ job: "n.laoshi" }))).toContain(
      "job=n.laoshi is yes for 24, expected 7 to 9",
    );
  });

  test("3. a place without exactly 6", () => {
    expect(checkInvariants(allWith({ place: "n.jia" }))).toContain(
      "place=n.jia is yes for 24, expected 6",
    );
  });

  test("4. a pet nobody has", () => {
    expect(checkInvariants(allWith({ cat: false }))).toContain(
      "cat is yes for 0, expected 5 to 14",
    );
  });

  test("4. a thing everybody has", () => {
    expect(checkInvariants(allWith({ book: true }))).toContain(
      "book is yes for 24, expected 5 to 14",
    );
  });

  test("5. a character with nothing", () => {
    const none = { dog: false, cat: false, phone: false, book: false, computer: false };
    expect(checkInvariants(withAttrs(4, none))).toContain(
      "character 4 has 0 pets and things, expected 1 to 3",
    );
  });

  test("5. a character with everything", () => {
    const all = { dog: true, cat: true, phone: true, book: true, computer: true };
    expect(checkInvariants(withAttrs(4, all))).toContain(
      "character 4 has 5 pets and things, expected 1 to 3",
    );
  });
});

test("yesCount counts characters matching the question", () => {
  const men = questions.find((q) => q.label === "gender=n.nande");
  expect(men && yesCount(valid, men)).toBe(12);
});
