// Chi è stato? GS 5.2: every cell of the transition table, the budget, stars and
// accusing.
import { beforeEach, describe, expect, test, vi } from "vitest";
import * as inspector from "./inspector.ts";
import { answerKey } from "./answers.ts";
import { answerFor, solution } from "./ask.ts";
import { solve, solved } from "./solve.ts";
import { caseById, start } from "./start.ts";
import { starsFor, step } from "./step.ts";
import { askOf, engineContent, everyQuestion, run } from "./testing.ts";
import type { Action, CaseState, InspectorQuestion, Level } from "./types.ts";

vi.mock("./inspector.ts", { spy: true });

const torta = caseById(engineContent, "case.torta");
const begin = (level: Level = 2, seed = 7) => start(seed, "case.torta", level, engineContent);
const questions = everyQuestion("case.torta");

// n distinct questions whose answers prove nothing, to spend the budget with.
const proving = new Set(torta.answers.filter((a) => a.proves?.length).map(answerKey));
const fillers = (state: CaseState, n: number) =>
  questions
    .filter((b) => {
      const { key } = answerFor(state, b, engineContent);
      return key === null || !proving.has(key);
    })
    .slice(0, n);

const question: InspectorQuestion = {
  qword: "q.dove",
  text: "Dov'era Paolo tra le otto e le nove?",
  options: ["In biblioteca.", "Tra le otto e le nove.", "Con Marta."],
  answer: "In biblioteca.",
};
const inspecting = (): CaseState => ({ ...begin(), phase: "inspector", inspector: question });
const accuseRight = (s: CaseState): Action => ({
  type: "ACCUSE",
  role: "r.culprit",
  room: s.hide,
  slot: s.crime,
});

const witnessWhen = { to: "r.witness", frame: "f.stolen.torta", qword: "q.quando", form: "quando" };

beforeEach(() => {
  vi.mocked(inspector.inspectorQuestion).mockReset();
});

describe("asking", () => {
  test("ASK, accepted: the answer goes in the notebook and the budget drops by 1", () => {
    const s = begin();
    const { state, events } = run(s, askOf(witnessWhen));
    expect(state.phase).toBe("asking");
    expect(state.budget).toBe(14);
    expect(state.notebook).toHaveLength(1);
    expect(state.notebook[0]?.answer).toBe(`È sparita ${torta.slots[s.crime]}.`);
    expect(events[0]).toEqual({ type: "asked", entry: state.notebook[0] });
  });

  test("ASK, accepted at Level 2 rates the qword's produce card good; Level 1 rates nothing", () => {
    expect(run(begin(2), askOf(witnessWhen)).events).toContainEqual({
      type: "rating",
      lexiconId: "q.quando",
      direction: "produce",
      rating: "good",
    });
    expect(run(begin(1), askOf(witnessWhen)).events.map((e) => e.type)).toEqual(["asked"]);
  });

  test("ASK, accepted: the 4th goes to the inspector when she has a question", () => {
    vi.mocked(inspector.inspectorQuestion).mockReturnValue(question);
    const four = questions.slice(0, 4).map(askOf);
    const third = run(begin(), ...four.slice(0, 3));
    expect(third.state.phase).toBe("asking");
    expect(inspector.inspectorQuestion).not.toHaveBeenCalled();
    const { state, events } = run(third.state, four[3] as Action);
    expect(state.phase).toBe("inspector");
    expect(state.inspector).toEqual(question);
    expect(events.at(-1)).toEqual({ type: "inspectorAsked", question });
    expect(state.budget).toBe(11);
  });

  test("ASK, accepted: the inspector is asked again after the 8th, not after rejections", () => {
    vi.mocked(inspector.inspectorQuestion).mockReturnValue(undefined);
    const first = questions[0] as (typeof questions)[number];
    run(begin(), ...questions.slice(0, 3).map(askOf), askOf(first), askOf(first));
    expect(inspector.inspectorQuestion).not.toHaveBeenCalled();
    run(begin(), ...questions.slice(0, 8).map(askOf));
    expect(inspector.inspectorQuestion).toHaveBeenCalledTimes(2);
  });

  test("ASK, accepted: she skips her turn when she has no question", () => {
    const { state, events } = run(begin(), ...questions.slice(0, 4).map(askOf));
    expect(state.phase).toBe("asking");
    expect(state.inspector).toBeUndefined();
    expect(events.some((e) => e.type === "inspectorAsked")).toBe(false);
  });

  test.each([
    ["an unknown person", { ...witnessWhen, to: "r.nobody" }, "shape"],
    ["a frame not in the case", { ...witnessWhen, frame: "f.nope" }, "shape"],
    [
      "a slot frame without a slot",
      { to: "r.pairA", frame: "f.at.slot", qword: "q.dove", form: "dove" },
      "shape",
    ],
    [
      "a slot that is not one of the three",
      { to: "r.pairA", frame: "f.at.slot", slot: 3, qword: "q.dove", form: "dove" },
      "shape",
    ],
    ["a slot on a frame without one", { ...witnessWhen, slot: 1 }, "shape"],
    [
      "a question word the frame does not take",
      { ...witnessWhen, qword: "q.quanto", form: "quanto" },
      "nonsense",
    ],
  ] as const)("ASK, rejected for %s: budget unchanged", (_, built, reason) => {
    const s = begin();
    const { state, events } = run(s, askOf(built));
    expect(state).toBe(s);
    expect(events).toEqual([{ type: "rejected", reason }]);
  });

  test("ASK, rejected as a duplicate: budget unchanged, the earlier answer shown again", () => {
    const doing = { to: "r.witness", frame: "f.doing.slot", slot: 0, qword: "q.cosa" };
    const once = run(begin(), askOf({ ...doing, form: "cosa" })).state;
    const { state, events } = run(once, askOf({ ...doing, form: "che cosa" }));
    expect(state).toBe(once);
    expect(events).toEqual([{ type: "rejected", reason: "duplicate", earlier: once.notebook[0] }]);
  });

  test("the same question to a different person is a new question", () => {
    const at = { frame: "f.at.slot", slot: 0, qword: "q.dove", form: "dove" };
    const { state } = run(
      begin(),
      askOf({ ...at, to: "r.pairA" }),
      askOf({ ...at, to: "r.pairB" }),
    );
    expect(state.budget).toBe(13);
  });

  test("MARK clears and unclears a suspect, and never changes anything else", () => {
    const s = begin();
    const marked = run(s, { type: "MARK", role: "r.seen", cleared: true }).state;
    expect(marked).toEqual({ ...s, cleared: ["r.seen"] });
    const again = run(marked, { type: "MARK", role: "r.seen", cleared: true }).state;
    expect(again.cleared).toEqual(["r.seen"]);
    expect(run(marked, { type: "MARK", role: "r.seen", cleared: false }).state.cleared).toEqual([]);
  });

  test("MARK on someone who is not a suspect is ignored", () => {
    const s = begin();
    expect(run(s, { type: "MARK", role: "r.witness", cleared: true })).toEqual({
      state: s,
      events: [],
    });
  });

  test("ACCUSE ends the case", () => {
    const s = begin();
    const { state, events } = run(s, accuseRight(s));
    expect(state.phase).toBe("ended");
    expect(events).toEqual([{ type: "ended", solved: true, stars: 3 }]);
  });

  test.each([
    ["a suspect not in the case", { role: "r.witness" }],
    ["a room that does not exist", { room: 9 }],
    ["a slot that does not exist", { slot: -1 }],
  ])("ACCUSE with %s is ignored", (_, change) => {
    const s = begin();
    expect(run(s, { ...accuseRight(s), ...change })).toEqual({ state: s, events: [] });
  });

  test("budget 0: ASK is rejected and only ACCUSE moves on", () => {
    const spent = run(begin(), ...questions.slice(0, 15).map(askOf)).state;
    expect(spent.budget).toBe(0);
    const next = questions[15];
    if (!next) throw new Error("case 1 has fewer than 16 questions");
    const { state, events } = run(spent, askOf(next));
    expect(state).toBe(spent);
    expect(events).toEqual([{ type: "rejected", reason: "noBudget" }]);
    expect(run(spent, accuseRight(spent)).state.phase).toBe("ended");
  });
});

describe("inspector", () => {
  test("ANSWER_INSPECTOR goes back to asking", () => {
    const { state } = run(inspecting(), { type: "ANSWER_INSPECTOR", choice: "In biblioteca." });
    expect(state.phase).toBe("asking");
    expect(state.inspector).toBeUndefined();
  });

  test.each<[string, Action]>([
    ["ASK", askOf(witnessWhen)],
    ["ACCUSE", { type: "ACCUSE", role: "r.culprit", room: 0, slot: 0 }],
  ])("%s waits until she is answered", (_, action) => {
    const s = inspecting();
    expect(run(s, action)).toEqual({ state: s, events: [] });
  });

  test("MARK still works", () => {
    const { state } = run(inspecting(), { type: "MARK", role: "r.seen", cleared: true });
    expect(state).toMatchObject({ phase: "inspector", cleared: ["r.seen"] });
  });

  test("ANSWER_INSPECTOR outside her turn is ignored", () => {
    const s = begin();
    expect(run(s, { type: "ANSWER_INSPECTOR", choice: "x" })).toEqual({ state: s, events: [] });
  });
});

describe("quitting and the end", () => {
  test.each<[string, () => CaseState]>([
    ["asking", () => begin()],
    ["inspector", inspecting],
  ])("QUIT from %s ends the case as abandoned", (_, from) => {
    const { state, events } = run(from(), { type: "QUIT" });
    expect(state.phase).toBe("ended");
    expect(state.inspector).toBeUndefined();
    expect(state.result).toEqual({ solved: false, abandoned: true });
    expect(events).toEqual([{ type: "ended", solved: false, abandoned: true }]);
  });

  test.each<[string, Action]>([
    ["ASK", askOf(witnessWhen)],
    ["MARK", { type: "MARK", role: "r.seen", cleared: true }],
    ["ANSWER_INSPECTOR", { type: "ANSWER_INSPECTOR", choice: "x" }],
    ["ACCUSE", { type: "ACCUSE", role: "r.culprit", room: 0, slot: 0 }],
    ["QUIT", { type: "QUIT" }],
  ])("ended ignores %s", (_, action) => {
    const ended = run(begin(), { type: "QUIT" }).state;
    expect(run(ended, action)).toEqual({ state: ended, events: [] });
  });
});

describe("accusing", () => {
  test.each<[string, (s: CaseState) => Partial<Action>]>([
    ["the wrong suspect", () => ({ role: "r.seen" })],
    ["the wrong room", (s) => ({ room: (s.hide + 1) % torta.rooms.length })],
    ["the wrong slot", (s) => ({ slot: (s.crime + 1) % torta.slots.length })],
  ])("%s closes the case unsolved, with no stars", (_, change) => {
    const s = begin();
    const { state, events } = run(s, { ...accuseRight(s), ...change(s) } as Action);
    expect(state.result).toEqual({ solved: false });
    expect(events).toEqual([{ type: "ended", solved: false }]);
  });

  test("a suspect the learner marked cleared can still be accused", () => {
    const s = run(begin(), { type: "MARK", role: "r.culprit", cleared: true }).state;
    expect(run(s, accuseRight(s)).state.result).toEqual({ solved: true, stars: 3 });
  });

  test("the solution's answers prove the case, so a wrong accusation can show them", () => {
    const s = begin();
    const answers = solution(s, engineContent);
    expect(answers).toHaveLength(5);
    expect(solved(torta, solve(torta, answers))).toBe(true);
    expect(answers.map((e) => e.answer)).toContain(`È sparita ${torta.slots[s.crime]}.`);
    expect(answers.every((e) => !/[{}]/.test(e.answer))).toBe(true);
  });

  test.each([
    [9, 3],
    [10, 2],
    [12, 2],
    [13, 1],
    [15, 1],
  ] as const)("solved after %i questions: %i stars", (used, stars) => {
    const s = begin();
    const asked = run(s, ...fillers(s, used).map(askOf)).state;
    expect(asked.budget).toBe(15 - used);
    expect(run(asked, accuseRight(asked)).state.result).toEqual({ solved: true, stars });
  });

  test("starsFor follows GS 2 at every count", () => {
    expect([0, 5, 9, 10, 11, 12, 13, 14, 15].map(starsFor)).toEqual([3, 3, 3, 2, 2, 2, 1, 1, 1]);
  });
});

test("step never changes the state it was given", () => {
  const s = begin();
  const copy = structuredClone(s);
  run(s, askOf(witnessWhen), { type: "MARK", role: "r.seen", cleared: true }, accuseRight(s));
  expect(s).toEqual(copy);
});

test("step on a state it cannot place in the content throws, not ignores", () => {
  expect(() =>
    step({ ...begin(), caseId: "case.nope" }, askOf(witnessWhen), engineContent),
  ).toThrow("no case case.nope");
});
