// Chi è stato? GS 4.3, Seeded variants: start() casts from the seed alone.
import { expect, test } from "vitest";
import { caseById, start } from "./start.ts";
import { engineContent } from "./testing.ts";

const torta = caseById(engineContent, "case.torta");
const seeds = Array.from({ length: 400 }, (_, i) => i * 7919 + 1);
const started = seeds.map((seed) => start(seed, "case.torta", 2, engineContent));

test("a new case is asking, with 15 questions, an empty notebook and nothing marked", () => {
  expect(started[0]).toMatchObject({
    caseId: "case.torta",
    seed: 1,
    level: 2,
    phase: "asking",
    budget: 15,
    notebook: [],
    cleared: [],
  });
});

test("the same seed casts the same case; the level changes nothing else", () => {
  const a = start(42, "case.torta", 1, engineContent);
  expect(start(42, "case.torta", 1, engineContent)).toEqual(a);
  expect(start(42, "case.torta", 2, engineContent)).toEqual({ ...a, level: 2 });
});

test("each role gets a different character, and each suspect a different job", () => {
  const characters = new Set(engineContent.characters.map((c) => c.id));
  for (const s of started) {
    expect(Object.keys(s.cast)).toEqual(torta.roles);
    expect(new Set(Object.values(s.cast)).size).toBe(torta.roles.length);
    for (const id of Object.values(s.cast)) expect(characters.has(id)).toBe(true);
    expect(Object.keys(s.jobs)).toEqual(torta.suspects);
    expect(Object.values(s.jobs).sort()).toEqual(torta.jobs.map((j) => j.id).sort());
  }
});

test("the hiding place and crime slot are ones the case allows, and every pair turns up", () => {
  const pairs = new Set<string>();
  for (const s of started) {
    expect(torta.hidePlaces).toContain(torta.rooms[s.hide]?.id);
    expect(torta.crimeSlots).toContain(s.crime);
    pairs.add(`${s.hide}:${s.crime}`);
  }
  expect(pairs.size).toBe(torta.hidePlaces.length * torta.crimeSlots.length);
});

test("the culprit is not tied to a job (GD13)", () => {
  expect(new Set(started.map((s) => s.jobs["r.culprit"])).size).toBe(torta.jobs.length);
});

test("an unknown case throws", () => {
  expect(() => start(1, "case.nope", 1, engineContent)).toThrow("no case case.nope");
});
