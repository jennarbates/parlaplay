// Chi è stato? GS 4.3: lookup order, slots, and filling placeholders, on case 1.
import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import { allQuestions, answerKey, fill, jobText, lookup, type Variant } from "./answers.ts";

const torta = content.cases.find((c) => c.id === "case.torta");
if (!torta) throw new Error("no case.torta");

// Hidden in the biblioteca, taken between eight and nine, Marta's casting of GS 4.3.
const v: Variant = {
  hide: torta.rooms.findIndex((r) => r.id === "room.biblioteca"),
  crime: 1,
  jobs: {
    "r.culprit": "j.cuoco",
    "r.pairA": "j.giardiniere",
    "r.pairB": "j.nipote",
    "r.seen": "j.vicino",
  },
};
const names = {
  "r.culprit": "Marta",
  "r.pairA": "Luca",
  "r.pairB": "Giulia",
  "r.seen": "Paolo",
  "r.witness": "Roberto",
};
const key = (q: Parameters<typeof lookup>[2]) => {
  const a = lookup(torta, v, q);
  return a && answerKey(a);
};

describe("lookup (GS 4.3)", () => {
  test("the person's role comes first", () => {
    expect(key({ to: "r.pairA", frame: "f.at.slot", slot: 1, qword: "q.con_chi" })).toBe(
      "r.pairA:f.at.slot:crime:q.con_chi",
    );
  });

  test("then their job, for answers about their life", () => {
    expect(key({ to: "r.culprit", frame: "f.arrive", qword: "q.quando" })).toBe(
      "j.cuoco:f.arrive:-:q.quando",
    );
    expect(key({ to: "r.seen", frame: "f.arrive", qword: "q.quando" })).toBe(
      "j.vicino:f.arrive:-:q.quando",
    );
  });

  test("then anyone's", () => {
    expect(key({ to: "r.pairA", frame: "f.job", qword: "q.quale" })).toBe("*:f.job:-:q.quale");
  });

  test("the crime slot and the other two are different questions", () => {
    const at = (slot: number) =>
      key({ to: "r.witness", frame: "f.saw.slot", slot, qword: "q.chi" });
    expect(at(1)).toBe("r.witness:f.saw.slot:crime:q.chi");
    expect(at(0)).not.toBe(at(1));
    expect(at(0)).toBe(at(2));
  });

  test("with no answer, the case's default", () => {
    expect(lookup(torta, v, { to: "r.pairA", frame: "f.cake", qword: "q.chi" })).toBeUndefined();
  });
});

describe("fill (GS 4.3, Placeholders)", () => {
  const speaker = (gender: "m" | "f", role: string) => ({
    names,
    gender,
    job: jobText(torta, v, role, gender),
  });

  test("names, the hiding place and the crime slot", () => {
    const answer = (k: string) => {
      const a = torta.answers.find((x) => answerKey(x) === k);
      if (!a) throw new Error(k);
      return fill(torta, v, a.text, speaker("m", "r.witness"));
    };
    expect(answer("r.witness:f.stolen.torta:-:q.quando")).toBe("È sparita tra le otto e le nove.");
    expect(answer("r.witness:f.saw.slot:crime:q.cosa")).toBe(
      "Ho visto delle briciole di torta in biblioteca.",
    );
    expect(answer("r.pairA:f.at.slot:crime:q.con_chi")).toBe("Ero con Giulia.");
  });

  test("the speaker's gender picks the text, and {job} their job", () => {
    expect(fill(torta, v, { m: "Sono {job}.", f: "Sono {job}!" }, speaker("f", "r.culprit"))).toBe(
      "Sono la cuoca!",
    );
    expect(fill(torta, v, "Sono {job}.", speaker("m", "r.witness"))).toBe("Sono il maggiordomo.");
  });

  test("an unknown placeholder is left for the invariants to find", () => {
    expect(fill(torta, v, "Ero con {r.nessuno}.", speaker("m", "r.pairA"))).toBe(
      "Ero con {r.nessuno}.",
    );
  });
});

test("allQuestions asks every person every frame, word and slot of the case", () => {
  const questions = allQuestions(torta, content.frames);
  const perPerson = questions.filter((q) => q.to === "r.witness");
  expect(questions).toHaveLength(perPerson.length * torta.roles.length);
  // f.at.slot: two words, three slots.
  expect(perPerson.filter((q) => q.frame === "f.at.slot")).toHaveLength(6);
  expect(perPerson.filter((q) => q.frame === "f.arrive")).toHaveLength(5);
  expect(perPerson.every((q) => (q.slot === undefined) !== q.frame.endsWith(".slot"))).toBe(true);
});
