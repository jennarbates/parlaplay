// Spec 5: the CPU plays smart and deterministic. It guesses once one candidate is
// left; otherwise it asks the unasked question whose yes count among its
// candidates is closest to half, ties going to the earlier key in
// cpuQuestionOrder. It always asks in the default wording (questions.ts).
import { parseAdjRef, type Index } from "./content.ts";
import { evaluate } from "./meaning.ts";
import { questionByKey } from "./questions.ts";
import { rate, type Rated } from "./ratings.ts";
import { renderAnswer } from "./render.ts";
import type { EngineContent, GameState, QuestionKey, StepResult } from "./types.ts";

export type CpuMove = { guess: string } | { ask: QuestionKey };

export function chooseCpuMove(state: GameState, content: EngineContent, index: Index): CpuMove {
  const [only, ...rest] = state.cpuCandidates;
  if (only !== undefined && rest.length === 0) return { guess: only };

  const askedByCpu = new Set(state.history.filter((h) => h.by === "cpu").map((h) => h.key));
  const half = state.cpuCandidates.length / 2;
  let best: { key: QuestionKey; distance: number } | undefined;
  for (const key of state.cpuQuestionOrder) {
    if (askedByCpu.has(key)) continue;
    const question = questionByKey(content, key);
    if (!question) continue;
    const yes = state.cpuCandidates.filter((id) => {
      const c = index.character.get(id);
      return c !== undefined && evaluate(question.asked, c.attrs);
    }).length;
    const distance = Math.abs(yes - half);
    if (!best || distance < best.distance) best = { key, distance };
  }
  // Unreachable with valid content: unique characters always leave a splitting
  // question (spec 3.2). Guessing is the only move left otherwise.
  if (!best) return { guess: only ?? "" };
  return { ask: best.key };
}

// END_TURN from playerReview.
export function cpuTurn(state: GameState, content: EngineContent, index: Index): StepResult {
  const move = chooseCpuMove(state, content, index);
  if ("guess" in move) {
    // The CPU only guesses with one candidate left, and that candidate is always
    // playerSecret (invariant 2), so its guess is right and the player loses.
    const result = move.guess === state.playerSecret ? "lost" : "won";
    return {
      state: { ...state, phase: "over", result, lastFeedback: undefined },
      events: [{ type: "gameOver", result }],
    };
  }
  return {
    state: { ...state, phase: "cpuTurn", pendingCpuQuestion: move.ask, lastFeedback: undefined },
    events: [],
  };
}

// ANSWER in cpuTurn. The CPU learns the true answer whatever the player taps, so a
// learner's mistake never breaks its logic (spec 2, D4).
export function answerCpu(
  state: GameState,
  value: boolean,
  hintShown: boolean,
  content: EngineContent,
  index: Index,
): StepResult {
  const key = state.pendingCpuQuestion;
  const question = key ? questionByKey(content, key) : undefined;
  const secret = index.character.get(state.playerSecret);
  if (!key || !question || !secret) throw new Error(`No CPU question to answer (${key ?? "none"})`);

  const truth = evaluate(question.asked, secret.attrs);
  const answerText = renderAnswer(question.text, truth);
  const correct = value === truth;

  // Recognize ratings for the words in the question, at both levels. Guess-proofing:
  // a right Sì/No is capped at hard. A shown hint means no rating at all.
  let rated: Rated = {
    events: [{ type: "asked", by: "cpu", key, answer: truth }],
    ratedThisTurn: state.ratedThisTurn,
  };
  if (!hintShown) {
    const words = [
      question.fill.noun,
      ...(question.fill.adj ? [parseAdjRef(question.fill.adj)?.lemmaId ?? ""] : []),
    ];
    const detail = correct
      ? undefined
      : {
          slot: "answer" as const,
          given: value ? "Sì" : "No",
          expected: truth ? "Sì" : "No",
          rule: "answer.wrong",
        };
    for (const word of words)
      rated = rate(rated, word, "recognize", correct ? "hard" : "again", detail);
  }

  const cpuCandidates = state.cpuCandidates.filter((id) => {
    const c = index.character.get(id);
    return c !== undefined && evaluate(question.asked, c.attrs) === truth;
  });

  const rest = { ...state };
  delete rest.pendingCpuQuestion;
  return {
    state: {
      ...rest,
      phase: "cpuReview",
      cpuCandidates,
      history: [
        ...state.history,
        { by: "cpu", key, text: question.text, answer: truth, answerText, playerAnswer: value },
      ],
      ratedThisTurn: rated.ratedThisTurn,
      lastFeedback: correct ? undefined : [{ messageKey: "answer.wrong", params: { answerText } }],
    },
    events: rated.events,
  };
}
