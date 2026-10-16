// Chi è stato? GS 5.4: the invariants every case holds for every seeded variant.
// The content tests run them, and so does the build (scripts/content-check.ts), so
// a case that cannot be solved never ships. Invariants 6 and 7 are about step()
// and are tested with it.
import type { Case, Frame } from "../content/schemas.ts";
import {
  allQuestions,
  answerKey,
  fill,
  jobText,
  lookup,
  type Question,
  type Variant,
} from "./answers.ts";
import { culprit, solve, solved } from "./solve.ts";

// GD8: a case allows 15 questions and must be solvable in 10.
export const maxSolution = 10;

// Every variant the seed can pick: a hiding place, a crime slot, and an order of
// jobs over the suspects.
export function variants(c: Case): Variant[] {
  const hides = c.hidePlaces.map((id) => c.rooms.findIndex((r) => r.id === id));
  const jobOrders = permutations(c.jobs.map((j) => j.id));
  return hides.flatMap((hide) =>
    c.crimeSlots.flatMap((crime) =>
      jobOrders.map((order) => ({
        hide,
        crime,
        jobs: Object.fromEntries(c.suspects.map((r, i) => [r, order[i] ?? ""])),
      })),
    ),
  );
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

// Each answer the variant can give, by key, with one question that gets it.
export function reachable(c: Case, frames: readonly Frame[], v: Variant): Map<string, Question> {
  const found = new Map<string, Question>();
  for (const q of allQuestions(c, frames)) {
    const answer = lookup(c, v, q);
    if (answer && !found.has(answerKey(answer))) found.set(answerKey(answer), q);
  }
  return found;
}

// The fewest questions that solve the variant, or null if no set does. Only
// answers with proofs, and the answers those proofs require, can help, so the
// search is over subsets of those, smallest first.
export function shortestSolution(c: Case, frames: readonly Frame[], v: Variant): Question[] | null {
  const heard = reachable(c, frames, v);
  const useful = [
    ...new Set(
      c.answers
        .filter((a) => a.proves?.length)
        .flatMap((a) => [answerKey(a), ...(a.proves ?? []).flatMap((p) => p.requires ?? [])]),
    ),
  ].filter((k) => heard.has(k));
  for (let size = 0; size <= useful.length; size++)
    for (const keys of combinations(useful, size))
      if (
        solved(
          c,
          solve(
            c,
            keys.map((key) => ({ key })),
          ),
        )
      )
        return keys.map((k) => heard.get(k) as Question);
  return null;
}

function* combinations<T>(items: readonly T[], size: number, from = 0): Generator<T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = from; i <= items.length - size; i++)
    for (const rest of combinations(items, size - 1, i + 1)) yield [items[i] as T, ...rest];
}

type Check = (c: Case, frames: readonly Frame[]) => string[];

// Runs fn for every variant, with a label for its problems and what it can hear.
// Problems repeat across job orders, so each is kept once.
function perVariant(
  c: Case,
  frames: readonly Frame[],
  fn: (v: Variant, heard: Map<string, Question>, add: (text: string) => void) => void,
): string[] {
  const problems = new Set<string>();
  for (const v of variants(c)) {
    const at = `hiding ${c.rooms[v.hide]?.id}, crime slot ${v.crime}`;
    fn(v, reachable(c, frames, v), (text) => problems.add(`${c.id}: ${at}: ${text}`));
  }
  return [...problems];
}

const innocentOf = (c: Case) => c.suspects.filter((r) => r !== culprit);

// GS 5.4, 1 to 5. Invariants 6 and 7 are about step() and are tested with it.
export const invariants: Record<string, Check> = {
  // 1. Asking everything proves the time, the place and every innocent suspect,
  // and never clears the culprit.
  "unique solution": (c, frames) => [
    ...(c.suspects.includes(culprit) ? [] : [`${c.id}: no suspect is ${culprit}`]),
    ...perVariant(c, frames, (_, heard, add) => {
      const all = solve(
        c,
        [...heard.keys()].map((key) => ({ key })),
      );
      if (!all.time) add("nothing proves the time");
      if (!all.place) add("nothing proves the place");
      for (const r of innocentOf(c)) if (!all.cleared.includes(r)) add(`nothing clears ${r}`);
      if (all.cleared.includes(culprit)) add("the culprit can be cleared");
    }),
  ],

  // 2. Some set of at most 10 questions solves it. Jobs prove nothing, so one job
  // order per hiding place and crime slot is enough.
  "solvable in budget": (c, frames) => {
    const done = new Set<string>();
    return perVariant(c, frames, (v, _, add) => {
      const sig = `${v.hide}:${v.crime}`;
      if (done.has(sig)) return;
      done.add(sig);
      const size = shortestSolution(c, frames, v)?.length;
      if (size === undefined) add("no set of questions solves it");
      else if (size > maxSolution)
        add(`the shortest solution takes ${size} questions, more than ${maxSolution}`);
    });
  },

  // 3. Every lie is contradicted by a truthful answer that can be heard, and
  // nothing is proved by a lie.
  "every lie is caught": (c, frames) => {
    const byKey = new Map(c.answers.map((a) => [answerKey(a), a]));
    const problems: string[] = [];
    for (const a of c.answers) {
      const key = answerKey(a);
      if (a.lie && a.proves?.length) problems.push(`${c.id}: ${key} is a lie but proves something`);
      for (const other of a.contradictedBy ?? []) {
        const truth = byKey.get(other);
        if (!truth)
          problems.push(`${c.id}: ${key} is contradicted by ${other}, which is not an answer`);
        else if (truth.lie) problems.push(`${c.id}: ${key} is contradicted by ${other}, a lie too`);
      }
      for (const p of a.proves ?? [])
        for (const req of p.requires ?? [])
          if (byKey.get(req)?.lie)
            problems.push(`${c.id}: ${key} needs the lie ${req} to prove ${p.kind}`);
    }
    return [
      ...problems,
      ...perVariant(c, frames, (_, heard, add) => {
        for (const a of c.answers.filter((a) => a.lie))
          if (!(a.contradictedBy ?? []).some((k) => heard.has(k) && !byKey.get(k)?.lie))
            add(`nothing true that contradicts ${answerKey(a)} can be heard`);
      }),
    ];
  },

  // 4. Every question gets an answer or the default (lookup guarantees it), and
  // every answer written can be heard: none is hidden behind another.
  "no dead answers": (c, frames) =>
    perVariant(c, frames, (_, heard, add) => {
      for (const a of c.answers)
        if (!heard.has(answerKey(a))) add(`${answerKey(a)} is never given`);
    }),

  // 5. No answer keeps a {placeholder} once filled, for a man and a woman speaking.
  "placeholders resolve": (c, frames) => {
    const names = Object.fromEntries(c.roles.map((r) => [r, r]));
    const questions = allQuestions(c, frames);
    return perVariant(c, frames, (v, _, add) => {
      for (const q of questions) {
        const text = lookup(c, v, q)?.text ?? c.default;
        for (const gender of ["m", "f"] as const) {
          const filled = fill(c, v, text, { names, gender, job: jobText(c, v, q.to, gender) });
          if (/[{}]/.test(filled)) add(`"${filled}" keeps a placeholder`);
        }
      }
    });
  },
};

// Every broken invariant, as "case.id: problem" lines; [] when the case is sound.
export function caseProblems(c: Case, frames: readonly Frame[]): string[] {
  return Object.values(invariants).flatMap((check) => check(c, frames));
}
