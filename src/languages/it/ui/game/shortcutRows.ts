import type { ShortcutRow } from "../../../../core/ui/ShortcutsDialog.tsx";

// Desktop spec DS 8.1 and DS 4.2, in words.
export const shortcutRows: ShortcutRow[] = [
  { keys: ["Q"], does: "Go to the questions" },
  { keys: ["↑", "↓"], does: "Move between questions; Enter asks" },
  { keys: ["Tab", "←", "→"], does: "Level 2: move between and along the tile rows" },
  { keys: ["B"], does: "Go to the board" },
  { keys: ["←", "↑", "→", "↓"], does: "Move around the board" },
  { keys: ["Home", "End"], does: "First or last card in the row" },
  { keys: ["Ctrl+Home", "Ctrl+End"], does: "First or last card on the board" },
  { keys: ["Enter", "Space"], does: "Flip the card, or pick it while guessing" },
  { keys: ["I"], does: "Look at the card up close" },
  { keys: ["G"], does: "Indovina: guess who it is" },
  { keys: ["Esc"], does: "Cancel the guess" },
  { keys: ["S", "N"], does: "Answer Sì or No to the computer" },
  { keys: ["H"], does: "Show the hint (Level 1)" },
  { keys: ["A"], does: "Avanti: carry on" },
  { keys: ["?"], does: "Show these shortcuts" },
];
