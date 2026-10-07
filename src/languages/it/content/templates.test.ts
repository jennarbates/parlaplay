import { describe, expect, test } from "vitest";
import lexiconJson from "./lexicon.json";
import { contentFiles, type Article, type Noun, type Verb } from "./schemas.ts";
import templatesJson from "./templates.json";

const templates = contentFiles["templates.json"].parse(templatesJson);
const lexicon = contentFiles["lexicon.json"].parse(lexiconJson);
const byId = new Map(lexicon.map((e) => [e.id, e]));
const nouns = lexicon.filter((e): e is Noun => e.pos === "noun");

test("the three templates from spec 3.4", () => {
  expect(
    templates.map((t) => [t.id, t.pattern, t.verb, t.article, t.needsAdj, t.predicate]),
  ).toEqual([
    ["t.have", "Ha {art} {noun}?", "v.ha", "def", false, "hasFeature"],
    ["t.have.adj", "Ha {art} {noun} {adj}?", "v.ha", "def", true, "featureIs"],
    ["t.be", "È {art} {noun}?", "v.e", "indef", false, "genderIs"],
  ]);
});

describe.each(templates.map((t) => [t.id, t] as const))("%s", (_, t) => {
  test("starts with its verb's text, capitalized", () => {
    const verb = byId.get(t.verb) as Verb;
    expect(verb.pos).toBe("verb");
    const capitalized = verb.text.charAt(0).toUpperCase() + verb.text.slice(1);
    expect(t.pattern.startsWith(`${capitalized} `)).toBe(true);
  });

  test("has exactly the placeholders it needs, in builder order", () => {
    const slots = [...t.pattern.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    expect(slots).toEqual(t.needsAdj ? ["art", "noun", "adj"] : ["art", "noun"]);
    expect(t.pattern.endsWith("?")).toBe(true);
  });

  test("is used by at least one noun, and its nouns have the article it asks for", () => {
    const users = nouns.filter((n) => n.template === t.id);
    expect(users.length).toBeGreaterThan(0);
    for (const n of users) {
      const art = t.article === "def" ? n.defArt : n.indefArt;
      expect((byId.get(art ?? "") as Article | undefined)?.pos, n.id).toBe("article");
    }
  });

  test("its predicate fits its nouns", () => {
    const users = nouns.filter((n) => n.template === t.id);
    for (const n of users) {
      if (t.predicate === "hasFeature") expect(n.attr, n.id).toBeDefined();
      if (t.predicate === "featureIs") expect(n.adjAttrs?.length, n.id).toBeGreaterThan(0);
      if (t.predicate === "genderIs") expect(["n.uomo", "n.donna"]).toContain(n.id);
    }
  });
});

test("every noun's template exists", () => {
  const ids = new Set(templates.map((t) => t.id));
  for (const n of nouns) expect(ids.has(n.template), n.id).toBe(true);
});

test("16 possible questions, as spec 3.1 counts them", () => {
  // t.have: one per boolean noun. t.be: uomo and donna. t.have.adj: one per
  // adjective value each noun can describe (brown eyes counted once).
  const adjectives = lexicon.filter((e) => e.pos === "adj");
  const count = nouns.reduce((sum, n) => {
    if (n.template !== "t.have.adj") return sum + 1;
    return sum + adjectives.filter((a) => n.adjAttrs?.includes(a.attr)).length;
  }, 0);
  expect(count).toBe(16);
});
