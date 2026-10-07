import { describe, expect, test } from "vitest";
import { Adjective, Character, contentFiles, LexiconEntry, Noun, Template } from "./schemas.ts";

// The examples from spec 3.2, 3.3 and 3.4, with `level` added where the spec's
// examples leave it out.
const giulia = {
  id: "c.giulia",
  name: "Giulia",
  attrs: {
    gender: "n.donna",
    hairColor: "adj.castano",
    hairLength: "adj.lungo",
    eyeColor: "adj.verde",
    glasses: true,
    hat: false,
    beard: false,
    mustache: false,
  },
  skin: "s3",
};

const capelli = {
  id: "n.capelli",
  pos: "noun",
  text: "capelli",
  gloss: "hair",
  gender: "m",
  number: "pl",
  defArt: "art.i",
  artRule: "art.mpl.consonant",
  template: "t.have.adj",
  adjAttrs: ["hairColor", "hairLength"],
  level: "A1",
};

const donna = {
  id: "n.donna",
  pos: "noun",
  text: "donna",
  gloss: "woman",
  gender: "f",
  number: "sg",
  defArt: "art.la",
  indefArt: "art.una",
  artRule: "art.indef.f",
  template: "t.be",
  level: "A1",
};

const castano = {
  id: "adj.castano",
  pos: "adj",
  gloss: "brown (hair, eyes)",
  attr: "hairColor",
  alsoMeans: [{ attr: "eyeColor", value: "adj.marrone" }],
  forms: { ms: "castano", fs: "castana", mp: "castani", fp: "castane" },
  level: "A1",
};

const marrone = {
  id: "adj.marrone",
  pos: "adj",
  gloss: "brown (eyes)",
  attr: "eyeColor",
  wordChoice: [{ noun: "n.capelli", use: "adj.castano" }],
  forms: { ms: "marrone", fs: "marrone", mp: "marroni", fp: "marroni" },
  level: "A1",
};

const haveAdj = {
  id: "t.have.adj",
  pattern: "Ha {art} {noun} {adj}?",
  verb: "v.ha",
  article: "def",
  needsAdj: true,
  predicate: "featureIs",
};

describe("spec examples parse", () => {
  test.each([
    ["Character", Character, giulia],
    ["Noun with adjectives", Noun, capelli],
    ["Noun with an indefinite article", Noun, donna],
    ["Adjective with alsoMeans", Adjective, castano],
    ["Adjective with wordChoice", Adjective, marrone],
    ["Template", Template, haveAdj],
  ] as const)("%s", (_, schema, value) => {
    expect(schema.parse(value)).toEqual(value);
  });

  test("lexicon entries pick their schema by pos", () => {
    const lexicon = [
      { id: "art.i", pos: "article", text: "i" },
      { id: "v.ha", pos: "verb", text: "ha" },
      capelli,
      castano,
    ];
    expect(contentFiles["lexicon.json"].parse(lexicon)).toEqual(lexicon);
  });
});

describe("invalid content is rejected", () => {
  const without = <T extends object>(value: T, key: keyof T) =>
    Object.fromEntries(Object.entries(value).filter(([k]) => k !== key));

  test.each([
    [
      "unknown gender value",
      Character,
      { ...giulia, attrs: { ...giulia.attrs, gender: "n.bambino" } },
    ],
    [
      "hair color that is not a lemma",
      Character,
      { ...giulia, attrs: { ...giulia.attrs, hairColor: "adj.verde" } },
    ],
    [
      "boolean attribute as a string",
      Character,
      { ...giulia, attrs: { ...giulia.attrs, glasses: "yes" } },
    ],
    ["missing attribute", Character, { ...giulia, attrs: without(giulia.attrs, "mustache") }],
    ["extra attribute", Character, { ...giulia, attrs: { ...giulia.attrs, freckles: true } }],
    ["noun without level", Noun, without(capelli, "level")],
    ["noun level outside A1/A2", Noun, { ...capelli, level: "B1" }],
    ["noun with a misspelled key", Noun, { ...capelli, adjAtrs: capelli.adjAttrs }],
    ["noun number spelled out", Noun, { ...capelli, number: "plural" }],
    ["adjective missing a form", Adjective, { ...castano, forms: without(castano.forms, "fp") }],
    ["alsoMeans without value", Adjective, { ...castano, alsoMeans: [{ attr: "eyeColor" }] }],
    ["template with an unknown verb", Template, { ...haveAdj, verb: "v.sono" }],
    ["template with an unknown predicate", Template, { ...haveAdj, predicate: "colorIs" }],
  ] as const)("%s", (_, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  test("lexicon entry with an unknown pos", () => {
    expect(LexiconEntry.safeParse({ id: "x.di", pos: "preposition", text: "di" }).success).toBe(
      false,
    );
  });

  test.each([
    ["version 0", "version.json", { contentVersion: 0 }],
    ["fractional version", "version.json", { contentVersion: 1.5 }],
    ["message that is not a string", "messages.json", { duplicate: 3 }],
    ["released ids not strings", "released-ids.json", [1, 2]],
  ] as const)("%s", (_, file, value) => {
    expect(contentFiles[file].safeParse(value).success).toBe(false);
  });
});
