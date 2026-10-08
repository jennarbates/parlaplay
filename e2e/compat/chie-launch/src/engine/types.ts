// Spec 4.1: the engine contract. engine/ is pure TypeScript: no React, DOM or
// time. One function moves the game forward: step(state, action, content).
import type { Character, LexiconEntry, Template } from "../content/schemas.ts";

export type Phase = "setup" | "playerTurn" | "playerReview" | "cpuTurn" | "cpuReview" | "over";

export type Level = 1 | 2;

// Ids, with the adjective as "adj.biondo#mp".
export type Fill = { verb: string; art: string; noun: string; adj?: string };

// `${templateId}|${nounId}|${value ?? ""}`, where value is the attribute value
// tested ("adj.marrone" for both castani and marroni eyes).
export type QuestionKey = string;

export type SlotError = {
  slot: "verb" | "art" | "adj" | "answer";
  given: string; // text the player chose ("gli", "bionde", "Sì")
  expected: string; // correct text ("i", "biondi", "No")
  rule: string; // message key from 3.7
};

export type ShapeError = { kind: "noVerb" | "noArt" | "noNoun" | "needsAdj" | "noAdjAllowed" };

// Rendered by the UI with content/messages.json.
export type Feedback = { messageKey: string; params: Record<string, string> }[];

export type AskedQuestion = {
  by: "player" | "cpu";
  key: QuestionKey;
  text: string; // "Ha i capelli biondi?"
  answer: boolean; // the truth
  answerText: string; // "No, non ha i capelli biondi."
  playerAnswer?: boolean; // CPU questions only
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
  cpuQuestionOrder: QuestionKey[]; // seeded shuffle of the 16 questions, fixed at START
  pendingCpuQuestion?: QuestionKey;
  history: AskedQuestion[];
  ratedThisTurn: string[]; // "lexiconId|direction"; cleared when `turn` increments
  lastFeedback?: Feedback; // what the UI shows after the last action
  result?: "won" | "lost";
};

export type Action =
  | { type: "START"; seed: number; level: Level }
  | { type: "ASK"; templateId: string; fill: Fill }
  | { type: "GUESS"; characterId: string }
  | { type: "FLIP"; characterId: string } // toggles
  | { type: "ANSWER"; value: boolean; hintShown: boolean }
  | { type: "END_TURN" };

export type RejectReason = "wrongPhase" | "unknownId" | "grammar" | "nonsense" | "duplicate";
export type Direction = "recognize" | "produce";
export type Rating = "again" | "hard" | "good";

export type GameEvent =
  | { type: "rejected"; reason: RejectReason; errors?: SlotError[] }
  | { type: "asked"; by: "player" | "cpu"; key: QuestionKey; answer: boolean }
  | { type: "rating"; lexiconId: string; direction: Direction; rating: Rating; detail?: SlotError }
  | { type: "agreementSlip"; lexiconId: string; given: string; expected: string }
  | { type: "gameOver"; result: "won" | "lost" };

export type StepResult = { state: GameState; events: GameEvent[] };

// The slice of content the engine reads. Messages are rendered by the UI.
export type EngineContent = {
  characters: Character[];
  lexicon: LexiconEntry[];
  templates: Template[];
};
