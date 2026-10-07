import { expect, test } from "vitest";
import { content } from "../content/index.ts";
import type { Character } from "../content/schemas.ts";
import { describeCharacter } from "./describe.ts";

const lili: Character = {
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

test("the spec 9 example", () => {
  expect(describeCharacter(lili, content.lexicon)).toBe("李丽：女的，医生，在医院，有猫，有手机");
});

test("every character gets a distinct name", () => {
  const names = content.characters.map((c) => describeCharacter(c, content.lexicon));
  expect(new Set(names).size).toBe(24);
  for (const n of names) expect(n).not.toMatch(/[a-z]/);
});
