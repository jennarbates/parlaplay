import { describe, expect, test } from "vitest";
import { Character, contentFiles, LexiconEntry } from "./schemas.ts";

// The examples from spec 3.2 and 3.3.
const lili = {
  id: "c.lili",
  name: "李丽",
  namePinyin: "Lǐ Lì",
  attrs: {
    gender: "n.nvde",
    job: "n.yisheng",
    place: "n.yiyuan",
    dog: false,
    cat: true,
    phone: true,
    book: false,
    computer: false,
  },
  skin: "s2",
  hairStyle: "h1",
};

const examples = [
  {
    id: "n.gou",
    pos: "noun",
    hanzi: "狗",
    pinyin: "gǒu",
    gloss: "dog",
    hsk: ["狗"],
    category: "pet",
    verb: "v.you",
    en: "a dog",
    attr: "dog",
  },
  {
    id: "n.laoshi",
    pos: "noun",
    hanzi: "老师",
    pinyin: "lǎoshī",
    gloss: "teacher",
    hsk: ["老师"],
    category: "job",
    verb: "v.shi",
    en: "a teacher",
    offBoardVerbs: ["v.you"],
  },
  {
    id: "v.you",
    pos: "verb",
    hanzi: "有",
    pinyin: "yǒu",
    gloss: "to have",
    hsk: ["有"],
    yes: "a.you",
    no: "a.meiyou",
  },
  {
    id: "pr.ta.f",
    pos: "pronoun",
    hanzi: "她",
    pinyin: "tā",
    gloss: "she",
    hsk: ["她"],
    gender: "f",
  },
  {
    id: "pt.ma",
    pos: "particle",
    hanzi: "吗",
    pinyin: "ma",
    gloss: "(yes/no question)",
    hsk: ["吗"],
  },
  {
    id: "a.buyou",
    pos: "answer",
    hanzi: "不有",
    pinyin: "bù yǒu",
    gloss: "(wrong: use 没有)",
    hsk: ["不", "有"],
    verb: "v.you",
    polarity: false,
    valid: false,
  },
];

describe("the spec's examples parse", () => {
  test("a character", () => {
    expect(Character.parse(lili)).toEqual(lili);
  });

  test.each(examples.map((e) => [e.id, e] as const))("%s", (_, e) => {
    expect(LexiconEntry.parse(e)).toEqual(e);
  });
});

describe("schemas are strict", () => {
  test("an unknown key on a character", () => {
    expect(Character.safeParse({ ...lili, hat: true }).success).toBe(false);
  });

  test("an unknown attribute value", () => {
    expect(Character.safeParse({ ...lili, attrs: { ...lili.attrs, job: "n.chef" } }).success).toBe(
      false,
    );
  });

  test("an unknown key on a lexicon entry", () => {
    expect(LexiconEntry.safeParse({ ...examples[0], level: "HSK1" }).success).toBe(false);
  });

  test("an entry with no HSK headword", () => {
    expect(LexiconEntry.safeParse({ ...examples[0], hsk: [] }).success).toBe(false);
  });

  test("a lexicon entry with an unknown pos", () => {
    expect(LexiconEntry.safeParse({ ...examples[0], pos: "adj" }).success).toBe(false);
  });

  test("hsk1.json needs its source", () => {
    expect(contentFiles["hsk1.json"].safeParse({ words: ["爱"] }).success).toBe(false);
  });
});
