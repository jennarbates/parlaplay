import { expect, test } from "vitest";
import lexiconJson from "./lexicon.json";
import messagesJson from "./messages.json";
import { contentFiles } from "./schemas.ts";

const messages = contentFiles["messages.json"].parse(messagesJson);
const lexicon = contentFiles["lexicon.json"].parse(lexiconJson);

// Spec 3.7: every key, and the placeholders each message may use.
const spec: Record<string, string[]> = {
  "verb.avere": ["art", "noun"],
  "verb.essere": ["art", "noun"],
  "art.msg.consonant": ["noun"],
  "art.fsg": ["noun"],
  "art.mpl.consonant": ["noun"],
  "art.mpl.vowel": ["noun"],
  "art.indef.m": ["noun"],
  "art.indef.f": ["noun"],
  agreement: ["expected", "given", "noun", "genderNumber"],
  "meaning.mismatch": ["noun", "given", "allowed"],
  "meaning.wordChoice": ["noun", "use"],
  duplicate: ["answerText"],
  "shape.noVerb": [],
  "shape.noArt": [],
  "shape.noNoun": [],
  "shape.needsAdj": ["noun"],
  "shape.noAdjAllowed": ["art", "noun"],
  "answer.wrong": ["answerText"],
};

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

test("exactly the keys in the 3.7 table", () => {
  expect(Object.keys(messages).sort()).toEqual(Object.keys(spec).sort());
});

test.each(Object.entries(spec))("%s uses exactly its placeholders", (key, expected) => {
  expect(placeholders(messages[key] ?? "").sort()).toEqual([...expected].sort());
});

test.each(Object.entries(messages))("%s has balanced italics and no stray braces", (_, text) => {
  expect((text.match(/\*/g) ?? []).length % 2).toBe(0);
  expect(text.replace(/\{\w+\}/g, "")).not.toMatch(/[{}]/);
  expect(text).not.toMatch(/\s$|^\s|\s{2}/);
});

test("every noun's article rule has a message", () => {
  for (const e of lexicon) {
    if (e.pos === "noun") expect(messages[e.artRule], e.id).toBeDefined();
  }
});
