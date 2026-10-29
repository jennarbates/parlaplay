// Chi è stato? GS 5.1: the engine contract. engine/ is pure TypeScript: no React,
// DOM or time. One function moves a case forward: step(state, action, content).
import type { Character } from "../../content/schemas.ts";
import type { SlotError } from "../../engine/types.ts";
import type { Case, Frame, LexiconEntry } from "../content/schemas.ts";

export type { SlotError };

export type Phase = "asking" | "inspector" | "ended";

export type Level = 1 | 2;

// GS 2: a case allows 15 accepted questions.
export const budgetPerCase = 15;

// A question as the learner built it: [prep?] [qword form] [frame body], to one
// person (a role), about a slot when the frame takes one.
export type Built = {
  prep?: string; // "prep.con"
  qword: string; // the lemma, "q.con_chi"
  form: string; // the form's text, "quante"
  frame: string;
  slot?: number;
  to: string; // a role, "r.pairA"
};

// One accepted question and the answer it got. key is the answer's key
// (answers.ts), or null for the case's default, so solve() reads the notebook as is.
export type NotebookEntry = { built: Built; key: string | null; answer: string };

// GS 6. The engine only moves the phase; PLAY-087 builds the questions.
export type InspectorQuestion = {
  qword: string; // the recognize card it rates
  text: string; // "Dov'era Paolo tra le otto e le nove?"
  options: string[]; // three, from the notebook
  answer: string; // the right option
};

export type Result = { solved: boolean; stars?: 1 | 2 | 3; abandoned?: true };

export type CaseState = {
  caseId: string;
  seed: number;
  level: Level;
  cast: Record<string, string>; // role → character id
  jobs: Record<string, string>; // suspect role → job id
  hide: number; // index into case.rooms
  crime: number; // index into case.slots
  phase: Phase;
  budget: number; // starts at 15
  notebook: NotebookEntry[]; // accepted questions and answers, in order
  cleared: string[]; // roles the learner marked, never read by the engine's logic
  ratedThisTurn: string[]; // "lexiconId|direction"; cleared when a question is accepted
  inspector?: InspectorQuestion; // set while phase is "inspector"
  result?: Result; // set when phase is "ended"
};

export type Action =
  | { type: "ASK"; built: Built }
  | { type: "ANSWER_INSPECTOR"; choice: string }
  | { type: "MARK"; role: string; cleared: boolean }
  | { type: "ACCUSE"; role: string; room: number; slot: number }
  | { type: "QUIT" };

export type RejectReason = "shape" | "nonsense" | "duplicate" | "grammar" | "noBudget";

export type Event =
  | { type: "asked"; entry: NotebookEntry; slip?: SlotError }
  // A duplicate carries the earlier entry, so its answer can be shown again.
  | { type: "rejected"; reason: RejectReason; errors?: SlotError[]; earlier?: NotebookEntry }
  | {
      type: "rating";
      lexiconId: string;
      direction: "recognize" | "produce";
      rating: "again" | "hard" | "good";
    }
  | { type: "slip"; error: SlotError }
  | { type: "inspectorAsked"; question: InspectorQuestion }
  | ({ type: "ended" } & Result);

export type StepResult = { state: CaseState; events: Event[] };

// The slice of content the engine reads: the giallo's, plus Chi è?'s characters,
// who play every role (GD13).
export type EngineContent = {
  cases: Case[];
  frames: Frame[];
  lexicon: LexiconEntry[];
  characters: Character[];
};
