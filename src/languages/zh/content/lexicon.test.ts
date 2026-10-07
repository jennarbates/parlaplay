import { describe, expect, test } from "vitest";
import lexiconJson from "./lexicon.json";
import { contentFiles, type LexiconEntry } from "./schemas.ts";

const lexicon = contentFiles["lexicon.json"].parse(lexiconJson);
const of = <P extends LexiconEntry["pos"]>(pos: P) =>
  lexicon.filter((e): e is Extract<LexiconEntry, { pos: P }> => e.pos === pos);
const nouns = of("noun");

test("ids are unique", () => {
  expect(new Set(lexicon.map((e) => e.id)).size).toBe(lexicon.length);
});

test("the 28 entries of spec 3.3", () => {
  const text = (pos: LexiconEntry["pos"]) => of(pos).map((e) => `${e.hanzi} ${e.pinyin}`);
  expect(text("noun")).toEqual([
    "男的 nán de",
    "女的 nǚ de",
    "老师 lǎoshī",
    "学生 xuéshēng", // spec table: xuésheng. HSK list spelling; TBD reviewer (3.3)
    "医生 yīshēng",
    "狗 gǒu",
    "猫 māo",
    "手机 shǒujī",
    "书 shū",
    "电脑 diànnǎo",
    "家 jiā",
    "学校 xuéxiào",
    "医院 yīyuàn",
    "饭店 fàndiàn",
  ]);
  expect(text("verb")).toEqual(["是 shì", "有 yǒu", "在 zài"]);
  expect(text("pronoun")).toEqual(["他 tā", "她 tā", "你 nǐ"]);
  expect(text("particle")).toEqual(["吗 ma"]);
  expect(text("answer")).toEqual([
    "是 shì",
    "不是 bú shì",
    "有 yǒu",
    "没有 méiyǒu",
    "不有 bù yǒu",
    "在 zài",
    "不在 bú zài",
  ]);
  expect(lexicon).toHaveLength(28);
});

test("ids follow the prefix conventions, in toneless pinyin with ü as v", () => {
  const prefix = { noun: "n.", verb: "v.", pronoun: "pr.", particle: "pt.", answer: "a." };
  for (const e of lexicon) {
    expect(e.id.startsWith(prefix[e.pos]), e.id).toBe(true);
    expect(e.id, e.id).toMatch(/^[a-z]+\.[a-z.]+$/);
  }
});

describe("nouns", () => {
  test("the category picks the verb (spec 2)", () => {
    const verbFor = { gender: "v.shi", job: "v.shi", pet: "v.you", thing: "v.you", place: "v.zai" };
    for (const n of nouns) expect(n.verb, n.id).toBe(verbFor[n.category]);
  });

  test("pets and things each test one boolean attribute, and nothing else does", () => {
    const tested = nouns.filter((n) => n.attr).map((n) => n.attr);
    expect(tested.sort()).toEqual(["book", "cat", "computer", "dog", "phone"]);
    for (const n of nouns)
      expect(!!n.attr, n.id).toBe(n.category === "pet" || n.category === "thing");
  });

  test("only the three jobs have offBoardVerbs, and it is 有 (D11)", () => {
    for (const n of nouns)
      expect(n.offBoardVerbs ?? [], n.id).toEqual(n.category === "job" ? ["v.you"] : []);
  });

  test("the English phrase fits its question", () => {
    for (const n of nouns) {
      if (n.verb === "v.zai") expect(n.en, n.id).toMatch(/^at /);
      else expect(n.en, n.id).toMatch(/^an? /);
    }
  });
});

describe("answers (spec 2)", () => {
  test("不有 is the only invalid answer", () => {
    expect(
      of("answer")
        .filter((a) => !a.valid)
        .map((a) => a.id),
    ).toEqual(["a.buyou"]);
  });

  test("不 before a fourth tone is written bú (spec 3.4, D13)", () => {
    for (const e of lexicon) {
      if (!e.hanzi.startsWith("不")) continue;
      const fourth = /[àèìòù]/.test(e.pinyin.split(" ")[1] ?? "");
      expect(e.pinyin.startsWith(fourth ? "bú " : "bù "), e.id).toBe(true);
    }
  });

  test("each verb has one yes and one valid no", () => {
    for (const v of of("verb")) {
      const answers = of("answer").filter((a) => a.verb === v.id && a.valid);
      expect(answers.map((a) => a.polarity).sort(), v.id).toEqual([false, true]);
    }
  });
});

test("pronouns: 他 is m, 她 is f, 你 has no gender", () => {
  expect(of("pronoun").map((p) => [p.hanzi, p.gender])).toEqual([
    ["他", "m"],
    ["她", "f"],
    ["你", undefined],
  ]);
});
