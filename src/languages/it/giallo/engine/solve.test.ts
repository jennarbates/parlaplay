// Chi è stato? GS 5.4: solve() on case 1, as GS 4.3's shortest solution plays it.
import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import { solve, solved } from "./solve.ts";

const torta = content.cases.find((c) => c.id === "case.torta");
if (!torta) throw new Error("no case.torta");

const when = "r.witness:f.stolen.torta:-:q.quando";
const crumbs = "r.witness:f.saw.slot:crime:q.cosa";
const sawSeen = "r.witness:f.saw.slot:crime:q.chi";
const pairA = "r.pairA:f.at.slot:crime:q.con_chi";
const pairB = "r.pairB:f.at.slot:crime:q.con_chi";
const culpritLie = "r.culprit:f.at.slot:crime:q.dove";

const heard = (...keys: (string | null)[]) => keys.map((key) => ({ key }));

describe("solve", () => {
  test("an empty notebook proves nothing", () => {
    expect(solve(torta, [])).toEqual({ time: false, place: false, cleared: [] });
  });

  test("the witness's answers prove the time and the place, and clear r.seen", () => {
    expect(solve(torta, heard(when, crumbs, sawSeen))).toEqual({
      time: true,
      place: true,
      cleared: ["r.seen"],
    });
  });

  test("an alibi counts only with the answer it requires", () => {
    expect(solve(torta, heard(pairA)).cleared).toEqual([]);
    expect(solve(torta, heard(pairB)).cleared).toEqual([]);
    expect(solve(torta, heard(pairB, pairA)).cleared).toEqual(["r.pairA", "r.pairB"]);
  });

  test("a lie proves nothing, and the culprit is never cleared", () => {
    expect(solve(torta, heard(culpritLie))).toEqual({ time: false, place: false, cleared: [] });
    const everything = torta.answers.map((a) => `${a.who}:${a.frame}:${a.slot ?? "-"}:${a.qword}`);
    expect(solve(torta, heard(...everything)).cleared).not.toContain("r.culprit");
  });

  test("the default answer and unknown keys are ignored", () => {
    expect(solve(torta, heard(null, "r.nobody:f.x:-:q.chi"))).toEqual(solve(torta, []));
  });

  test("cleared roles come in the case's suspect order", () => {
    expect(solve(torta, heard(sawSeen, pairB, pairA)).cleared).toEqual([
      "r.pairA",
      "r.pairB",
      "r.seen",
    ]);
  });
});

describe("solved", () => {
  const all = [when, crumbs, sawSeen, pairA, pairB];

  test("GS 4.3's five answers solve case 1", () => {
    expect(solved(torta, solve(torta, heard(...all)))).toBe(true);
  });

  test.each(all)("without %s it is not solved", (missing) => {
    expect(solved(torta, solve(torta, heard(...all.filter((k) => k !== missing))))).toBe(false);
  });
});
