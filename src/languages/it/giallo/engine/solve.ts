// Chi è stato? GS 5.4: what a notebook proves. Each answer the learner has heard is
// in the notebook by its key (answers.ts); an answer's proofs count once every
// answer they require is in the notebook too. Pure.
import type { Case } from "../content/schemas.ts";
import { answerKey } from "./answers.ts";

export type Proven = {
  time: boolean; // the crime slot is known
  place: boolean; // the hiding place is known
  cleared: string[]; // suspect roles shown innocent, in the case's suspect order
};

// A notebook entry's answer key; null for the case's default answer, which proves
// nothing.
export type Heard = { key: string | null };

export function solve(c: Case, notebook: readonly Heard[]): Proven {
  const heard = new Set(notebook.flatMap((e) => (e.key === null ? [] : [e.key])));
  let time = false;
  let place = false;
  const cleared = new Set<string>();
  for (const answer of c.answers) {
    if (!heard.has(answerKey(answer))) continue;
    for (const proof of answer.proves ?? []) {
      if (!(proof.requires ?? []).every((k) => heard.has(k))) continue;
      if (proof.kind === "time") time = true;
      else if (proof.kind === "place") place = true;
      else cleared.add(proof.role);
    }
  }
  return { time, place, cleared: c.suspects.filter((r) => cleared.has(r)) };
}

// The role the case's story makes the thief (GS 4.3).
export const culprit = "r.culprit";

// Solved: the time and place are known, and every suspect but the culprit is
// cleared, so the culprit follows by elimination.
export function solved(c: Case, p: Proven): boolean {
  const innocent = c.suspects.filter((r) => r !== culprit);
  return (
    p.time &&
    p.place &&
    p.cleared.length === innocent.length &&
    innocent.every((r) => p.cleared.includes(r))
  );
}
