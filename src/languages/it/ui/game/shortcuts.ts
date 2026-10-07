// Desktop spec DS 4: turning a key press into one of the game's actions. Pure:
// it imports only types and reads nothing but its arguments, so every cell of the
// DS 4.2 table is unit-tested. Board keys (arrows, Home, End, Enter, Space, i)
// are not here: they need the focused card, so the board handles them (DS 8.2).
import type { GameState } from "../../engine/index.ts";

export type KeyLike = {
  key: string; // KeyboardEvent.key
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  targetTag: string; // "INPUT", "TEXTAREA", "BUTTON", "LI", ...
  targetEditable: boolean; // isContentEditable
};

export type ShortcutContext = {
  phase: GameState["phase"];
  level: 1 | 2;
  guessing: boolean;
  dialogOpen: boolean; // any modal <dialog> open
};

export type ShortcutAction =
  | { type: "focusQuestions" } // q
  | { type: "focusBoard" } // b
  | { type: "startGuess" } // g
  | { type: "cancelGuess" } // Escape
  | { type: "answer"; value: boolean } // s, n
  | { type: "showHint" } // h
  | { type: "next" } // a (Avanti)
  | { type: "openHelp" }; // ?

type Key = "q" | "b" | "g" | "Escape" | "s" | "n" | "h" | "a" | "?";
type Row = Partial<Record<Key, ShortcutAction>>;

const focusBoard: ShortcutAction = { type: "focusBoard" };
const openHelp: ShortcutAction = { type: "openHelp" };
const next: ShortcutAction = { type: "next" };
const yes: ShortcutAction = { type: "answer", value: true };
const no: ShortcutAction = { type: "answer", value: false };

// DS 4.2, one entry per row; a missing key is "-" (nothing happens).
const table = {
  setup: { b: focusBoard, "?": openHelp },
  playerTurn: {
    q: { type: "focusQuestions" },
    b: focusBoard,
    g: { type: "startGuess" },
    "?": openHelp,
  },
  guessing: { b: focusBoard, Escape: { type: "cancelGuess" }, "?": openHelp },
  playerReview: { b: focusBoard, a: next, "?": openHelp },
  cpuTurn1: { b: focusBoard, s: yes, n: no, h: { type: "showHint" }, "?": openHelp },
  cpuTurn2: { b: focusBoard, s: yes, n: no, "?": openHelp },
  cpuReview: { b: focusBoard, a: next, "?": openHelp },
  over: {},
} satisfies Record<string, Row>;

function rowFor(ctx: ShortcutContext): Row {
  switch (ctx.phase) {
    case "playerTurn":
      return ctx.guessing ? table.guessing : table.playerTurn;
    case "cpuTurn":
      return ctx.level === 1 ? table.cpuTurn1 : table.cpuTurn2;
    default:
      return table[ctx.phase];
  }
}

const keys = new Set<string>(["q", "b", "g", "Escape", "s", "n", "h", "a", "?"]);

// DS 4.3: the first rule that matches returns null.
export function keyToAction(k: KeyLike, ctx: ShortcutContext): ShortcutAction | null {
  // 1. Browser and system shortcuts. Shift is allowed: ? needs it.
  if (k.ctrlKey || k.metaKey || k.altKey) return null;
  // 2. Typing.
  if (k.targetTag === "INPUT" || k.targetTag === "TEXTAREA" || k.targetTag === "SELECT")
    return null;
  if (k.targetEditable) return null;
  // 3. A dialog has its own keys.
  if (ctx.dialogOpen) return null;
  // 4. Not a shortcut. Letters match in either case.
  const key = k.key.length === 1 ? k.key.toLowerCase() : k.key;
  if (!keys.has(key)) return null;
  // 5. The cell, or null for "-".
  return rowFor(ctx)[key as Key] ?? null;
}
