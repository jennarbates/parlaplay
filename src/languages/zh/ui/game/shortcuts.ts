// zh-desktop.md ZS 9: turning a key press into one of the game's actions. Pure: it
// imports only types and the shared guard, and reads nothing but its arguments,
// so every cell of the ZS 9.2 table is unit-tested. Board, group, tile-row and log
// keys (arrows, Home, End, Enter, Space, i) are not here: they need the focused
// element, so each of those handles its own (ZS 9.4).
import { mayBeShortcut, shortcutKey, type KeyLike } from "../../../../core/ui/shortcutGuard.ts";
import type { GameState, Level } from "../../engine/index.ts";

export type { KeyLike };

export type ShortcutContext = {
  phase: GameState["phase"];
  level: Level;
  guessing: boolean;
  dialogOpen: boolean; // a <dialog>, the menu popover or the log's overlay (ZS 9.1)
  answers: number; // answer buttons shown; 0 outside cpuTurn
  trayEmpty: boolean;
  logEmpty: boolean;
};

export type ShortcutAction =
  | { type: "focusQuestions" } // q
  | { type: "focusBoard" } // b
  | { type: "startGuess" } // g
  | { type: "cancelGuess" } // Escape
  | { type: "answer"; index: number } // 1 to 7, 0-based
  | { type: "showHint" } // h
  | { type: "next" } // n
  | { type: "ask" } // a
  | { type: "removeLast" } // Backspace
  | { type: "focusFind" } // /
  | { type: "togglePinyin" } // p
  | { type: "switchPronoun" } // t
  | { type: "focusLog" } // l
  | { type: "openHelp" }; // ?

type Letter =
  "q" | "b" | "g" | "Escape" | "h" | "n" | "a" | "Backspace" | "/" | "p" | "t" | "l" | "?";
type Row = Partial<Record<Letter | "digit", ShortcutAction["type"]>>;

// ZS 9.2, one entry per row; a missing key is "-" (nothing happens). The
// conditions of its footnotes are applied in keyToAction.
const table = {
  setup: { b: "focusBoard", "?": "openHelp" },
  playerTurn1: {
    q: "focusQuestions",
    b: "focusBoard",
    g: "startGuess",
    t: "switchPronoun",
    l: "focusLog",
    "?": "openHelp",
  },
  playerTurn2: {
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
  guessing: {
    b: "focusBoard",
    Escape: "cancelGuess",
    p: "togglePinyin",
    l: "focusLog",
    "?": "openHelp",
  },
  playerReview: { b: "focusBoard", n: "next", p: "togglePinyin", l: "focusLog", "?": "openHelp" },
  cpuTurn1: { b: "focusBoard", digit: "answer", h: "showHint", l: "focusLog", "?": "openHelp" },
  cpuTurn2: { b: "focusBoard", digit: "answer", p: "togglePinyin", l: "focusLog", "?": "openHelp" },
  cpuReview: { b: "focusBoard", n: "next", p: "togglePinyin", l: "focusLog", "?": "openHelp" },
  over: {},
} satisfies Record<string, Row>;

function rowFor(ctx: ShortcutContext): Row {
  switch (ctx.phase) {
    case "playerTurn":
      return ctx.guessing
        ? table.guessing
        : ctx.level === 1
          ? table.playerTurn1
          : table.playerTurn2;
    case "cpuTurn":
      return ctx.level === 1 ? table.cpuTurn1 : table.cpuTurn2;
    default:
      return table[ctx.phase];
  }
}

// ZS 9.1: the first rule that matches returns null.
export function keyToAction(k: KeyLike, ctx: ShortcutContext): ShortcutAction | null {
  // 1 to 3: a modifier is held, the learner is typing, or a dialog is open.
  if (!mayBeShortcut(k, ctx.dialogOpen)) return null;
  // 4. Not in the table. Letters match in either case; 1 to 7 are one column.
  const key = shortcutKey(k);
  const digit = /^[1-7]$/.test(key) ? Number(key) : null;
  const type = rowFor(ctx)[digit === null ? (key as Letter) : "digit"];
  if (!type) return null;
  // 5. The cell's own condition.
  switch (type) {
    case "answer":
      // ⁴ only a number that has a button.
      return digit !== null && digit <= ctx.answers ? { type, index: digit - 1 } : null;
    case "focusLog":
      return ctx.logEmpty ? null : { type }; // ¹
    case "ask":
    case "removeLast":
      return ctx.trayEmpty ? null : { type }; // ²
    case "togglePinyin":
      return ctx.level === 2 ? { type } : null; // ³
    default:
      return { type };
  }
}
