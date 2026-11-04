// Chi è stato? GS 9.1 and GS 10: who the people strip shows, and in what order.
import { describe, expect, test } from "vitest";
import { peopleOf } from "./people.ts";
import { start } from "./start.ts";
import { engineContent } from "./testing.ts";

const people = (seed: number) =>
  peopleOf(start(seed, "case.torta", 2, engineContent), engineContent);

describe("peopleOf", () => {
  test("shows all 5, each with a name and job, and the witness last", () => {
    const shown = people(7);
    expect(shown).toHaveLength(5);
    expect(new Set(shown.map((p) => p.role)).size).toBe(5);
    expect(shown.at(-1)?.role).toBe("r.witness");
    for (const p of shown) expect(p.label).toMatch(new RegExp(`^${p.character.name}, \\S+`));
  });

  test("the same seed gives the same order, so a reload doesn't move anyone", () => {
    expect(people(7)).toEqual(people(7));
  });

  test("a face's position says nothing about who took it", () => {
    const seeds = 800;
    const at = [0, 0, 0, 0];
    for (let seed = 1; seed <= seeds; seed++) {
      const i = people(seed).findIndex((p) => p.role === "r.culprit");
      at[i] = (at[i] ?? 0) + 1;
    }
    // Each of the 4 suspect positions, about a quarter of the time.
    for (const n of at) expect(n / seeds).toBeGreaterThan(0.18);
  });
});
