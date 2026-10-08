import { describe, expect, test } from "vitest";
import { artFiles, layersFor } from "./art.ts";
import { content } from "./index.ts";
import type { Character } from "./schemas.ts";

const base: Character = {
  id: "c.test",
  name: "测试",
  namePinyin: "Cè Shì",
  attrs: {
    gender: "n.nvde",
    job: "n.yisheng",
    place: "n.yiyuan",
    dog: false,
    cat: false,
    phone: false,
    book: false,
    computer: false,
  },
  skin: "s3",
  hairStyle: "h2",
};
const withAttrs = (attrs: Partial<Character["attrs"]>): Character => ({
  ...base,
  attrs: { ...base.attrs, ...attrs },
});

describe("layersFor", () => {
  test("the always-present layers, in z order", () => {
    expect(layersFor(base)).toEqual([
      "bg-yiyuan.svg",
      "body-f-yisheng.svg",
      "face-s3.svg",
      "hair-f-h2.svg",
    ]);
  });

  test("every optional layer, in z order", () => {
    expect(
      layersFor(withAttrs({ dog: true, cat: true, phone: true, book: true, computer: true })),
    ).toEqual([
      "bg-yiyuan.svg",
      "body-f-yisheng.svg",
      "face-s3.svg",
      "hair-f-h2.svg",
      "book.svg",
      "phone.svg",
      "computer.svg",
      "dog.svg",
      "cat.svg",
    ]);
  });

  test.each([
    ["gender", { gender: "n.nande" }, "body-m-yisheng.svg"],
    ["job", { job: "n.laoshi" }, "body-f-laoshi.svg"],
    ["place", { place: "n.fandian" }, "bg-fandian.svg"],
    ["dog", { dog: true }, "dog.svg"],
    ["cat", { cat: true }, "cat.svg"],
    ["phone", { phone: true }, "phone.svg"],
    ["book", { book: true }, "book.svg"],
    ["computer", { computer: true }, "computer.svg"],
  ] as const)("changing %s changes the picture", (_, attrs, file) => {
    expect(layersFor(base)).not.toContain(file);
    expect(layersFor(withAttrs(attrs))).toContain(file);
  });

  test("skin and hair style pick their layers", () => {
    expect(layersFor({ ...base, skin: "s5" })).toContain("face-s5.svg");
    expect(layersFor({ ...base, hairStyle: "h3" })).toContain("hair-f-h3.svg");
    expect(layersFor(withAttrs({ gender: "n.nande" }))).toContain("hair-m-h2.svg");
  });
});

describe("all 24 characters", () => {
  test.each(content.characters.map((c) => [c.id, c] as const))(
    "%s uses only manifest files, in z order",
    (_, c) => {
      const layers = layersFor(c);
      for (const file of layers) expect(artFiles).toContain(file);
      const z = layers.map((f) => artFiles.indexOf(f));
      expect(z).toEqual([...z].sort((a, b) => a - b));
    },
  );

  test("no two characters show the same attributes", () => {
    const pictures = content.characters.map((c) =>
      layersFor(c)
        .filter((f) => !f.startsWith("face-") && !f.startsWith("hair-"))
        .join(),
    );
    expect(new Set(pictures).size).toBe(24);
  });

  test("the deck uses every background and every pet and thing", () => {
    const used = new Set(content.characters.flatMap(layersFor));
    for (const f of artFiles.filter((f) => !/^(body|face|hair)-/.test(f)))
      expect(used.has(f), f).toBe(true);
  });
});
