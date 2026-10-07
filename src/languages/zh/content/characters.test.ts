import { expect, test } from "vitest";
import charactersJson from "./characters.json";
import { checkInvariants, tonelessId } from "./invariants.ts";
import lexiconJson from "./lexicon.json";
import { contentFiles } from "./schemas.ts";

const characters = contentFiles["characters.json"].parse(charactersJson);
const lexicon = contentFiles["lexicon.json"].parse(lexiconJson);

test("passes every spec 3.2 invariant", () => {
  expect(checkInvariants(characters)).toEqual([]);
});

test("ids are c. + the toneless pinyin of the name, and unique (invariant 6)", () => {
  for (const c of characters) expect(c.id).toBe(tonelessId(c.namePinyin));
  expect(new Set(characters.map((c) => c.id)).size).toBe(24);
});

test("tonelessId writes ü as v", () => {
  expect(tonelessId("Lǚ Lì")).toBe("c.lvli");
  expect(tonelessId("Wáng Míng")).toBe("c.wangming");
});

test("names are two or three characters, unique, and not words from the game", () => {
  const words = new Set(lexicon.map((e) => e.hanzi));
  expect(new Set(characters.map((c) => c.name)).size).toBe(24);
  for (const c of characters) {
    expect(c.name).toMatch(/^\p{Script=Han}{2,3}$/u);
    expect(words.has(c.name), c.name).toBe(false);
  }
});

test("name pinyin: surname and given name apart, each capitalised (GB/T 16159-2012)", () => {
  for (const c of characters) {
    expect(c.namePinyin, c.id).toMatch(/^\p{Lu}\p{Ll}+ \p{Lu}\p{Ll}+$/u);
    expect(c.namePinyin.split(" "), c.id).toHaveLength(2);
  }
});
