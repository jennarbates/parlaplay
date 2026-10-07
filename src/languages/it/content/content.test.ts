// CHI-026, spec 3.6 and 10.2: content tests across files.
import { describe, expect, test } from "vitest";
import { allIds, content, contentVersion, missingReleasedIds, releasedIds } from "./index.ts";
import { checkInvariants, maxYes, minYes, questions, yesCount, attrsKey } from "./invariants.ts";
import { contentFiles, type Adjective, type Noun } from "./schemas.ts";

const { characters, lexicon, templates, messages } = content;
const byId = new Map(lexicon.map((e) => [e.id, e]));
const nouns = lexicon.filter((e): e is Noun => e.pos === "noun");
const adjectives = lexicon.filter((e): e is Adjective => e.pos === "adj");
const templateIds = new Set(templates.map((t) => t.id));

describe("every file passes its schema", () => {
  test.each([
    ["characters.json", characters],
    ["lexicon.json", lexicon],
    ["templates.json", templates],
    ["messages.json", messages],
    ["version.json", { contentVersion }],
    ["released-ids.json", releasedIds],
  ] as const)("%s", (file, data) => {
    expect(contentFiles[file].safeParse(data).success).toBe(true);
  });
});

describe("spec 3.2 invariants on the committed characters", () => {
  test("no two characters have the same 8 attribute values", () => {
    expect(new Set(characters.map((c) => attrsKey(c.attrs))).size).toBe(characters.length);
  });

  test("women have no beard and no mustache", () => {
    for (const c of characters.filter((c) => c.attrs.gender === "n.donna")) {
      expect([c.attrs.beard, c.attrs.mustache], c.id).toEqual([false, false]);
    }
  });

  test("12 men, 12 women", () => {
    expect(characters.filter((c) => c.attrs.gender === "n.uomo")).toHaveLength(12);
    expect(characters.filter((c) => c.attrs.gender === "n.donna")).toHaveLength(12);
  });

  test.each(questions.map((q) => [q.label, q] as const))(
    `%s gets yes from ${minYes} to ${maxYes} characters`,
    (_, q) => {
      const n = yesCount(characters, q);
      expect(n).toBeGreaterThanOrEqual(minYes);
      expect(n).toBeLessThanOrEqual(maxYes);
    },
  );

  test("and the shared checker agrees", () => {
    expect(checkInvariants(characters)).toEqual([]);
  });
});

describe("every referenced id and message key exists", () => {
  test("ids are unique across all content", () => {
    const ids = allIds(content);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("character attribute values are lexicon entries", () => {
    for (const c of characters) {
      for (const key of ["gender", "hairColor", "hairLength", "eyeColor"] as const) {
        expect(byId.has(c.attrs[key]), `${c.id} ${key}`).toBe(true);
      }
    }
  });

  test.each(nouns.map((n) => [n.id, n] as const))("%s", (_, n) => {
    expect(byId.get(n.defArt)?.pos).toBe("article");
    if (n.indefArt) expect(byId.get(n.indefArt)?.pos).toBe("article");
    expect(templateIds.has(n.template)).toBe(true);
    expect(messages[n.artRule]).toBeDefined();
    const describable = new Set(adjectives.map((a) => a.attr));
    for (const attr of n.adjAttrs ?? []) expect(describable.has(attr), attr).toBe(true);
    if (n.attr) expect(["glasses", "hat", "beard", "mustache"]).toContain(n.attr);
  });

  test.each(adjectives.map((a) => [a.id, a] as const))("%s", (_, a) => {
    for (const m of a.alsoMeans ?? []) expect(byId.get(m.value)?.pos).toBe("adj");
    for (const w of a.wordChoice ?? []) {
      expect(byId.get(w.noun)?.pos).toBe("noun");
      expect(byId.get(w.use)?.pos).toBe("adj");
    }
  });

  test("template verbs are lexicon verbs", () => {
    for (const t of templates) expect(byId.get(t.verb)?.pos, t.id).toBe("verb");
  });

  test("every rule the engine reports has a message", () => {
    const rules = new Set(nouns.map((n) => n.artRule));
    for (const key of [
      "verb.avere",
      "verb.essere",
      "agreement",
      "meaning.mismatch",
      "meaning.wordChoice",
      "duplicate",
      "answer.wrong",
      "shape.noVerb",
      "shape.noArt",
      "shape.noNoun",
      "shape.needsAdj",
      "shape.noAdjAllowed",
      ...rules,
    ]) {
      expect(messages[key], key).toBeDefined();
    }
  });
});

describe("released ids (spec 3.6)", () => {
  test("every id in released-ids.json still exists", () => {
    expect(missingReleasedIds(releasedIds, content)).toEqual([]);
  });

  test("a released id that disappears is reported", () => {
    const withoutGiulia = { ...content, characters: characters.filter((c) => c.id !== "c.giulia") };
    expect(missingReleasedIds(["c.giulia", "n.capelli"], withoutGiulia)).toEqual(["c.giulia"]);
  });

  test("retiring a word keeps its id, so it is not missing", () => {
    const retired = {
      ...content,
      lexicon: lexicon.map((e) => (e.id === "adj.rosso" ? { ...e, retired: true } : e)),
    };
    expect(missingReleasedIds(["adj.rosso"], retired)).toEqual([]);
  });

  test("released ids are unique", () => {
    expect(new Set(releasedIds).size).toBe(releasedIds.length);
  });
});

test("contentVersion is a positive integer", () => {
  expect(Number.isInteger(contentVersion) && contentVersion > 0).toBe(true);
});
