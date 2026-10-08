import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import type { Noun } from "../content/schemas.ts";
import { allQuestions } from "../engine/index.ts";
import { englishFor } from "./english.ts";
import { renderMessage, splitChinese } from "./messages.ts";

const nouns = new Map(
  content.lexicon.filter((e): e is Noun => e.pos === "noun").map((n) => [n.id, n]),
);

describe("englishFor", () => {
  test.each([
    ["v.shi", "n.yisheng", "pr.ta.m", "Is he a doctor?"],
    ["v.shi", "n.nvde", "pr.ta.f", "Is she a woman?"],
    ["v.you", "n.gou", "pr.ta.f", "Does she have a dog?"],
    ["v.zai", "n.xuexiao", "pr.ta.m", "Is he at school?"],
    ["v.zai", "n.yiyuan", "pr.ta.f", "Is she at the hospital?"],
  ])("%s %s %s", (verb, noun, pron, english) => {
    const n = nouns.get(noun);
    expect(n && englishFor(verb, n, pron)).toBe(english);
  });

  test("every one of the 14 questions has its hint, with either pronoun", () => {
    for (const q of allQuestions(content)) {
      const n = nouns.get(q.nounId);
      for (const p of ["pr.ta.m", "pr.ta.f"])
        expect(n && englishFor(q.verbId, n, p)).toMatch(/^(Is|Does) (he|she) .+\?$/);
    }
  });
});

describe("renderMessage (spec 3.6)", () => {
  test("fills placeholders and marks Chinese as Chinese", () => {
    expect(renderMessage(content.messages, "verb.you", { pron: "他", obj: "狗" })).toEqual([
      { text: "Use ", zh: false },
      { text: "有", zh: true },
      { text: " (yǒu) for things someone has: ", zh: false },
      { text: "他有狗吗？", zh: true },
    ]);
  });

  test("a missing param stays visible instead of vanishing, and an unknown key shows the key", () => {
    expect(
      renderMessage(content.messages, "gp.order", {})
        .map((s) => s.text)
        .join(""),
    ).toContain("{expected}");
    expect(renderMessage(content.messages, "no.such.key", {})).toEqual([
      { text: "no.such.key", zh: false },
    ]);
  });

  test("full-width punctuation stays with the Chinese around it", () => {
    expect(splitChinese("Not quite: 没有，他没有狗。")).toEqual([
      { text: "Not quite: ", zh: false },
      { text: "没有，他没有狗。", zh: true },
    ]);
  });
});
