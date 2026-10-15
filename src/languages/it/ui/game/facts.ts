import type { AskedQuestion } from "../../engine/index.ts";

// #132: what the player's own questions have found out about the computer's card,
// as statements in Italian, newest first. The computer's questions are about the
// player's card, so they are left out. Built from the history, so it survives a
// reload mid-round.
export function factsOf(history: readonly AskedQuestion[]): string[] {
  return history
    .filter((h) => h.by === "player")
    .map((h) => statement(h.answerText))
    .reverse();
}

// "No, non ha i capelli biondi." → "Non ha i capelli biondi."
export function statement(answerText: string): string {
  const s = answerText.replace(/^(Sì|No), /, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
