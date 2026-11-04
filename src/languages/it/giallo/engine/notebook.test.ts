// Chi è stato? GS 2 and GS 9.1: the notebook's sections.
import { describe, expect, test } from "vitest";
import { notebookSections } from "./notebook.ts";
import { peopleOf } from "./people.ts";
import { pickerGroups } from "./picker.ts";
import { start } from "./start.ts";
import { step } from "./step.ts";
import { engineContent } from "./testing.ts";
import type { CaseState } from "./types.ts";

const begin = () => start(7, "case.torta", 1, engineContent);
const sections = (s: CaseState) => notebookSections(s, engineContent);

// Ask this person the n-th question the picker offers them.
const ask = (s: CaseState, role: string, n: number) => {
  const q = pickerGroups(s, role, engineContent).flatMap((g) => g.questions)[n];
  if (!q) throw new Error(`no question ${n}`);
  return step(s, { type: "ASK", built: q.built }, engineContent).state;
};

describe("notebookSections", () => {
  test("one section per person, in the order the screen shows them, empty at first", () => {
    const s = begin();
    expect(sections(s).map((x) => x.person)).toEqual(peopleOf(s, engineContent));
    for (const x of sections(s)) expect(x.entries).toEqual([]);
  });

  test("answers stay under their person, in the order given, with their questions", () => {
    let s = begin();
    s = ask(s, "r.witness", 2);
    s = ask(s, "r.pairA", 0);
    s = ask(s, "r.witness", 0);
    const of = (role: string) => sections(s).find((x) => x.person.role === role)?.entries;
    const [late, early] = [s.notebook[0], s.notebook[2]];
    expect(of("r.witness")?.map((e) => e.answer)).toEqual([late?.answer, early?.answer]);
    expect(of("r.pairA")?.map((e) => e.answer)).toEqual([s.notebook[1]?.answer]);
    expect(of("r.pairB")).toEqual([]);
    for (const e of of("r.witness") ?? []) expect(e.question).toMatch(/\?$/);
    const offered = pickerGroups(s, "r.witness", engineContent).flatMap((g) => g.questions);
    expect(of("r.witness")?.[0]?.question).toBe(offered[2]?.text);
  });

  test("only a suspect can be cleared, and marking changes nothing else", () => {
    const s = ask(begin(), "r.pairA", 0);
    expect(
      sections(s)
        .filter((x) => !x.canClear)
        .map((x) => x.person.role),
    ).toEqual(["r.witness"]);

    const marked = step(s, { type: "MARK", role: "r.pairA", cleared: true }, engineContent);
    expect(marked.events).toEqual([]);
    expect(marked.state.budget).toBe(s.budget);
    const of = (st: CaseState) => sections(st).find((x) => x.person.role === "r.pairA");
    expect(of(marked.state)?.cleared).toBe(true);
    expect(of(marked.state)?.entries).toEqual(of(s)?.entries);

    const unmarked = step(
      marked.state,
      { type: "MARK", role: "r.pairA", cleared: false },
      engineContent,
    );
    expect(of(unmarked.state)?.cleared).toBe(false);
    const witness = step(s, { type: "MARK", role: "r.witness", cleared: true }, engineContent);
    expect(witness.state).toBe(s);
  });
});
