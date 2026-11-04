// Chi è stato? GS 9.1: the Level 1 picker's questions for one person.
import { describe, expect, test } from "vitest";
import { genderOf } from "./ask.ts";
import { pickerGroups } from "./picker.ts";
import { start } from "./start.ts";
import { step } from "./step.ts";
import { engineContent } from "./testing.ts";

const fresh = () => start(7, "case.torta", 1, engineContent);
const groups = (state = fresh(), role = "r.witness") => pickerGroups(state, role, engineContent);
const every = (state = fresh(), role = "r.witness") =>
  groups(state, role).flatMap((g) => g.questions);
const find = (text: string, state = fresh()) => {
  const q = every(state).find((x) => x.text === text);
  if (!q) throw new Error(`no question: ${text}`);
  return q;
};

describe("pickerGroups", () => {
  test("groups by question word, in lexicon order, labelled with the preposition", () => {
    const labels = groups().map((g) => g.label);
    expect(labels).toEqual(expect.arrayContaining(["Dove", "Con chi", "Di chi", "A che ora"]));
    const lexiconOrder = engineContent.lexicon.flatMap((x) => (x.pos === "qword" ? [x.id] : []));
    const ids = groups().map((g) => g.qword);
    expect(ids).toEqual(lexiconOrder.filter((id) => ids.includes(id)));
    for (const g of groups()) for (const q of g.questions) expect(q.built.qword).toBe(g.qword);
  });

  test("offers one person's questions only, each once", () => {
    const qs = every();
    expect(qs.every((q) => q.built.to === "r.witness")).toBe(true);
    expect(new Set(qs.map((q) => q.key)).size).toBe(qs.length);
  });

  test("each question is written out with its form, and its hint has the slot in English", () => {
    const q = find("Dov'era tra le otto e le nove?");
    expect(q.hint).toBe("Where were you between eight and nine?");
    expect(find("Di chi è questo ombrello?").hint).toBe("Whose umbrella is this?");
    for (const x of every()) {
      expect(x.text).not.toContain("{");
      expect(x.hint).not.toBe("");
      expect(x.hint).not.toContain("{");
    }
  });

  test("the body follows the gender of the person asked", () => {
    const state = fresh();
    for (const role of Object.keys(state.cast)) {
      const when = every(state, role).find((q) => q.built.frame === "f.arrive");
      const gender = genderOf(state, role, engineContent);
      expect(when?.text).toContain(gender === "f" ? "è arrivata" : "è arrivato");
    }
  });

  test("the engine accepts every question it offers, for everyone", () => {
    const state = fresh();
    for (const role of Object.keys(state.cast))
      for (const q of every(state, role)) {
        const { events } = step(state, { type: "ASK", built: q.built }, engineContent);
        expect(events[0]?.type, q.text).toBe("asked");
        expect(
          events.some((e) => e.type === "slip"),
          q.text,
        ).toBe(false);
      }
  });

  test("once asked, a question carries its answer, and only for that person", () => {
    const q = find("Quando è sparita la torta?");
    expect(q.asked).toBeUndefined();
    const { state } = step(fresh(), { type: "ASK", built: q.built }, engineContent);
    const after = find("Quando è sparita la torta?", state);
    expect(after.asked?.answer).toBe(state.notebook[0]?.answer);
    expect(after.asked?.answer).not.toBe("");
    const others = every(state, "r.culprit").filter((x) => x.asked);
    expect(others).toEqual([]);
  });

  test("the same seed gives the same questions, so a reload doesn't move them", () => {
    expect(groups()).toEqual(groups());
  });
});
