import { describe, expect, test } from "vitest";
import lexiconJson from "./lexicon.json";
import { Character, contentFiles, type Adjective, type Article, type Noun } from "./schemas.ts";

const lexicon = contentFiles["lexicon.json"].parse(lexiconJson);
const byId = new Map(lexicon.map((e) => [e.id, e]));
const nouns = lexicon.filter((e): e is Noun => e.pos === "noun");
const adjectives = lexicon.filter((e): e is Adjective => e.pos === "adj");
const articles = lexicon.filter((e): e is Article => e.pos === "article");
const verbs = lexicon.filter((e) => e.pos === "verb");
const articleText = (id: string | undefined) => (byId.get(id ?? "") as Article | undefined)?.text;

test("ids are unique", () => {
  expect(new Set(lexicon.map((e) => e.id)).size).toBe(lexicon.length);
});

test("the MVP word list from spec 3.3", () => {
  expect(nouns.map((n) => n.text).sort()).toEqual(
    ["baffi", "barba", "capelli", "cappello", "donna", "occhi", "occhiali", "uomo"].sort(),
  );
  expect(adjectives.map((a) => a.forms.ms).sort()).toEqual(
    [
      "azzurro",
      "bianco",
      "biondo",
      "castano",
      "corto",
      "lungo",
      "marrone",
      "nero",
      "rosso",
      "verde",
    ].sort(),
  );
  expect(verbs.map((v) => v.text).sort()).toEqual(["ha", "è"]);
  // The six from the spec, plus l' as uomo's definite article.
  expect(articles.map((a) => a.text).sort()).toEqual(
    ["gli", "i", "il", "l'", "la", "un", "una"].sort(),
  );
});

test("ids follow the prefix conventions", () => {
  for (const e of lexicon) {
    const prefix = { article: "art.", verb: "v.", noun: "n.", adj: "adj." }[e.pos];
    expect(e.id.startsWith(prefix), e.id).toBe(true);
  }
  for (const n of nouns) expect(n.id).toBe(`n.${n.text}`);
  for (const a of adjectives) expect(a.id).toBe(`adj.${a.forms.ms}`);
});

describe("nouns", () => {
  test.each(nouns.map((n) => [n.text, n] as const))("%s has everything it needs", (_, n) => {
    expect(byId.get(n.defArt)?.pos).toBe("article");
    if (n.indefArt) expect(byId.get(n.indefArt)?.pos).toBe("article");
    expect(n.artRule).toMatch(/^art\./);
    expect(["t.have", "t.have.adj", "t.be"]).toContain(n.template);
    if (n.template === "t.have") {
      expect(n.attr).toBeDefined();
      expect(n.adjAttrs).toBeUndefined();
    }
    if (n.template === "t.have.adj") {
      expect(n.adjAttrs?.length).toBeGreaterThan(0);
      expect(n.attr).toBeUndefined();
    }
    if (n.template === "t.be") {
      expect(n.indefArt).toBeDefined();
      expect(n.id).toMatch(/^n\.(uomo|donna)$/);
    }
  });

  test("every boolean attribute is asked by exactly one noun", () => {
    const booleans = ["glasses", "hat", "beard", "mustache"];
    expect(nouns.flatMap((n) => (n.attr ? [n.attr] : [])).sort()).toEqual(booleans.sort());
  });

  test("every adjective attribute is described by exactly one noun", () => {
    expect(nouns.flatMap((n) => n.adjAttrs ?? []).sort()).toEqual(
      ["eyeColor", "hairColor", "hairLength"].sort(),
    );
  });

  // Italian article rules, written independently of the data so a typo in either shows up.
  function expectedDefinite(n: Noun): string {
    const vowel = /^[aeiou]/.test(n.text);
    if (n.gender === "f") return n.number === "sg" ? (vowel ? "l'" : "la") : "le";
    if (n.number === "sg") return vowel ? "l'" : "il";
    return vowel ? "gli" : "i";
  }
  const expectedRule: Record<string, (n: Noun) => boolean> = {
    "art.msg.consonant": (n) => n.gender === "m" && n.number === "sg" && /^[^aeiou]/.test(n.text),
    "art.fsg": (n) => n.gender === "f" && n.number === "sg",
    "art.mpl.consonant": (n) => n.gender === "m" && n.number === "pl" && /^[^aeiou]/.test(n.text),
    "art.mpl.vowel": (n) => n.gender === "m" && n.number === "pl" && /^[aeiou]/.test(n.text),
    "art.indef.m": (n) => n.gender === "m" && n.template === "t.be",
    "art.indef.f": (n) => n.gender === "f" && n.template === "t.be",
  };

  test.each(nouns.map((n) => [n.text, n] as const))(
    "%s has the right articles and rule",
    (_, n) => {
      expect(articleText(n.defArt)).toBe(expectedDefinite(n));
      if (n.indefArt) expect(articleText(n.indefArt)).toBe(n.gender === "m" ? "un" : "una");
      expect(expectedRule[n.artRule]?.(n), n.artRule).toBe(true);
    },
  );

  test("the spec's gender and number", () => {
    const gn = Object.fromEntries(nouns.map((n) => [n.text, `${n.gender}${n.number}`]));
    expect(gn).toEqual({
      capelli: "mpl",
      occhi: "mpl",
      occhiali: "mpl",
      cappello: "msg",
      barba: "fsg",
      baffi: "mpl",
      uomo: "msg",
      donna: "fsg",
    });
  });
});

describe("adjectives", () => {
  test("every attribute value a character can have is an adjective of that attribute", () => {
    const attrs = Character.shape.attrs.shape;
    for (const key of ["hairColor", "hairLength", "eyeColor"] as const) {
      for (const value of attrs[key].options) {
        const adj = byId.get(value);
        expect(adj?.pos, value).toBe("adj");
        expect((adj as Adjective).attr, value).toBe(key);
      }
    }
  });

  test("gender values are the two t.be nouns", () => {
    for (const value of Character.shape.attrs.shape.gender.options) {
      expect((byId.get(value) as Noun | undefined)?.template).toBe("t.be");
    }
  });

  test.each(adjectives.map((a) => [a.forms.ms, a] as const))("%s forms are regular", (_, a) => {
    const { ms, fs, mp, fp } = a.forms;
    if (ms.endsWith("o")) {
      const stem = ms.slice(0, -1);
      // -co and -go adjectives keep the hard sound: bianchi, lunghi.
      const plStem = /[cg]$/.test(stem) ? `${stem}h` : stem;
      expect([fs, mp, fp]).toEqual([`${stem}a`, `${plStem}i`, `${plStem}e`]);
    } else {
      expect(ms.endsWith("e")).toBe(true);
      const stem = ms.slice(0, -1);
      expect([fs, mp, fp]).toEqual([ms, `${stem}i`, `${stem}i`]);
    }
  });

  test("castano also means brown eyes; marrone is wrong for hair (spec 3.3)", () => {
    expect((byId.get("adj.castano") as Adjective).alsoMeans).toEqual([
      { attr: "eyeColor", value: "adj.marrone" },
    ]);
    expect((byId.get("adj.marrone") as Adjective).wordChoice).toEqual([
      { noun: "n.capelli", use: "adj.castano" },
    ]);
  });

  test("alsoMeans and wordChoice point at real entries", () => {
    for (const a of adjectives) {
      for (const m of a.alsoMeans ?? []) expect((byId.get(m.value) as Adjective).attr).toBe(m.attr);
      for (const w of a.wordChoice ?? []) {
        expect(byId.get(w.noun)?.pos).toBe("noun");
        expect(byId.get(w.use)?.pos).toBe("adj");
      }
    }
  });
});

test("every noun and adjective has a level", () => {
  for (const e of [...nouns, ...adjectives]) expect(["A1", "A2"]).toContain(e.level);
});
