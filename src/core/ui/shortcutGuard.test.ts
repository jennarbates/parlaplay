import { describe, expect, test } from "vitest";
import { mayBeShortcut, shortcutKey, type KeyLike } from "./shortcutGuard.ts";

// Desktop spec DS 4.3, steps 1 to 3, shared by both games' shortcut tables.
const key = (over: Partial<KeyLike> = {}): KeyLike => ({
  key: "n",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  targetTag: "BODY",
  targetEditable: false,
  ...over,
});

describe("mayBeShortcut", () => {
  test("a plain key on the page, or on a button, may be a shortcut", () => {
    expect(mayBeShortcut(key(), false)).toBe(true);
    expect(mayBeShortcut(key({ targetTag: "BUTTON" }), false)).toBe(true);
    expect(mayBeShortcut(key({ key: "?" }), false)).toBe(true);
  });

  test.each(["ctrlKey", "metaKey", "altKey"] as const)("never with %s held", (modifier) => {
    expect(mayBeShortcut(key({ [modifier]: true }), false)).toBe(false);
  });

  test.each(["INPUT", "TEXTAREA", "SELECT"])("never while typing in a %s", (targetTag) => {
    expect(mayBeShortcut(key({ targetTag }), false)).toBe(false);
  });

  test("never in editable content, and never with a dialog open", () => {
    expect(mayBeShortcut(key({ targetEditable: true }), false)).toBe(false);
    expect(mayBeShortcut(key(), true)).toBe(false);
  });
});

test("letters match in either case; named keys are left alone", () => {
  expect(shortcutKey(key({ key: "N" }))).toBe("n");
  expect(shortcutKey(key({ key: "?" }))).toBe("?");
  expect(shortcutKey(key({ key: "Escape" }))).toBe("Escape");
  expect(shortcutKey(key({ key: "Backspace" }))).toBe("Backspace");
});
