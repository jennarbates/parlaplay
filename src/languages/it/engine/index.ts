// The engine's public API (spec 4).
export { step } from "./step.ts";
export { setupState } from "./start.ts";
export { parseTiles, type Parsed, type Tiles } from "./tiles.ts";
export { allQuestions, questionByKey, type Question } from "./questions.ts";
export { chooseCpuMove } from "./cpu.ts";
export type * from "./types.ts";
