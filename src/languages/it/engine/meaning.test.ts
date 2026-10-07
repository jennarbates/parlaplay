import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import type { Adjective, Attrs, Noun, Template } from "../content/schemas.ts";
import { indexContent } from "./content.ts";
import { evaluate, keyOf, meaningFor, questionKey } from "./meaning.ts";

const index = indexContent(content);
const noun = (id: string) => index.noun.get(id) as Noun;
const adj = (id: string) => index.adj.get(id) as Adjective;
const template = (id: string) => index.template.get(id) as Template;

describe("meaningFor", () => {
  test("castani on occhi resolves to eyeColor adj.marrone", () => {
    expect(meaningFor(adj("adj.castano"), noun("n.occhi"))).toEqual({
      attr: "eyeColor",
      value: "adj.marrone",
    });
  });

  test("own attribute first: castani on capelli is hairColor adj.castano", () => {
    expect(meaningFor(adj("adj.castano"), noun("n.capelli"))).toEqual({
      attr: "hairColor",
      value: "adj.castano",
    });
  });

  test.each([
    ["adj.biondo", "n.capelli", { attr: "hairColor", value: "adj.biondo" }],
    ["adj.lungo", "n.capelli", { attr: "hairLength", value: "adj.lungo" }],
    ["adj.marrone", "n.occhi", { attr: "eyeColor", value: "adj.marrone" }],
    ["adj.verde", "n.occhi", { attr: "eyeColor", value: "adj.verde" }],
  ])("%s on %s", (a, n, expected) => {
    expect(meaningFor(adj(a), noun(n))).toEqual(expected);
  });

  test.each([
    ["adj.biondo", "n.occhi"],
    ["adj.lungo", "n.occhi"],
    ["adj.verde", "n.capelli"],
    ["adj.marrone", "n.capelli"],
    ["adj.nero", "n.occhi"],
    ["adj.biondo", "n.barba"],
  ])("%s on %s means nothing", (a, n) => {
    expect(meaningFor(adj(a), noun(n))).toBeUndefined();
  });

  test("the first matching alsoMeans wins", () => {
    const multi: Adjective = {
      ...adj("adj.castano"),
      attr: "beardColor",
      alsoMeans: [
        { attr: "skinTone", value: "x" },
        { attr: "hairColor", value: "adj.castano" },
        { attr: "eyeColor", value: "adj.marrone" },
      ],
    };
    expect(meaningFor(multi, noun("n.occhi"))).toEqual({ attr: "eyeColor", value: "adj.marrone" });
    expect(meaningFor(multi, noun("n.capelli"))).toEqual({
      attr: "hairColor",
      value: "adj.castano",
    });
  });
});

describe("keys", () => {
  test("format", () => {
    expect(questionKey("t.have.adj", "n.capelli", "adj.biondo")).toBe(
      "t.have.adj|n.capelli|adj.biondo",
    );
    expect(questionKey("t.have", "n.barba")).toBe("t.have|n.barba|");
  });

  test("castani and marroni on occhi share one key", () => {
    const occhi = noun("n.occhi");
    const t = template("t.have.adj");
    const castani = keyOf({
      template: t,
      noun: occhi,
      meaning: meaningFor(adj("adj.castano"), occhi),
    });
    const marroni = keyOf({
      template: t,
      noun: occhi,
      meaning: meaningFor(adj("adj.marrone"), occhi),
    });
    expect(castani).toBe(marroni);
    expect(castani).toBe("t.have.adj|n.occhi|adj.marrone");
  });
});

describe("evaluate", () => {
  const giulia = index.character.get("c.giulia")?.attrs as Attrs;
  const arbitraryAttrs = fc.record({
    gender: fc.constantFrom("n.uomo", "n.donna"),
    hairColor: fc.constantFrom("adj.biondo", "adj.castano", "adj.nero", "adj.rosso", "adj.bianco"),
    hairLength: fc.constantFrom("adj.corto", "adj.lungo"),
    eyeColor: fc.constantFrom("adj.azzurro", "adj.marrone", "adj.verde"),
    glasses: fc.boolean(),
    hat: fc.boolean(),
    beard: fc.boolean(),
    mustache: fc.boolean(),
  }) as fc.Arbitrary<Attrs>;

  test("hasFeature reads the noun's boolean attribute", () => {
    fc.assert(
      fc.property(arbitraryAttrs, (attrs) => {
        for (const [id, attr] of [
          ["n.occhiali", "glasses"],
          ["n.cappello", "hat"],
          ["n.barba", "beard"],
          ["n.baffi", "mustache"],
        ] as const) {
          expect(evaluate({ template: template("t.have"), noun: noun(id) }, attrs)).toBe(
            attrs[attr],
          );
        }
      }),
    );
  });

  test("featureIs compares the meaning's attribute", () => {
    fc.assert(
      fc.property(arbitraryAttrs, (attrs) => {
        const t = template("t.have.adj");
        const occhi = noun("n.occhi");
        expect(
          evaluate(
            { template: t, noun: occhi, meaning: meaningFor(adj("adj.castano"), occhi) },
            attrs,
          ),
        ).toBe(attrs.eyeColor === "adj.marrone");
        const capelli = noun("n.capelli");
        expect(
          evaluate(
            { template: t, noun: capelli, meaning: meaningFor(adj("adj.lungo"), capelli) },
            attrs,
          ),
        ).toBe(attrs.hairLength === "adj.lungo");
      }),
    );
  });

  test("genderIs compares gender with the noun", () => {
    fc.assert(
      fc.property(arbitraryAttrs, (attrs) => {
        expect(evaluate({ template: template("t.be"), noun: noun("n.donna") }, attrs)).toBe(
          attrs.gender === "n.donna",
        );
        expect(evaluate({ template: template("t.be"), noun: noun("n.uomo") }, attrs)).toBe(
          attrs.gender === "n.uomo",
        );
      }),
    );
  });

  test("Giulia from the spec examples", () => {
    expect(giulia).toBeDefined();
    const t = template("t.have.adj");
    const capelli = noun("n.capelli");
    expect(
      evaluate(
        { template: t, noun: capelli, meaning: meaningFor(adj("adj.biondo"), capelli) },
        giulia,
      ),
    ).toBe(giulia.hairColor === "adj.biondo");
  });

  test("featureIs without a meaning is false", () => {
    expect(evaluate({ template: template("t.have.adj"), noun: noun("n.capelli") }, giulia)).toBe(
      false,
    );
  });
});
