import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { checkInvariants, tonelessId } from "../../src/languages/zh/content/invariants.ts";
import { Character } from "../../src/languages/zh/content/schemas.ts";
import { generateCharacters, men, rng, women } from "./generate-characters.ts";

describe("generateCharacters", () => {
  test("same seed gives the same 24 characters", () => {
    expect(generateCharacters(2026)).toEqual(generateCharacters(2026));
  });

  test("different seeds give different sets", () => {
    expect(generateCharacters(1).characters).not.toEqual(generateCharacters(2).characters);
  });

  test("every seed's output passes all 3.2 invariants and the schema", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (seed) => {
        const { characters } = generateCharacters(seed);
        expect(checkInvariants(characters)).toEqual([]);
        for (const c of characters) Character.parse(c);
        for (const c of characters) expect(c.id).toBe(tonelessId(c.namePinyin));
        expect(new Set(characters.map((c) => c.id)).size).toBe(24);
      }),
      { numRuns: 200 },
    );
  });

  test("names come from the spec 3.2 list, men first and with the right gender", () => {
    const { characters } = generateCharacters(7);
    expect(characters.map((c) => [c.name, c.namePinyin])).toEqual([...men, ...women]);
    expect(characters.slice(0, 12).every((c) => c.attrs.gender === "n.nande")).toBe(true);
    expect(characters.slice(12).every((c) => c.attrs.gender === "n.nvde")).toBe(true);
  });
});

describe("rng", () => {
  test("is deterministic and in [0, 1)", () => {
    const a = rng(42);
    const b = rng(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  test("is roughly uniform", () => {
    const random = rng(1);
    const buckets = Array<number>(10).fill(0);
    for (let i = 0; i < 100_000; i++) {
      const b = Math.floor(random() * 10);
      buckets[b] = (buckets[b] ?? 0) + 1;
    }
    for (const b of buckets) expect(Math.abs(b - 10_000)).toBeLessThan(500);
  });
});
