// Chi è stato? GS 9.2: turning a key press into one of the case screen's actions,
// as Chi è?'s desktop spec DS 4 does for a round. Pure: it imports only types and
// the shared guard, and reads nothing but its arguments, so every cell of the GS 9.2
// table is unit-tested.
import { mayBeShortcut, shortcutKey, type KeyLike } from "../../../../core/ui/shortcutGuard.ts";

export type { KeyLike };

export type ShortcutContext = {
  level: 1 | 2;
  // Her question: none, waiting for an answer, or answered and waiting for Continue.
  inspector: "none" | "pending" | "answered";
  desktop: boolean; // lg: the panel is always open, so there is no sheet to close
  sheetOpen: boolean; // the phone's sheet, or hers, unfolded
  dialogOpen: boolean; // any modal <dialog> open
};

export type ShortcutAction =
  | { type: "select"; index: number } // 1 to 5, in the people strip's order
  | { type: "focusNotebook" } // n
  | { type: "accuse" } // a
  | { type: "ask" } // Enter, Level 2
  | { type: "showHint" } // h, her question
  | { type: "closeSheet" } // Escape, phone
  | { type: "openHelp" }; // ?

const people = ["1", "2", "3", "4", "5"];
const keys = new Set<string>([...people, "n", "a", "Enter", "h", "Escape", "?"]);

// Enter on a control is the control's own: it picks a tile, asks a Level 1
// question, or answers her. Enter asks only from elsewhere.
const controls = new Set(["BUTTON", "A", "SUMMARY", "CHECKBOX"]);

// GS 9.2, in the order of checks of DS 4.3: the first rule that matches returns null.
export function keyToAction(k: KeyLike, ctx: ShortcutContext): ShortcutAction | null {
  // 1 to 3: a modifier is held, the learner is typing, or a dialog is open.
  if (!mayBeShortcut(k, ctx.dialogOpen)) return null;
  // 4. Not a shortcut. Letters match in either case.
  const key = shortcutKey(k);
  if (!keys.has(key)) return null;
  // 5. The cell, or null for "-".
  const index = people.indexOf(key);
  if (index >= 0) return { type: "select", index };
  switch (key) {
    case "n":
      return { type: "focusNotebook" };
    case "?":
      return { type: "openHelp" };
    case "Escape":
      return !ctx.desktop && ctx.sheetOpen ? { type: "closeSheet" } : null;
    case "a":
      // GS 2: accusing waits while her question is up.
      return ctx.inspector === "none" ? { type: "accuse" } : null;
    case "h":
      return ctx.inspector === "pending" ? { type: "showHint" } : null;
    case "Enter":
      return ctx.inspector === "none" && ctx.level === 2 && !controls.has(k.targetTag)
        ? { type: "ask" }
        : null;
  }
  return null;
}
