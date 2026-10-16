// Chi è stato? GS 5.4: each invariant holds for every variant of every case, and
// each catches the case it exists to stop.
import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import type { Case } from "../content/schemas.ts";
import { answerKey } from "./answers.ts";
import { caseProblems, invariants, maxSolution, shortestSolution, variants } from "./invariants.ts";

const torta = content.cases.find((c) => c.id === "case.torta");
if (!torta) throw new Error("no case.torta");

describe.each(content.cases.map((c) => [c.id, c] as const))("%s", (_, c) => {
  test.each(Object.keys(invariants))("%s, for every variant", (name) => {
    expect(invariants[name]?.(c, content.frames)).toEqual([]);
  });

  test(`every variant is solvable in ${maxSolution} questions or fewer (GD8)`, () => {
    for (const v of variants(c))
      expect(shortestSolution(c, content.frames, v)?.length).toBeLessThanOrEqual(maxSolution);
  });

  test.todo("6. deterministic: the same seed and actions give the same states (PLAY-085)");
  test.todo("7. the budget never goes below 0, and only accepted questions lower it (PLAY-085)");
});

test("case 1 has 216 variants: 3 hiding places, 3 crime slots, 24 job orders", () => {
  expect(variants(torta)).toHaveLength(3 * 3 * 24);
  expect(new Set(variants(torta).map((v) => JSON.stringify(v))).size).toBe(216);
});

test("case 1's shortest solution is GS 4.3's five questions", () => {
  const v = variants(torta)[0];
  if (!v) throw new Error("no variant");
  const asked = shortestSolution(torta, content.frames, v)?.map(
    (q) => `${q.to} ${q.frame} ${q.qword}`,
  );
  expect(asked?.sort()).toEqual([
    "r.pairA f.at.slot q.con_chi",
    "r.pairB f.at.slot q.con_chi",
    "r.witness f.saw.slot q.chi",
    "r.witness f.saw.slot q.cosa",
    "r.witness f.stolen.torta q.quando",
  ]);
});

// Case 1 with one change, to show an invariant catches it.
function broken(change: (c: Case) => void): Case {
  const c = structuredClone(torta) as Case;
  change(c);
  return c;
}
const answer = (c: Case, key: string) => {
  const a = c.answers.find((x) => answerKey(x) === key);
  if (!a) throw new Error(key);
  return a;
};
const problems = (name: string, c: Case) => invariants[name]?.(c, content.frames) ?? [];

describe("each invariant catches a broken case", () => {
  test("1. nothing proves the time", () => {
    const c = broken((c) => delete answer(c, "r.witness:f.stolen.torta:-:q.quando").proves);
    expect(problems("unique solution", c)).toContainEqual(
      expect.stringMatching(
        /^case\.torta: hiding room\.\w+, crime slot \d: nothing proves the time$/,
      ),
    );
  });

  test("1. the culprit can be cleared", () => {
    const c = broken((c) =>
      answer(c, "r.witness:f.saw.slot:crime:q.chi").proves?.push({
        kind: "clears",
        role: "r.culprit",
      }),
    );
    expect(problems("unique solution", c)).toContainEqual(
      expect.stringContaining("the culprit can be cleared"),
    );
  });

  test("1. no suspect is the culprit", () => {
    const c = broken((c) => (c.suspects = c.suspects.filter((r) => r !== "r.culprit")));
    expect(problems("unique solution", c)).toContain("case.torta: no suspect is r.culprit");
  });

  test("2. more than 10 questions to solve", () => {
    // Clearing r.seen now also needs 8 more of the witness's answers: 5 + 8 = 13.
    const c = broken((c) => {
      const extra = c.answers
        .filter((a) => a.who === "r.witness" && !a.proves && !a.slot)
        .slice(0, 8)
        .map(answerKey);
      const clears = answer(c, "r.witness:f.saw.slot:crime:q.chi").proves?.[0];
      if (clears) clears.requires = extra;
    });
    expect(problems("solvable in budget", c)).toContainEqual(
      expect.stringContaining("the shortest solution takes 13 questions, more than 10"),
    );
  });

  test("2. no set of questions solves it", () => {
    const c = broken((c) => delete answer(c, "r.pairA:f.at.slot:crime:q.con_chi").proves);
    expect(problems("solvable in budget", c)).toContainEqual(
      expect.stringContaining("no set of questions solves it"),
    );
  });

  test("3. a lie proves something, or is contradicted by nothing true", () => {
    const lie = "r.culprit:f.at.slot:crime:q.dove";
    const c = broken((c) => {
      answer(c, lie).proves = [{ kind: "time" }];
      answer(c, lie).contradictedBy = [
        "r.nobody:f.at.slot:crime:q.dove",
        "r.culprit:f.doing.slot:crime:q.cosa",
      ];
      answer(c, "r.pairA:f.at.slot:crime:q.con_chi").proves?.[0]?.requires?.push(lie);
    });
    expect(problems("every lie is caught", c)).toEqual(
      expect.arrayContaining([
        `case.torta: ${lie} is a lie but proves something`,
        `case.torta: ${lie} is contradicted by r.nobody:f.at.slot:crime:q.dove, which is not an answer`,
        `case.torta: ${lie} is contradicted by r.culprit:f.doing.slot:crime:q.cosa, a lie too`,
        `case.torta: r.pairA:f.at.slot:crime:q.con_chi needs the lie ${lie} to prove clears`,
        expect.stringContaining(`nothing true that contradicts ${lie} can be heard`),
      ]),
    );
  });

  test("4. an answer nobody can hear", () => {
    const c = broken((c) =>
      c.answers.push({ who: "r.nobody", frame: "f.job", qword: "q.quale", text: "Sono nessuno." }),
    );
    expect(problems("no dead answers", c)).toContainEqual(
      expect.stringContaining("r.nobody:f.job:-:q.quale is never given"),
    );
  });

  test("5. a placeholder that does not resolve", () => {
    const c = broken(
      (c) => (answer(c, "r.pairA:f.at.slot:crime:q.con_chi").text = "Ero con {r.nessuno}."),
    );
    expect(problems("placeholders resolve", c)).toContainEqual(
      expect.stringContaining('"Ero con {r.nessuno}." keeps a placeholder'),
    );
  });

  test("caseProblems collects every invariant's problems", () => {
    expect(caseProblems(torta, content.frames)).toEqual([]);
    const c = broken((c) => delete answer(c, "r.witness:f.stolen.torta:-:q.quando").proves);
    expect(caseProblems(c, content.frames).length).toBeGreaterThan(0);
  });
});
