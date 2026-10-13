import { expect, test } from "vitest";
import { content } from "../../content/index.ts";
import { allQuestions } from "../../engine/index.ts";
import { groups } from "./groups.ts";

// zh-desktop.md ZS 7.1.
const hanzi = (id: string) => content.lexicon.find((e) => e.id === id)?.hanzi;

test("three columns headed 是, 有 and 在, with the spec's English", () => {
  expect(groups.map((g) => [g.verb?.hanzi, g.verb?.pinyin, g.english])).toEqual([
    ["是", "shì", "who they are"],
    ["有", "yǒu", "what they have"],
    ["在", "zài", "where they are"],
  ]);
});

test("each noun is under its own verb: 5, 5 and 4 questions, in allQuestions order", () => {
  expect(groups.map((g) => g.questions.map((q) => hanzi(q.nounId)))).toEqual([
    ["男的", "女的", "老师", "学生", "医生"],
    ["狗", "猫", "手机", "书", "电脑"],
    ["家", "学校", "医院", "饭店"],
  ]);
  for (const g of groups) for (const q of g.questions) expect(q.verbId).toBe(g.verb?.id);
});

test("every question is in exactly one column", () => {
  const grouped = groups.flatMap((g) => g.questions.map((q) => q.key));
  expect([...grouped].sort()).toEqual(
    allQuestions(content)
      .map((q) => q.key)
      .sort(),
  );
});
