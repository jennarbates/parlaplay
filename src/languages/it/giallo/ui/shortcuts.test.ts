import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  keyToAction,
  type KeyLike,
  type ShortcutAction,
  type ShortcutContext,
} from "./shortcuts.ts";

// Chi è stato? GS 9.2: every cell of the shortcut table, the order of checks, and
// the invariants, as Chi è?'s DS 4.4.

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
  level: 1,
  inspector: "none",
  desktop: true,
  sheetOpen: false,
  dialogOpen: false,
  ...over,
});

const keys = ["1", "2", "3", "4", "5", "n", "a", "Enter", "h", "Escape", "?"] as const;
type Key = (typeof keys)[number];

const select = (index: number): ShortcutAction => ({ type: "select", index });
const always: Partial<Record<Key, ShortcutAction>> = {
  "1": select(0),
  "2": select(1),
  "3": select(2),
  "4": select(3),
  "5": select(4),
  n: { type: "focusNotebook" },
  "?": { type: "openHelp" },
};
const accuse: ShortcutAction = { type: "accuse" };
const ask: ShortcutAction = { type: "ask" };
const hint: ShortcutAction = { type: "showHint" };
const close: ShortcutAction = { type: "closeSheet" };

// GS 9.2, written out again here so the test does not share the code's table.
const rows: { name: string; ctx: ShortcutContext; cells: Partial<Record<Key, ShortcutAction>> }[] =
  [
    { name: "Level 1, desktop", ctx: ctx(), cells: { ...always, a: accuse } },
    {
      name: "Level 2, desktop",
      ctx: ctx({ level: 2 }),
      cells: { ...always, a: accuse, Enter: ask },
    },
    {
      name: "Level 1, phone, sheet open",
      ctx: ctx({ desktop: false, sheetOpen: true }),
      cells: { ...always, a: accuse, Escape: close },
    },
    {
      name: "Level 2, phone, sheet closed",
      ctx: ctx({ level: 2, desktop: false }),
      cells: { ...always, a: accuse, Enter: ask },
    },
    {
      name: "her question, desktop",
      ctx: ctx({ inspector: "pending" }),
      cells: { ...always, h: hint },
    },
    {
      name: "her question, phone, unfolded",
      ctx: ctx({ inspector: "pending", level: 2, desktop: false, sheetOpen: true }),
      cells: { ...always, h: hint, Escape: close },
    },
    { name: "her result, desktop", ctx: ctx({ inspector: "answered", level: 2 }), cells: always },
    {
      name: "her result, phone, unfolded",
      ctx: ctx({ inspector: "answered", desktop: false, sheetOpen: true }),
      cells: { ...always, Escape: close },
    },
  ];

describe("every cell of GS 9.2", () => {
  for (const row of rows) {
    test(row.name, () => {
      for (const key of keys)
        expect(keyToAction(press(key), row.ctx), `${row.name} × ${key}`).toEqual(
          row.cells[key] ?? null,
        );
    });
  }

  test("Enter on a control is the control's own", () => {
    for (const targetTag of ["BUTTON", "A", "SUMMARY", "CHECKBOX"])
      expect(keyToAction(press("Enter", { targetTag }), ctx({ level: 2 }))).toBeNull();
    expect(keyToAction(press("Enter", { targetTag: "DIV" }), ctx({ level: 2 }))).toEqual(ask);
  });
});

const anyCtx = fc.record({
  level: fc.constantFrom(1, 2) as fc.Arbitrary<1 | 2>,
  inspector: fc.constantFrom("none", "pending", "answered") as fc.Arbitrary<
    ShortcutContext["inspector"]
  >,
  desktop: fc.boolean(),
  sheetOpen: fc.boolean(),
  dialogOpen: fc.boolean(),
});
const anyKey = fc.oneof(fc.constantFrom(...keys, "N", "A", "H", "6", "0", "x", " "), fc.string());
const anyPress = fc.record({
  key: anyKey,
  ctrlKey: fc.boolean(),
  metaKey: fc.boolean(),
  altKey: fc.boolean(),
  targetTag: fc.constantFrom("BODY", "BUTTON", "DIV", "CHECKBOX", "INPUT", "TEXTAREA", "SELECT"),
  targetEditable: fc.boolean(),
});

describe("the order of checks and the invariants", () => {
  test("no key returns an action with Ctrl, Cmd or Alt held", () => {
    fc.assert(
      fc.property(anyPress, anyCtx, (k, c) => {
        if (k.ctrlKey || k.metaKey || k.altKey) expect(keyToAction(k, c)).toBeNull();
      }),
    );
  });

  test("no key returns an action while typing, or with a dialog open", () => {
    fc.assert(
      fc.property(anyPress, anyCtx, (k, c) => {
        if (["INPUT", "TEXTAREA", "SELECT"].includes(k.targetTag) || k.targetEditable)
          expect(keyToAction(k, c)).toBeNull();
        expect(keyToAction(k, { ...c, dialogOpen: true })).toBeNull();
      }),
    );
  });

  test("accusing and asking wait for her; her hint is only for her question", () => {
    fc.assert(
      fc.property(anyPress, anyCtx, (k, c) => {
        const type = keyToAction(k, c)?.type;
        if (type === "accuse" || type === "ask") expect(c.inspector).toBe("none");
        if (type === "showHint") expect(c.inspector).toBe("pending");
        if (type === "ask") expect(c.level).toBe(2);
        if (type === "closeSheet") expect(c.desktop || !c.sheetOpen).toBe(false);
      }),
    );
  });

  test("a select is always one of the five people", () => {
    fc.assert(
      fc.property(anyPress, anyCtx, (k, c) => {
        const action = keyToAction(k, c);
        if (action?.type === "select") expect([0, 1, 2, 3, 4]).toContain(action.index);
      }),
    );
  });

  test("upper-case letters do what lower-case ones do", () => {
    fc.assert(
      fc.property(anyCtx, fc.constantFrom("n", "a", "h"), (c, key) => {
        expect(keyToAction(press(key.toUpperCase()), c)).toEqual(keyToAction(press(key), c));
      }),
    );
  });
});
