// Spec 3 and 10.2: content tests across files.
import { describe, expect, test } from "vitest";
import hsk1Json from "./hsk1.json";
import { allIds, content, contentVersion, missingReleasedIds, releasedIds } from "./index.ts";
import { attrsKey, checkInvariants, questions, thingCount, yesCount } from "./invariants.ts";
import { contentFiles, type Noun } from "./schemas.ts";

const { characters, lexicon, grammar, messages } = content;
const hsk1 = contentFiles["hsk1.json"].parse(hsk1Json);
const byId = new Map(lexicon.map((e) => [e.id, e]));
const nouns = lexicon.filter((e): e is Noun => e.pos === "noun");
const han = (text: string) => [...text.matchAll(/\p{Script=Han}/gu)].map((m) => m[0]);

describe("every file passes its schema", () => {
  test.each([
    ["characters.json", characters],
    ["lexicon.json", lexicon],
    ["grammar.json", grammar],
    ["messages.json", messages],
    ["hsk1.json", hsk1],
    ["version.json", { contentVersion }],
    ["released-ids.json", releasedIds],
  ] as const)("%s", (file, data) => {
    expect(contentFiles[file].safeParse(data).success).toBe(true);
  });
});

describe("spec 3.2 invariants on the committed characters", () => {
  test("no two characters have the same 8 attribute values", () => {
    expect(new Set(characters.map((c) => attrsKey(c.attrs))).size).toBe(characters.length);
  });

  test("12 men, 12 women", () => {
    expect(characters.filter((c) => c.attrs.gender === "n.nande")).toHaveLength(12);
    expect(characters.filter((c) => c.attrs.gender === "n.nvde")).toHaveLength(12);
  });

  test.each(questions.map((q) => [q.label, q] as const))("%s is within its range", (_, q) => {
    const n = yesCount(characters, q);
    if (q.attr === "job") expect(n >= 7 && n <= 9, `${n}`).toBe(true);
    else if (q.attr === "place") expect(n).toBe(6);
    else if (q.attr !== "gender") expect(n >= 5 && n <= 14, `${n}`).toBe(true);
  });

  test("each character has 1 to 3 pets and things", () => {
    for (const c of characters) expect([1, 2, 3], c.id).toContain(thingCount(c.attrs));
  });

  test("and the shared checker agrees", () => {
    expect(checkInvariants(characters)).toEqual([]);
  });
});

describe("HSK 1 (spec 3.3, D4)", () => {
  const words = new Set(hsk1.words);
  const chars = new Set(hsk1.words.flatMap(han));

  test("the list has 300 unique headwords", () => {
    expect(hsk1.words).toHaveLength(300);
    expect(words.size).toBe(300);
  });

  test.each(lexicon.filter((e) => !e.retired).map((e) => [e.id, e] as const))(
    "%s is covered by HSK 1 headwords",
    (_, e) => {
      for (const w of e.hsk) expect(words.has(w), w).toBe(true);
      // The headwords cover every character the entry shows.
      for (const c of han(e.hanzi)) expect(han(e.hsk.join("")), c).toContain(c);
    },
  );

  test("every character in messages and grammar points is in some HSK 1 headword", () => {
    const text = [...Object.values(messages), ...grammar.flatMap((g) => [g.title, g.explain])].join(
      "",
    );
    for (const c of han(text)) expect(chars.has(c), c).toBe(true);
  });

  test("谁, the game's name, is HSK 1 (D25)", () => {
    expect(words.has("谁")).toBe(true);
  });
});

describe("pinyin uses tone marks only (spec 3.3 conventions)", () => {
  test.each([
    ...lexicon.map((e) => [e.id, e.pinyin] as const),
    ...characters.map((c) => [c.id, c.namePinyin] as const),
  ])("%s", (_, pinyin) => {
    expect(pinyin).not.toMatch(/\d/);
    expect(pinyin).toMatch(/^[\p{Script=Latin}\s]+$/u);
  });
});

describe("every referenced id and message key exists", () => {
  test("ids are unique across all content", () => {
    const ids = allIds(content);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("character attribute values are nouns of the right category", () => {
    for (const c of characters) {
      for (const key of ["gender", "job", "place"] as const) {
        const noun = byId.get(c.attrs[key]);
        expect(noun?.pos === "noun" && noun.category, `${c.id} ${key}`).toBe(key);
      }
    }
  });

  test("verbs name their yes and no answers", () => {
    for (const e of lexicon) {
      if (e.pos !== "verb") continue;
      for (const [id, polarity] of [
        [e.yes, true],
        [e.no, false],
      ] as const) {
        const a = byId.get(id);
        expect(a?.pos === "answer" && a.verb === e.id && a.polarity === polarity, id).toBe(true);
      }
    }
  });

  test("nouns name real verbs", () => {
    for (const n of nouns)
      for (const v of [n.verb, ...(n.offBoardVerbs ?? [])])
        expect(byId.get(v)?.pos, `${n.id} ${v}`).toBe("verb");
  });

  test("every rule the engine reports has a message", () => {
    for (const key of [
      "verb.shi",
      "verb.you",
      "verb.zai",
      "offBoard.youJob",
      "answer.wrong",
      "duplicate",
      "shape.empty",
      "shape.noPron",
      "shape.noVerb",
      "shape.noObj",
      "shape.extra",
      ...grammar.map((g) => g.id),
    ]) {
      expect(messages[key], key).toBeDefined();
    }
  });

  test("the six grammar points of spec 3.6", () => {
    expect(grammar.map((g) => g.id)).toEqual([
      "gp.ma",
      "gp.order",
      "gp.pron.you",
      "gp.pron.gender",
      "gp.answer.verb",
      "gp.neg.mei",
    ]);
  });
});

describe("released ids (spec 3.7)", () => {
  test("every id in released-ids.json still exists", () => {
    expect(missingReleasedIds(releasedIds, content)).toEqual([]);
  });

  test("a released id that disappears is reported", () => {
    const withoutLili = { ...content, characters: characters.filter((c) => c.id !== "c.lili") };
    expect(missingReleasedIds(["c.lili", "n.gou"], withoutLili)).toEqual(["c.lili"]);
  });

  test("retiring a word keeps its id, so it is not missing", () => {
    const retired = {
      ...content,
      lexicon: lexicon.map((e) => (e.id === "n.mao" ? { ...e, retired: true } : e)),
    };
    expect(missingReleasedIds(["n.mao"], retired)).toEqual([]);
  });

  test("released ids are unique", () => {
    expect(new Set(releasedIds).size).toBe(releasedIds.length);
  });
});

test("contentVersion is a positive integer", () => {
  expect(Number.isInteger(contentVersion) && contentVersion > 0).toBe(true);
});
