import { expect, test } from "vitest";
import charactersJson from "./characters.json";
import { checkInvariants } from "./invariants.ts";
import lexiconJson from "./lexicon.json";
import { contentFiles } from "./schemas.ts";

const characters = contentFiles["characters.json"].parse(charactersJson);
const lexicon = contentFiles["lexicon.json"].parse(lexiconJson);

test("passes every spec 3.2 invariant", () => {
  expect(checkInvariants(characters)).toEqual([]);
});

test("ids are c.<name in lowercase> and unique", () => {
  for (const c of characters) expect(c.id).toBe(`c.${c.name.toLowerCase()}`);
  expect(new Set(characters.map((c) => c.id)).size).toBe(24);
});

test("names are unique, capitalized, and not words from the game", () => {
  const words = new Set(
    lexicon.flatMap((e) =>
      e.pos === "adj" ? Object.values(e.forms) : e.pos === "noun" ? [e.text] : [],
    ),
  );
  expect(new Set(characters.map((c) => c.name)).size).toBe(24);
  for (const c of characters) {
    expect(c.name).toMatch(/^[A-Z][a-z]+$/);
    expect(words.has(c.name.toLowerCase()), c.name).toBe(false);
  }
});

test("skins are the five face layers", () => {
  for (const c of characters) expect(["s1", "s2", "s3", "s4", "s5"]).toContain(c.skin);
});
