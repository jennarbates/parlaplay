// The engine's public API (spec 4).
export { step } from "./step.ts";
export { setupState } from "./start.ts";
export { allQuestions, questionByKey, questionTokens, type Question } from "./questions.ts";
export { renderAnswer, renderQuestion, type Segment, type Sentence } from "./render.ts";
export { evaluate, parseKey, questionKey } from "./predicate.ts";
export { chooseCpuMove } from "./cpu.ts";
export type * from "./types.ts";
