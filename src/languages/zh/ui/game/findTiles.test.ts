import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { content } from "../../content/index.ts";
import { findTiles, pinyinKey, splitTiles } from "./findTiles.ts";
import { builderTiles as tiles } from "./tiles.ts";

// zh-desktop.md ZS 3: the find field's logic.
const found = (query: string) => findTiles(query, tiles).map((t) => t.hanzi);

describe("pinyinKey", () => {
  test.each(["nǚ de", "nu de", "nv3de", "NUDE", "nü de", "Nǚ De"])("%s is nude", (typed) => {
    expect(pinyinKey(typed)).toBe("nude");
  });

  test("tones, tone numbers, spaces and apostrophes go; v is ü", () => {
    expect(pinyinKey("Xuésheng")).toBe("xuesheng");
    expect(pinyinKey("dian4 nao3")).toBe("diannao");
    expect(pinyinKey("xi'an")).toBe("xian");
    expect(pinyinKey("  ")).toBe("");
  });

  test("is idempotent", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(pinyinKey(pinyinKey(s))).toBe(pinyinKey(s));
      }),
    );
  });

  test("every tile's key is plain lowercase letters", () => {
    for (const t of tiles) expect(pinyinKey(t.pinyin)).toMatch(/^[a-z]+$/);
  });
});

describe("findTiles", () => {
  // Every row of the ZS 3 table.
  test.each([
    ["ta", ["他", "她"]],
    ["t", ["他", "她"]],
    ["n", ["你", "男的", "女的"]],
    ["nv", ["女的"]],
    ["nu", ["女的"]],
    ["sh", ["是", "手机", "书"]],
    ["shi", ["是"]],
    ["x", ["学生", "学校"]],
    ["yi", ["医生", "医院"]],
    ["gou3", ["狗"]],
    ["狗", ["狗"]],
    ["zz", []],
  ])("%s finds %j", (query, hanzi) => {
    expect(found(query)).toEqual(hanzi);
  });

  test("the round's own example: ta, you, gou, ma each put the wanted tile first", () => {
    expect(["ta", "you", "gou", "ma"].map((q) => found(q)[0])).toEqual(["他", "有", "狗", "吗"]);
    expect(found("ma")).toEqual(["吗", "猫"]); // 吗's row comes first
  });

  test("an empty query, or one of only spaces or digits, finds nothing", () => {
    for (const q of ["", "   ", "3", " 4 "]) expect(found(q)).toEqual([]);
  });

  test("there are 21 tiles, in builder order, and none is an answer", () => {
    expect(tiles).toHaveLength(21);
    expect(tiles.slice(0, 7).map((t) => t.hanzi)).toEqual([
      "他",
      "她",
      "你",
      "是",
      "有",
      "在",
      "吗",
    ]);
    const answers = new Set(content.lexicon.filter((e) => e.pos === "answer").map((e) => e.id));
    for (const t of tiles) expect(answers.has(t.id)).toBe(false);
  });

  test("every tile is found by its own pinyin, and comes first by its own characters", () => {
    for (const t of tiles) {
      expect(findTiles(t.pinyin, tiles)).toContain(t);
      expect(findTiles(t.hanzi, tiles)[0]).toBe(t);
    }
  });

  test("it only ever returns builder tiles, in builder order", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 8 }), (query) => {
        const result = findTiles(query, tiles);
        const places = result.map((t) => tiles.indexOf(t));
        expect(places.every((i) => i >= 0)).toBe(true);
        expect(places).toEqual([...places].sort((a, b) => a - b));
      }),
    );
  });
});

describe("splitTiles (ZD16)", () => {
  const split = (text: string) => splitTiles(text, tiles)?.map((t) => t.hanzi) ?? null;

  test("a committed sentence that is a run of tiles gives them in order", () => {
    expect(split("他有狗吗")).toEqual(["他", "有", "狗", "吗"]);
    expect(split("他有狗吗？")).toEqual(["他", "有", "狗", "吗"]);
    expect(split("她 在 学校 吗")).toEqual(["她", "在", "学校", "吗"]);
    expect(split("狗")).toEqual(["狗"]);
  });

  test("the longest tile wins at each place: 学生 and 学校, 医生 and 医院, 男的 and 女的", () => {
    expect(split("他是学生吗")).toEqual(["他", "是", "学生", "吗"]);
    expect(split("她在医院吗")).toEqual(["她", "在", "医院", "吗"]);
    expect(split("你是女的吗")).toEqual(["你", "是", "女的", "吗"]);
  });

  test("anything that is not wholly tiles gives null", () => {
    for (const text of ["他很好", "他有狗吗 ok", "的", "", "？", "gou"])
      expect(split(text)).toBeNull();
  });

  test("a run is not checked for grammar: that is the engine's job", () => {
    expect(split("狗有他")).toEqual(["狗", "有", "他"]);
  });
});
