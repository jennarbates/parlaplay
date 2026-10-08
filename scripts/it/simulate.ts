// Prints how long games against the CPU last (spec 5, CHI-047):
//
//   node scripts/simulate.ts [games]
import { readFileSync } from "node:fs";
import type { EngineContent } from "../../src/languages/it/engine/types.ts";
import { simulate } from "../../src/languages/it/engine/simulate.ts";

const read = (file: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../../src/languages/it/content/${file}`, import.meta.url), "utf8"),
  );
const content = {
  characters: read("characters.json"),
  lexicon: read("lexicon.json"),
  templates: read("templates.json"),
} as EngineContent;

const games = Number(process.argv[2] ?? 1000);
for (const strategy of ["passive", "smart"] as const) {
  const r = simulate(games, strategy, content);
  console.log(
    `${strategy.padEnd(7)} player, ${games} games: CPU needs ${r.avgCpuQuestionsToWin.toFixed(2)} questions on average (max ${r.maxCpuQuestionsToWin}); player wins ${(r.playerWinRate * 100).toFixed(1)}%`,
  );
}
