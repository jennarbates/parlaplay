import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  keyToAction,
  type KeyLike,
  type ShortcutAction,
  type ShortcutContext,
} from "./shortcuts.ts";

// Desktop spec DS 4.4: every cell of the DS 4.2 table, the DS 4.3 order of
// checks, and the invariants.

const press = (key: string, over: Partial<KeyLike> = {}): KeyLike => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  targetTag: "BODY",
  targetEditable: false,
  ...over,
});

const ctx = (over: Partial<ShortcutContext> = {}): ShortcutContext => ({
  phase: "playerTurn",
  level: 1,
  guessing: false,
  dialogOpen: false,
  ...over,
});

const keys = ["q", "b", "g", "Escape", "s", "n", "h", "a", "?"] as const;
type Key = (typeof keys)[number];

const fb: ShortcutAction = { type: "focusBoard" };
const help: ShortcutAction = { type: "openHelp" };
const next: ShortcutAction = { type: "next" };
const yes: ShortcutAction = { type: "answer", value: true };
const no: ShortcutAction = { type: "answer", value: false };

// DS 4.2, written out again here so the test does not share the code's table.
const rows: { name: string; ctx: ShortcutContext; cells: Partial<Record<Key, ShortcutAction>> }[] =
  [
    { name: "setup", ctx: ctx({ phase: "setup" }), cells: { b: fb, "?": help } },
    {
      name: "playerTurn, not guessing",
      ctx: ctx(),
      cells: { q: { type: "focusQuestions" }, b: fb, g: { type: "startGuess" }, "?": help },
    },
    {
      name: "playerTurn, guessing",
      ctx: ctx({ guessing: true }),
      cells: { b: fb, Escape: { type: "cancelGuess" }, "?": help },
    },
    {
      name: "playerReview",
      ctx: ctx({ phase: "playerReview" }),
      cells: { b: fb, a: next, "?": help },
    },
    {
      name: "cpuTurn, level 1",
      ctx: ctx({ phase: "cpuTurn" }),
      cells: { b: fb, s: yes, n: no, h: { type: "showHint" }, "?": help },
    },
    {
      name: "cpuTurn, level 2",
      ctx: ctx({ phase: "cpuTurn", level: 2 }),
      cells: { b: fb, s: yes, n: no, "?": help },
    },
    { name: "cpuReview", ctx: ctx({ phase: "cpuReview" }), cells: { b: fb, a: next, "?": help } },
    { name: "over", ctx: ctx({ phase: "over" }), cells: {} },
  ];

describe("every cell of DS 4.2", () => {
  for (const row of rows) {
    test(row.name, () => {
      for (const key of keys) {
        expect(keyToAction(press(key), row.ctx), `${row.name} × ${key}`).toEqual(
          row.cells[key] ?? null,
        );
      }
    });
  }

  test("level does not matter outside the CPU's turn", () => {
    for (const row of rows.filter((r) => r.ctx.phase !== "cpuTurn"))
      for (const key of keys)
        expect(keyToAction(press(key), { ...row.ctx, level: 2 })).toEqual(row.cells[key] ?? null);
  });
});

// Every context the game can be in, and any key, as generators.
const anyCtx = fc.record({
  phase: fc.constantFrom(
    "setup",
    "playerTurn",
    "playerReview",
    "cpuTurn",
    "cpuReview",
    "over",
  ) as fc.Arbitrary<ShortcutContext["phase"]>,
  level: fc.constantFrom(1, 2) as fc.Arbitrary<1 | 2>,
  guessing: fc.boolean(),
  dialogOpen: fc.boolean(),
});
const anyKey = fc.oneof(fc.constantFrom(...keys, "S", "N", "A", "Q", "Enter", "x"), fc.string());
const anyPress = fc.record({
  key: anyKey,
  ctrlKey: fc.boolean(),
  metaKey: fc.boolean(),
  altKey: fc.boolean(),
  targetTag: fc.constantFrom("BODY", "BUTTON", "LI", "DIV", "INPUT", "TEXTAREA", "SELECT"),
  targetEditable: fc.boolean(),
});

describe("DS 4.3 and the DS 4.4 invariants", () => {
  test("no key returns an action with Ctrl, Cmd or Alt held", () => {
    fc.assert(
      fc.property(anyPress, anyCtx, (k, c) => {
        if (k.ctrlKey || k.metaKey || k.altKey) expect(keyToAction(k, c)).toBeNull();
      }),
    );
  });

  test("no key returns an action while typing", () => {
    fc.assert(
      fc.property(anyPress, anyCtx, (k, c) => {
        if (["INPUT", "TEXTAREA", "SELECT"].includes(k.targetTag) || k.targetEditable)
          expect(keyToAction(k, c)).toBeNull();
      }),
    );
  });

  test("no key returns an action when a dialog is open", () => {
    fc.assert(
      fc.property(anyPress, anyCtx, (k, c) => {
        expect(keyToAction(k, { ...c, dialogOpen: true })).toBeNull();
      }),
    );
  });

  test("answer only in cpuTurn; next only in a review; startGuess only when not guessing", () => {
    fc.assert(
      fc.property(anyPress, anyCtx, (k, c) => {
        const a = keyToAction(k, c);
        if (a?.type === "answer") expect(c.phase).toBe("cpuTurn");
        if (a?.type === "next") expect(["playerReview", "cpuReview"]).toContain(c.phase);
        if (a?.type === "startGuess") {
          expect(c.phase).toBe("playerTurn");
          expect(c.guessing).toBe(false);
        }
      }),
    );
  });

  test("upper-case letters do the same as lower-case", () => {
    fc.assert(
      fc.property(fc.constantFrom("q", "b", "g", "s", "n", "h", "a"), anyCtx, (key, c) => {
        expect(keyToAction(press(key.toUpperCase()), c)).toEqual(keyToAction(press(key), c));
      }),
    );
  });

  test("Shift is allowed, because ? needs it", () => {
    expect(keyToAction(press("?"), ctx())).toEqual(help);
  });

  test("it is pure: the same inputs give the same output", () => {
    fc.assert(
      fc.property(anyPress, anyCtx, (k, c) => {
        expect(keyToAction({ ...k }, { ...c })).toEqual(keyToAction(k, c));
      }),
    );
  });
});

describe("DS 4.5 traced example", () => {
  const cpuTurn = ctx({ phase: "cpuTurn" });

  test("s in the CPU's turn answers Sì", () => {
    expect(keyToAction(press("s"), cpuTurn)).toEqual({ type: "answer", value: true });
  });

  test("Cmd+S is the browser's Save", () => {
    expect(keyToAction(press("s", { metaKey: true }), cpuTurn)).toBeNull();
  });

  test("s in playerReview does nothing", () => {
    expect(keyToAction(press("s"), ctx({ phase: "playerReview" }))).toBeNull();
  });
});
