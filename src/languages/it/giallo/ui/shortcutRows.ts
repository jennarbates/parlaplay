import type { ShortcutRow } from "../../../../core/ui/ShortcutsDialog.tsx";

// Chi è stato? GS 9.2, in words.
export const shortcutRows: ShortcutRow[] = [
  { keys: ["1", "2", "3", "4", "5"], does: "Pick a person to ask, in the order of the faces" },
  { keys: ["Tab", "←", "→"], does: "Level 2: move between and along the tile rows" },
  { keys: ["Enter"], does: "Level 2: Chiedi, when you're not on a tile" },
  { keys: ["N"], does: "Go to the notebook (Taccuino)" },
  { keys: ["A"], does: "Accusa: name who did it" },
  { keys: ["H"], does: "Show the hint for Ispettrice Bassi's question" },
  { keys: ["Esc"], does: "Close the questions (phone)" },
  { keys: ["?"], does: "Show these shortcuts" },
];
