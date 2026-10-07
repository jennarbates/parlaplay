import { expect, test } from "vitest";
import { content } from "../content/index.ts";
import type { Character } from "../content/schemas.ts";
import { describeCharacter } from "./describe.ts";

const make = (attrs: Partial<Character["attrs"]>): Character => ({
  id: "c.giulia",
  name: "Giulia",
  skin: "s1",
  attrs: {
    gender: "n.donna",
    hairColor: "adj.castano",
    hairLength: "adj.lungo",
    eyeColor: "adj.verde",
    glasses: true,
    hat: false,
    beard: false,
    mustache: false,
    ...attrs,
  },
});

test("the spec's example, word for word", () => {
  expect(describeCharacter(make({}), content.lexicon)).toBe(
    "Giulia: capelli castani lunghi, occhi verdi, occhiali",
  );
});

test("every accessory, in a fixed order, and brown eyes in the default wording", () => {
  expect(
    describeCharacter(
      make({
        hairColor: "adj.bianco",
        hairLength: "adj.corto",
        eyeColor: "adj.marrone",
        hat: true,
        beard: true,
        mustache: true,
      }),
      content.lexicon,
    ),
  ).toBe("Giulia: capelli bianchi corti, occhi marroni, occhiali, cappello, barba, baffi");
});

test("all 24 characters get a distinct name, all in Italian words", () => {
  const names = content.characters.map((c) => describeCharacter(c, content.lexicon));
  expect(new Set(names).size).toBe(24);
  for (const n of names)
    expect(n).toMatch(/^[A-Z][a-z]+: capelli [a-z]+ [a-z]+, occhi [a-z]+(, [a-z]+)*$/);
});
