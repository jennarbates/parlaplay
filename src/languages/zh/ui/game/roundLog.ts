// zh-desktop.md ZS 3 and 7.3: the round so far, as the desktop log and round end
// show it. Pure: it imports only types and reads nothing but its arguments; the
// sentences are rendered by what it is given (sentences.ts passes the game's own).
import type { AskedQuestion, Sentence } from "../../engine/index.ts";

export type LogEntry = {
  by: "player" | "cpu";
  question: Sentence; // renderQuestion; segments carry lexiconId
  answer: Sentence; // the true answer, renderAnswer
  english: string; // the question in English, then " Yes." or " No."
  playerAnswerId?: string; // cpu entries: what the learner chose
  right?: boolean; // cpu entries: whether that was the true answer
};

export type LogRender = {
  question: (h: AskedQuestion) => Sentence;
  answer: (h: AskedQuestion) => Sentence;
  english: (h: AskedQuestion) => string; // "Is he a doctor?"
};

// Newest first: entry 0 is the last question asked.
export function roundLog(history: readonly AskedQuestion[], render: LogRender): LogEntry[] {
  return history
    .map((h): LogEntry => {
      const answer = render.answer(h);
      const entry: LogEntry = {
        by: h.by,
        question: render.question(h),
        answer,
        english: `${render.english(h)} ${h.answer ? "Yes." : "No."}`,
      };
      if (h.by === "cpu" && h.playerAnswer !== undefined) {
        entry.playerAnswerId = h.playerAnswer;
        // The true answer's first word is its short answer: 是, 不是, 有, 没有, 在, 不在.
        entry.right = h.playerAnswer === answer.segments[0]?.lexiconId;
      }
      return entry;
    })
    .reverse();
}
