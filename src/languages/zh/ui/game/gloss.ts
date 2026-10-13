// zh-desktop.md ZS 7.4 (ZD9): whether English may be shown beside Chinese right
// now. Not while a rating is pending: in cpuTurn the learner is rated on
// recognising the question, and in playerTurn at Level 2 on producing one. Pure.
import type { GameState, Level } from "../../engine/index.ts";

export function glossShowsEnglish(phase: GameState["phase"], level: Level): boolean {
  if (phase === "cpuTurn") return false;
  if (phase === "playerTurn" && level === 2) return false;
  return true;
}
