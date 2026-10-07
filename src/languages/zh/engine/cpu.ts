// Spec 5: the CPU plays smart and deterministic. It guesses once one candidate is
// left; otherwise it asks the unasked question whose yes count among its
// candidates is closest to half, ties going to the earlier key in
// cpuQuestionOrder.
import { he, indexContent, need, she, type Index } from "./content.ts";
import { evaluate, parseKey } from "./predicate.ts";
import { questionByKey } from "./questions.ts";
import { rate, type Rated } from "./ratings.ts";
import { renderAnswer, renderQuestion } from "./render.ts";
import type {
  EngineContent,
  Feedback,
  GameEvent,
  GameState,
  QuestionKey,
  StepResult,
} from "./types.ts";

export type CpuMove = { guess: string } | { ask: QuestionKey };

export function chooseCpuMove(state: GameState, content: EngineContent): CpuMove {
  const index = indexContent(content);
  const [only, ...rest] = state.cpuCandidates;
  if (only !== undefined && rest.length === 0) return { guess: only };

  const askedByCpu = new Set(state.history.filter((h) => h.by === "cpu").map((h) => h.key));
  const half = state.cpuCandidates.length / 2;
  let best: { key: QuestionKey; distance: number } | undefined;
  for (const key of state.cpuQuestionOrder) {
    if (askedByCpu.has(key)) continue;
    const question = questionByKey(content, key);
    if (!question) continue;
    const noun = need(index.noun, question.nounId);
    const yes = state.cpuCandidates.filter((id) =>
      evaluate(noun, need(index.character, id).attrs),
    ).length;
    const distance = Math.abs(yes - half);
    if (!best || distance < best.distance) best = { key, distance };
  }
  // Unreachable with valid content: unique characters always leave a splitting
  // question (spec 3.2). Guessing is the only move left otherwise.
  if (!best) return { guess: only ?? "" };
  return { ask: best.key };
}

// Spec 2, D8: 她 when every candidate is a woman, 他 when every one is a man,
// and 他 otherwise, the traditional written form when gender is unknown.
export function cpuPronoun(candidates: string[], index: Index): string {
  const women = candidates.every((id) => need(index.character, id).attrs.gender === "n.nvde");
  return candidates.length > 0 && women ? she : he;
}

// END_TURN from playerReview.
export function cpuTurn(state: GameState, content: EngineContent): StepResult {
  const move = chooseCpuMove(state, content);
  if ("guess" in move) {
    // The CPU only guesses with one candidate left, and that candidate is always
    // playerSecret (invariant 2), so its guess is right and the player loses.
    const result = move.guess === state.playerSecret ? "lost" : "won";
    return {
      state: { ...state, phase: "over", result, lastFeedback: undefined },
      events: [{ type: "gameOver", result }],
    };
  }
  const pron = cpuPronoun(state.cpuCandidates, indexContent(content));
  return {
    state: {
      ...state,
      phase: "cpuTurn",
      pendingCpuQuestion: { key: move.ask, pron },
      lastFeedback: undefined,
    },
    events: [],
  };
}

// Spec 4.4: ANSWER in cpuTurn. The CPU learns the true answer whatever the
// player taps, so a learner's slip never breaks its logic (spec 2).
export function answerCpu(
  state: GameState,
  answerId: string,
  hintShown: boolean,
  content: EngineContent,
): StepResult {
  const index = indexContent(content);
  const pending = state.pendingCpuQuestion;
  if (!pending) throw new Error("No CPU question to answer");
  const { verbId, nounId } = parseKey(pending.key);
  const verb = need(index.verb, verbId);
  const noun = need(index.noun, nounId);
  const chosen = need(index.answer, answerId);

  const truth = evaluate(noun, need(index.character, state.playerSecret).attrs);
  const expected = need(index.answer, truth ? verb.yes : verb.no);
  const verbRight = chosen.verb === verbId;
  const formRight = chosen.valid;
  const polarityRight = chosen.polarity === truth;
  const answerText = renderAnswer(content, pending.pron, verbId, nounId, truth).hanzi;

  let rated: Rated = {
    events: [{ type: "asked", by: "cpu", key: pending.key, answer: truth }],
    ratedThisTurn: state.ratedThisTurn,
  };
  const slip = (point: string, given: string, expectedText: string) => {
    const event: GameEvent = { type: "grammarSlip", point, given, expected: expectedText };
    rated = { ...rated, events: [...rated.events, event] };
  };
  const feedback: Feedback = [];
  if (!verbRight) {
    slip("gp.answer.verb", chosen.hanzi, expected.hanzi);
    feedback.push({ messageKey: "gp.answer.verb", params: { expected: expected.hanzi } });
  }
  if (!formRight) {
    // 不有 is always a slip for 没有, whatever the question's verb (spec 4.4).
    const meiyou = need(index.answer, "a.meiyou").hanzi;
    slip("gp.neg.mei", chosen.hanzi, meiyou);
    feedback.push({ messageKey: "gp.neg.mei", params: { expected: meiyou } });
  }
  // The recognize card, capped at hard: a two-way choice can be right by luck.
  // A shown hint means no rating at all.
  if (!hintShown) {
    const detail = polarityRight
      ? undefined
      : {
          slot: "answer" as const,
          given: chosen.hanzi,
          expected: expected.hanzi,
          rule: "answer.wrong",
        };
    rated = rate(rated, noun.id, "recognize", polarityRight ? "hard" : "again", detail);
  }
  const correct = verbRight && formRight && polarityRight;
  if (!correct) feedback.push({ messageKey: "answer.wrong", params: { answerText } });

  const cpuCandidates = state.cpuCandidates.filter(
    (id) => evaluate(noun, need(index.character, id).attrs) === truth,
  );
  const rest = { ...state };
  delete rest.pendingCpuQuestion;
  return {
    state: {
      ...rest,
      phase: "cpuReview",
      cpuCandidates,
      history: [
        ...state.history,
        {
          by: "cpu",
          key: pending.key,
          pron: pending.pron,
          text: renderQuestion(content, pending.pron, verbId, nounId).hanzi,
          answer: truth,
          answerText,
          playerAnswer: answerId,
        },
      ],
      ratedThisTurn: rated.ratedThisTurn,
      lastFeedback: correct ? undefined : feedback,
    },
    events: rated.events,
  };
}
