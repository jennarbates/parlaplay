import { expect, test } from "vitest";
import messagesJson from "./messages.json";
import { contentFiles } from "./schemas.ts";

const messages = contentFiles["messages.json"].parse(messagesJson);

// Spec 3.6: every key, and the placeholders each message may use.
const spec: Record<string, string[]> = {
  "verb.shi": ["pron", "obj"],
  "verb.you": ["pron", "obj"],
  "verb.zai": ["pron", "obj"],
  "offBoard.youJob": ["given", "gloss", "pron", "obj"],
  "gp.ma": [],
  "gp.order": ["expected"],
  "gp.pron.you": [],
  "gp.pron.gender": ["genderGloss", "expected"],
  "gp.answer.verb": ["expected"],
  "gp.neg.mei": ["expected"],
  "answer.wrong": ["answerText"],
  duplicate: ["answerText"],
  "shape.empty": [],
  "shape.noPron": [],
  "shape.noVerb": [],
  "shape.noObj": [],
  "shape.extra": [],
};

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

test("exactly the keys in the 3.6 table", () => {
  expect(Object.keys(messages).sort()).toEqual(Object.keys(spec).sort());
});

test.each(Object.entries(spec))("%s uses exactly its placeholders", (key, expected) => {
  expect(placeholders(messages[key] ?? "").sort()).toEqual([...expected].sort());
});

test.each(Object.entries(messages))(
  "%s has no italics, stray braces or stray spaces",
  (_, text) => {
    // Chinese is never italicised (spec 3.6), so no message uses * at all.
    expect(text).not.toContain("*");
    expect(text.replace(/\{\w+\}/g, "")).not.toMatch(/[{}]/);
    expect(text).not.toMatch(/\s$|^\s|\s{2}/);
  },
);

// A full stop after a character can end an English sentence ("… + 吗. Try: …"),
// but a question mark after one is always a Chinese question.
test("Chinese questions in messages end with a full-width ？", () => {
  for (const text of Object.values(messages)) expect(text, text).not.toMatch(/\p{Script=Han}\?/u);
});
