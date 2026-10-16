// Chi è stato? GS 4.3 and GS 5.1: a new case. The seed alone casts a character in
// each role, gives each suspect a job, and picks the hiding place and crime slot.
import { pickOne, seeded, shuffled } from "../../engine/random.ts";
import type { Case } from "../content/schemas.ts";
import type { Variant } from "./answers.ts";
import { budgetPerCase, type CaseState, type EngineContent, type Level } from "./types.ts";

export function caseById(content: EngineContent, caseId: string): Case {
  const c = content.cases.find((x) => x.id === caseId);
  if (!c) throw new Error(`no case ${caseId}`);
  return c;
}

export function start(
  seed: number,
  caseId: string,
  level: Level,
  content: EngineContent,
): CaseState {
  const c = caseById(content, caseId);
  const random = seeded(seed);
  // Roles and jobs are cast separately, so the culprit is never tied to a job.
  const characters = shuffled(
    random,
    content.characters.map((x) => x.id),
  );
  if (characters.length < c.roles.length)
    throw new Error(
      `${caseId} has ${c.roles.length} roles but only ${characters.length} characters`,
    );
  const jobs = shuffled(
    random,
    c.jobs.map((j) => j.id),
  );
  const hideId = pickOne(random, c.hidePlaces);
  return {
    caseId,
    seed,
    level,
    cast: Object.fromEntries(c.roles.map((r, i) => [r, characters[i] as string])),
    jobs: Object.fromEntries(c.suspects.map((r, i) => [r, jobs[i] ?? ""])),
    hide: c.rooms.findIndex((r) => r.id === hideId),
    crime: pickOne(random, c.crimeSlots),
    phase: "asking",
    budget: budgetPerCase,
    notebook: [],
    cleared: [],
  };
}

// The state's hiding place, crime slot and jobs, as answers.ts reads them.
export const variantOf = (s: CaseState): Variant => ({
  hide: s.hide,
  crime: s.crime,
  jobs: s.jobs,
});
