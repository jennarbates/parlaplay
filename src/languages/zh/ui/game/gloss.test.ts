import { expect, test } from "vitest";
import type { GameState } from "../../engine/index.ts";
import { glossShowsEnglish } from "./gloss.ts";

// zh-desktop.md ZS 3: false exactly for cpuTurn at both levels and playerTurn at
// Level 2.
const phases: GameState["phase"][] = [
  "setup",
  "playerTurn",
  "playerReview",
  "cpuTurn",
  "cpuReview",
  "over",
];

test.each(phases.flatMap((phase) => ([1, 2] as const).map((level) => [phase, level] as const)))(
  "%s at Level %i",
  (phase, level) => {
    const hidden = phase === "cpuTurn" || (phase === "playerTurn" && level === 2);
    expect(glossShowsEnglish(phase, level)).toBe(!hidden);
  },
);
