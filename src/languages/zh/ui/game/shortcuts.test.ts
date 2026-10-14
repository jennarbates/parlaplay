import { describe, expect, test } from "vitest";
import {
  keyToAction,
  type KeyLike,
  type ShortcutAction,
  type ShortcutContext,
} from "./shortcuts.ts";

// zh-desktop.md ZS 9.2 and 9.3: every cell of the table, and the invariants.

const key = (k: string, over: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  targetTag: "BODY",
  targetEditable: false,
  ...over,
});
const base: ShortcutContext = {
  phase: "playerTurn",
  level: 1,
  guessing: false,
  dialogOpen: false,
  answers: 0,
  trayEmpty: false,
  logEmpty: false,
};
const ctx = (over: Partial<ShortcutContext>): ShortcutContext => ({ ...base, ...over });

const keys = [
  "q",
  "b",
  "g",
  "Escape",
  "h",
  "n",
  "a",
  "Backspace",
  "/",
  "p",
  "t",
  "l",
  "?",
] as const;
type Cells = Partial<Record<(typeof keys)[number], ShortcutAction["type"]>>;

// The table as the spec prints it: what each key gives in each context ("-" left out).
const rows: [name: string, context: ShortcutContext, cells: Cells][] = [
  ["setup", ctx({ phase: "setup" }), { b: "focusBoard", "?": "openHelp" }],
  [
    "playerTurn L1",
    ctx({ phase: "playerTurn", level: 1 }),
    {
      q: "focusQuestions",
      b: "focusBoard",
      g: "startGuess",
      t: "switchPronoun",
      l: "focusLog",
      "?": "openHelp",
    },
  ],
  [
    "playerTurn L2",
    ctx({ phase: "playerTurn", level: 2 }),
    {
      q: "focusQuestions",
      b: "focusBoard",
      g: "startGuess",
      a: "ask",
      Backspace: "removeLast",
      "/": "focusFind",
      p: "togglePinyin",
      l: "focusLog",
      "?": "openHelp",
    },
  ],
  [
    "playerTurn L2, guessing",
    ctx({ phase: "playerTurn", level: 2, guessing: true }),
    { b: "focusBoard", Escape: "cancelGuess", p: "togglePinyin", l: "focusLog", "?": "openHelp" },
  ],
  [
    "playerTurn L1, guessing",
    ctx({ phase: "playerTurn", level: 1, guessing: true }),
    { b: "focusBoard", Escape: "cancelGuess", l: "focusLog", "?": "openHelp" },
  ],
  [
    "playerReview L2",
    ctx({ phase: "playerReview", level: 2 }),
    { b: "focusBoard", n: "next", p: "togglePinyin", l: "focusLog", "?": "openHelp" },
  ],
  [
    "playerReview L1",
    ctx({ phase: "playerReview", level: 1 }),
    { b: "focusBoard", n: "next", l: "focusLog", "?": "openHelp" },
  ],
  [
    "cpuTurn L1",
    ctx({ phase: "cpuTurn", level: 1, answers: 2 }),
    { b: "focusBoard", h: "showHint", l: "focusLog", "?": "openHelp" },
  ],
  [
    "cpuTurn L2",
    ctx({ phase: "cpuTurn", level: 2, answers: 7 }),
    { b: "focusBoard", p: "togglePinyin", l: "focusLog", "?": "openHelp" },
  ],
  [
    "cpuReview L2",
    ctx({ phase: "cpuReview", level: 2 }),
    { b: "focusBoard", n: "next", p: "togglePinyin", l: "focusLog", "?": "openHelp" },
  ],
  [
    "cpuReview L1",
    ctx({ phase: "cpuReview", level: 1 }),
    { b: "focusBoard", n: "next", l: "focusLog", "?": "openHelp" },
  ],
  ["over", ctx({ phase: "over" }), {}],
];

describe.each(rows)("%s", (_, context, cells) => {
  test.each(keys)("%s", (k) => {
    expect(keyToAction(key(k), context)?.type ?? null).toBe(cells[k] ?? null);
  });

  test("upper-case letters give the same as lower-case", () => {
    for (const k of keys)
      if (k.length === 1)
        expect(keyToAction(key(k.toUpperCase()), context)).toEqual(keyToAction(key(k), context));
  });

  test("1 to 7 answer only in cpuTurn, and only a number that has a button", () => {
    for (let n = 1; n <= 9; n++) {
      const action = keyToAction(key(String(n)), context);
      const expected =
        context.phase === "cpuTurn" && n <= context.answers
          ? { type: "answer", index: n - 1 }
          : null;
      expect(action).toEqual(expected);
    }
  });
});

describe("the footnotes", () => {
  test("¹ l does nothing with an empty log", () => {
    for (const [, context] of rows)
      expect(keyToAction(key("l"), { ...context, logEmpty: true })).toBeNull();
  });

  test("² a and Backspace do nothing with an empty tray", () => {
    const empty = ctx({ phase: "playerTurn", level: 2, trayEmpty: true });
    expect(keyToAction(key("a"), empty)).toBeNull();
    expect(keyToAction(key("Backspace"), empty)).toBeNull();
    expect(keyToAction(key("/"), empty)).toEqual({ type: "focusFind" });
  });

  test("⁴ at Level 1 only 1 and 2 answer", () => {
    const l1 = ctx({ phase: "cpuTurn", level: 1, answers: 2 });
    expect(keyToAction(key("1"), l1)).toEqual({ type: "answer", index: 0 });
    expect(keyToAction(key("2"), l1)).toEqual({ type: "answer", index: 1 });
    expect(keyToAction(key("3"), l1)).toBeNull();
  });
});

describe("invariants (ZS 9.3)", () => {
  const everyKey = [...keys, "1", "2", "3", "4", "5", "6", "7", "x", "Enter", "Tab", " "];

  test("nothing with Ctrl, Cmd or Alt held, in a field, or with a dialog open", () => {
    for (const [, context] of rows)
      for (const k of everyKey) {
        for (const modifier of ["ctrlKey", "metaKey", "altKey"] as const)
          expect(keyToAction(key(k, { [modifier]: true }), context)).toBeNull();
        for (const targetTag of ["INPUT", "TEXTAREA", "SELECT"])
          expect(keyToAction(key(k, { targetTag }), context)).toBeNull();
        expect(keyToAction(key(k, { targetEditable: true }), context)).toBeNull();
        expect(keyToAction(key(k), { ...context, dialogOpen: true })).toBeNull();
      }
  });

  test("each action only where it belongs", () => {
    for (const [, context] of rows)
      for (const k of everyKey) {
        const action = keyToAction(key(k), context);
        if (!action) continue;
        const { phase, level, guessing } = context;
        const building = phase === "playerTurn" && !guessing;
        switch (action.type) {
          case "answer":
            expect(phase).toBe("cpuTurn");
            expect(action.index).toBeLessThan(context.answers);
            break;
          case "next":
            expect(["playerReview", "cpuReview"]).toContain(phase);
            break;
          case "startGuess":
            expect(building).toBe(true);
            break;
          case "ask":
          case "removeLast":
            expect(building && level === 2 && !context.trayEmpty).toBe(true);
            break;
          case "focusFind":
            expect(building && level === 2).toBe(true);
            break;
          case "togglePinyin":
            expect(level).toBe(2);
            break;
          case "switchPronoun":
            expect(level).toBe(1);
            break;
        }
      }
  });

  test("keys that are not shortcuts give nothing", () => {
    for (const [, context] of rows)
      for (const k of ["x", "Enter", "Tab", " ", "ArrowDown", "8", "9", "0"])
        expect(keyToAction(key(k), context)).toBeNull();
  });
});

test("the spec's traced example (ZS 9.3)", () => {
  const context = ctx({ phase: "cpuTurn", level: 2, answers: 7, trayEmpty: true });
  expect(keyToAction(key("2"), context)).toEqual({ type: "answer", index: 1 });
  expect(keyToAction(key("2"), { ...context, level: 1, answers: 2 })).toEqual({
    type: "answer",
    index: 1,
  });
  expect(keyToAction(key("3"), { ...context, level: 1, answers: 2 })).toBeNull();
  expect(keyToAction(key("2", { metaKey: true }), context)).toBeNull();
});
