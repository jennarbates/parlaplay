import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import type { Adjective, Messages, Noun } from "../content/schemas.ts";
import { allQuestions } from "../engine/index.ts";
import { englishFor } from "./english.ts";
import { renderMessage } from "./messages.ts";

const nouns = new Map(
  content.lexicon.filter((e): e is Noun => e.pos === "noun").map((n) => [n.id, n]),
);
const adjectives = new Map(
  content.lexicon.filter((e): e is Adjective => e.pos === "adj").map((a) => [a.id, a]),
);

describe("englishFor", () => {
  test("every one of the 16 questions has its hint", () => {
    const hints = Object.fromEntries(
      allQuestions(content).map((q) => [q.text, englishFor(q, nouns, adjectives)]),
    );
    expect(hints).toEqual({
      "È un uomo?": "Is it a man?",
      "È una donna?": "Is it a woman?",
      "Ha gli occhiali?": "Does this person have glasses?",
      "Ha il cappello?": "Does this person have a hat?",
      "Ha la barba?": "Does this person have a beard?",
      "Ha i baffi?": "Does this person have a mustache?",
      "Ha i capelli biondi?": "Does this person have blond hair?",
      "Ha i capelli castani?": "Does this person have brown hair?",
      "Ha i capelli neri?": "Does this person have black hair?",
      "Ha i capelli rossi?": "Does this person have red hair?",
      "Ha i capelli bianchi?": "Does this person have white hair?",
      "Ha i capelli corti?": "Does this person have short hair?",
      "Ha i capelli lunghi?": "Does this person have long hair?",
      "Ha gli occhi azzurri?": "Does this person have blue eyes?",
      "Ha gli occhi marroni?": "Does this person have brown eyes?",
      "Ha gli occhi verdi?": "Does this person have green eyes?",
    });
  });
});

describe("renderMessage", () => {
  const messages: Messages = content.messages;

  test("fills placeholders and marks Italian as italic (spec 3.7)", () => {
    expect(renderMessage(messages, "art.mpl.consonant", { noun: "capelli" })).toEqual([
      { text: "capelli", italic: true },
      { text: " is masculine plural and starts with a consonant: use ", italic: false },
      { text: "i", italic: true },
      { text: ".", italic: false },
    ]);
  });

  test("the agreement slip names both forms", () => {
    const text = renderMessage(messages, "agreement", {
      expected: "biondi",
      given: "bionde",
      noun: "capelli",
      genderNumber: "masculine plural",
    });
    expect(text.map((s) => s.text).join("")).toBe(
      "biondi, not bionde: capelli is masculine plural.",
    );
    expect(text.filter((s) => s.italic).map((s) => s.text)).toEqual([
      "biondi",
      "bionde",
      "capelli",
    ]);
  });

  test("a whole italic phrase with placeholders inside", () => {
    expect(renderMessage(messages, "verb.avere", { art: "la", noun: "barba" }).at(-1)).toEqual({
      text: "Ha la barba?",
      italic: true,
    });
  });

  test("every message in messages.json renders without leftover braces or stars", () => {
    const params = new Proxy({}, { get: (_, k) => `[${String(k)}]` }) as Record<string, string>;
    for (const key of Object.keys(messages)) {
      const text = renderMessage(messages, key, params)
        .map((s) => s.text)
        .join("");
      expect(text, key).not.toMatch(/[{}*]/);
    }
  });

  test("a missing param stays visible instead of vanishing, and an unknown key shows the key", () => {
    expect(
      renderMessage(messages, "duplicate", {})
        .map((s) => s.text)
        .join(""),
    ).toContain("{answerText}");
    expect(renderMessage(messages, "no.such.key", {})).toEqual([
      { text: "no.such.key", italic: false },
    ]);
  });
});
