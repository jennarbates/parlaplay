// Spec 9: every card's accessible name is in Chinese, e.g.
// 李丽：女的，医生，在医院，有猫，有手机. It gives screen reader users what the
// picture gives everyone else, and doubles as reading practice. Built from the
// lexicon, so it follows the content.
import { things, type Character, type LexiconEntry } from "../content/schemas.ts";

export function describeCharacter(c: Character, lexicon: LexiconEntry[]): string {
  const hanzi = (id: string) => lexicon.find((e) => e.id === id)?.hanzi ?? id;
  const thing = (attr: string) =>
    lexicon.find((e) => e.pos === "noun" && e.attr === attr)?.hanzi ?? attr;
  const { attrs } = c;
  const parts = [
    hanzi(attrs.gender),
    hanzi(attrs.job),
    `${hanzi("v.zai")}${hanzi(attrs.place)}`,
    ...things.filter((t) => attrs[t]).map((t) => `${hanzi("v.you")}${thing(t)}`),
  ];
  return `${c.name}：${parts.join("，")}`;
}
