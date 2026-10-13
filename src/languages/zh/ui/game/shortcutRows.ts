import type { ShortcutRow } from "../../../../core/ui/ShortcutsDialog.tsx";

// zh-desktop.md ZS 9.2, ZS 9.4 and the find field's keys of ZS 7.2, in words.
export const shortcutRows: ShortcutRow[] = [
  { keys: ["B"], does: "Go to the board" },
  { keys: ["←", "↑", "→", "↓"], does: "Move around the board" },
  { keys: ["Home", "End"], does: "First or last card in the row" },
  { keys: ["Ctrl+Home", "Ctrl+End"], does: "First or last card on the board" },
  { keys: ["Enter", "Space"], does: "Flip the card, or pick it while guessing" },
  { keys: ["I"], does: "Look at the card up close" },
  { keys: ["Q"], does: "Go to the questions, or the word tiles" },
  { keys: ["↑", "↓", "←", "→"], does: "Level 1: move between questions; Enter asks" },
  { keys: ["T"], does: "Level 1: switch between 他 and 她" },
  { keys: ["/"], does: "Level 2: type pinyin to find a word" },
  { keys: ["Enter"], does: "In the find field: add the word, or ask when it is empty" },
  { keys: ["Backspace"], does: "Level 2: remove the last word" },
  { keys: ["Tab", "←", "→"], does: "Level 2: move between and along the tile rows" },
  { keys: ["A"], does: "Level 2: ask the question" },
  { keys: ["P"], does: "Level 2: show or hide pinyin" },
  { keys: ["1", "…", "7"], does: "Answer the computer" },
  { keys: ["H"], does: "Show the hint (Level 1)" },
  { keys: ["N"], does: "Next" },
  { keys: ["G"], does: "Guess who it is" },
  { keys: ["Esc"], does: "Cancel the guess" },
  { keys: ["L"], does: "Go to the round log; ↑ ↓ move through it" },
  { keys: ["?"], does: "Show these shortcuts" },
];
