import type { AskedQuestion, Segment } from "../../engine/index.ts";
import { answer } from "./sentences.ts";

// #132: what the player's own questions have found out about the computer's card,
// as statements in Chinese, newest first: the full sentence after the short
// answer, 她没有狗。 from 没有，她没有狗。. The computer's questions are about the
// player's card, so they are left out. Built from the history, so it survives a
// reload mid-round.
export function factsOf(history: readonly AskedQuestion[]): Segment[][] {
  return history
    .filter((h) => h.by === "player")
    .map((h) => {
      const segments = answer(h).segments;
      return segments.slice(segments.findIndex((s) => s.hanzi === "，") + 1);
    })
    .reverse();
}
