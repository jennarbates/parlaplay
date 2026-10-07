// Spec 4.1: the engine contract. engine/ is pure TypeScript: no React, DOM or
// time. One function moves the game forward: step(state, action, content).
import type { Character, LexiconEntry } from "../content/schemas.ts";

export type Phase = "setup" | "playerTurn" | "playerReview" | "cpuTurn" | "cpuReview" | "over";

export type Level = 1 | 2;

// `${verbId}|${objectId}`, e.g. "v.you|n.gou". The pronoun is not part of it, so
// 他有狗吗？ and 她有狗吗？ are the same question.
export type QuestionKey = string;

export type SlotError = {
  slot: "pron" | "verb" | "order" | "ma" | "answer";
  given: string; // text shown: "是", "他狗有吗", "不有"
  expected: string; // "有", "他有狗吗？", "没有"
  rule: string; // message key from 3.6
};

export type ShapeError = { kind: "empty" | "noPron" | "noVerb" | "noObj" | "extra" };

// Rendered by the UI with content/messages.json.
export type Feedback = { messageKey: string; params: Record<string, string> }[];

export type AskedQuestion = {
  by: "player" | "cpu";
  key: QuestionKey;
  pron: string; // "pr.ta.m"
  text: string; // "他有狗吗？"
  answer: boolean; // the truth
  answerText: string; // "没有，他没有狗。"
  playerAnswer?: string; // CPU questions only: the answer id chosen, "a.meiyou"
};

export type GameState = {
  phase: Phase;
  seed: number;
  level: Level;
  turn: number;
  playerSecret: string;
  cpuSecret: string;
  flipped: string[]; // player's board, ids face down
  cpuCandidates: string[]; // who the CPU still thinks playerSecret could be
  cpuQuestionOrder: QuestionKey[]; // seeded shuffle of the 14 questions, fixed at START
  pendingCpuQuestion?: { key: QuestionKey; pron: string };
  history: AskedQuestion[];
  ratedThisTurn: string[]; // "lexiconId|direction"; cleared when `turn` increments
  lastFeedback?: Feedback; // what the UI shows after the last action
  result?: "won" | "lost";
};

export type Action =
  | { type: "START"; seed: number; level: Level }
  | { type: "ASK"; tokens: string[] } // lexicon ids in the order placed
  | { type: "GUESS"; characterId: string }
  | { type: "FLIP"; characterId: string } // toggles
  | { type: "ANSWER"; answerId: string; hintShown: boolean }
  | { type: "END_TURN" };

export type RejectReason =
  "wrongPhase" | "unknownId" | "shape" | "grammar" | "offBoard" | "duplicate";
export type Direction = "recognize" | "produce";
export type Rating = "again" | "hard" | "good";

export type GameEvent =
  | { type: "rejected"; reason: RejectReason; errors?: SlotError[]; shape?: ShapeError }
  | { type: "asked"; by: "player" | "cpu"; key: QuestionKey; answer: boolean }
  | { type: "rating"; lexiconId: string; direction: Direction; rating: Rating; detail?: SlotError }
  | { type: "grammarSlip"; point: string; given: string; expected: string }
  | { type: "gameOver"; result: "won" | "lost" };

export type StepResult = { state: GameState; events: GameEvent[] };

// The slice of content the engine reads. Messages are rendered by the UI.
export type EngineContent = {
  characters: Character[];
  lexicon: LexiconEntry[];
};
