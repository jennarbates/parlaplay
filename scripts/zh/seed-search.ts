// Spec 3.2: choose the character seed. Runs seeds from 1 up to 20,000 and keeps the
// one whose CPU simulation (spec 5, 1,000 games) has the lowest maximum number of
// questions, ties going to the lowest seed:
//
//   node scripts/seed-search.ts
//
// No set can do better than ⌈log2 24⌉ = 5 (each answer at most halves 24
// candidates), so the search stops at the first seed that reaches it.
import { readFileSync } from "node:fs";
import { simulate } from "../../src/languages/zh/engine/simulate.ts";
import type { EngineContent } from "../../src/languages/zh/engine/types.ts";
import { generateCharacters } from "./generate-characters.ts";

const lexicon = JSON.parse(
  readFileSync(new URL("../../src/languages/zh/content/lexicon.json", import.meta.url), "utf8"),
) as EngineContent["lexicon"];

export const floor = Math.ceil(Math.log2(24));

export function cpuMax(seed: number, games = 1000): { max: number; mean: number } {
  const { characters } = generateCharacters(seed);
  const r = simulate(games, "passive", { characters, lexicon });
  return { max: r.maxCpuQuestionsToWin, mean: r.avgCpuQuestionsToWin };
}

if (import.meta.main) {
  let best: { seed: number; max: number; mean: number } | undefined;
  for (let seed = 1; seed <= 20_000; seed++) {
    const r = cpuMax(seed);
    if (!best || r.max < best.max) best = { seed, ...r };
    if (best.max === floor) break;
  }
  console.log(JSON.stringify(best));
}
