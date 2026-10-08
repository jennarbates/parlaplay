// Types every language shares (platform spec 3.3). Each engine keeps its own
// Level and Direction, because engines import nothing from outside themselves;
// theirs must stay assignable to these.
export type Level = 1 | 2;
export type Direction = "recognize" | "produce";

// What went wrong, on a rated mistake or a slip row. Slot names and rule keys are
// each game's own ("art", "adj" in Chi è?; "pron", "order" in Shéi).
export type SlotDetail = { slot: string; given: string; expected: string; rule: string };
