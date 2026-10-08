import { describe, expect, test } from "vitest";
import { artFiles, layersFor } from "./art.ts";
import { content } from "./index.ts";
import type { Character } from "./schemas.ts";

const base: Character = {
  id: "c.test",
  name: "Test",
  attrs: {
    gender: "n.donna",
    hairColor: "adj.castano",
    hairLength: "adj.lungo",
    eyeColor: "adj.verde",
    glasses: false,
    hat: false,
    beard: false,
    mustache: false,
  },
  skin: "s3",
};
const withAttrs = (attrs: Partial<Character["attrs"]>): Character => ({
  ...base,
  attrs: { ...base.attrs, ...attrs },
});

describe("layersFor", () => {
  test("the always-present layers, in z order", () => {
    expect(layersFor(base)).toEqual([
      "bg.svg",
      "body-f.svg",
      "face-s3.svg",
      "eyes-verde.svg",
      "hair-castano-lungo.svg",
    ]);
  });

  test("every optional layer, in z order", () => {
    expect(
      layersFor(
        withAttrs({
          gender: "n.uomo",
          beard: true,
          mustache: true,
          glasses: true,
          hat: true,
          hairColor: "adj.rosso",
        }),
      ),
    ).toEqual([
      "bg.svg",
      "body-m.svg",
      "face-s3.svg",
      "eyes-verde.svg",
      "beard-rosso.svg",
      "mustache-rosso.svg",
      "hair-rosso-lungo.svg",
      "glasses.svg",
      "hat.svg",
    ]);
  });

  test.each([
    ["gender", { gender: "n.uomo" }, "body-m.svg"],
    ["hairColor", { hairColor: "adj.bianco" }, "hair-bianco-lungo.svg"],
    ["hairLength", { hairLength: "adj.corto" }, "hair-castano-corto.svg"],
    ["eyeColor", { eyeColor: "adj.azzurro" }, "eyes-azzurro.svg"],
    ["glasses", { glasses: true }, "glasses.svg"],
    ["hat", { hat: true }, "hat.svg"],
    ["beard", { beard: true }, "beard-castano.svg"],
    ["mustache", { mustache: true }, "mustache-castano.svg"],
  ] as const)("changing %s changes the picture", (_, attrs, file) => {
    expect(layersFor(base)).not.toContain(file);
    expect(layersFor(withAttrs(attrs))).toContain(file);
  });

  test("skin picks the face layer", () => {
    expect(layersFor({ ...base, skin: "s5" })).toContain("face-s5.svg");
  });

  test("facial hair is the hair color", () => {
    const layers = layersFor(
      withAttrs({ gender: "n.uomo", beard: true, mustache: true, hairColor: "adj.nero" }),
    );
    expect(layers).toContain("beard-nero.svg");
    expect(layers).toContain("mustache-nero.svg");
  });
});

describe("all 24 characters", () => {
  test.each(content.characters.map((c) => [c.name, c] as const))(
    "%s uses only manifest files, in z order",
    (_, c) => {
      const layers = layersFor(c);
      for (const file of layers) expect(artFiles).toContain(file);
      const z = layers.map((f) => artFiles.indexOf(f));
      expect(z).toEqual([...z].sort((a, b) => a - b));
    },
  );

  test("no two characters look the same", () => {
    const pictures = content.characters.map((c) =>
      layersFor(c)
        .filter((f) => !f.startsWith("face-"))
        .join(),
    );
    expect(new Set(pictures).size).toBe(24);
  });

  test("the deck uses both bodies, glasses and the hat", () => {
    const used = new Set(content.characters.flatMap(layersFor));
    for (const f of ["bg.svg", "body-m.svg", "body-f.svg", "glasses.svg", "hat.svg"])
      expect(used.has(f)).toBe(true);
  });
});
