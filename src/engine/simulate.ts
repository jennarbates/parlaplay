// Spec 5 and CHI-047: play whole games with a scripted player to measure the
// CPU. Pure, so tests and scripts/simulate.ts can both use it.
import { indexContent, need } from "./content.ts";
import { evaluate } from "./predicate.ts";
import { allQuestions, questionTokens } from "./questions.ts";
import { startGame } from "./start.ts";
import { step } from "./step.ts";
import type { EngineContent, GameState } from "./types.ts";

export type PlayerStrategy = "passive" | "smart";
export type GameSummary = {
  seed: number;
  result: "won" | "lost";
  cpuQuestions: number;
  playerQuestions: number;
};

// passive: asks questions in catalog order and never guesses, so the CPU always wins
// and we see how many questions it needs. smart: tracks its own candidates, asks the
// best split like the CPU, and guesses once it knows.
export function simulateGame(
  seed: number,
  strategy: PlayerStrategy,
  content: EngineContent,
): GameSummary {
  const index = indexContent(content);
  const noun = (id: string) => need(index.noun, id);
  const character = (id: string) => need(index.character, id).attrs;
  const questions = allQuestions(content);
  let s: GameState = startGame(seed, 2, content);
  let candidates = content.characters.map((c) => c.id);

  for (let guard = 0; s.phase !== "over"; guard++) {
    if (guard > 500) throw new Error(`Game ${seed} did not end`);
    if (s.phase === "playerTurn") {
      const askedKeys = new Set(s.history.filter((h) => h.by === "player").map((h) => h.key));
      const [only, ...rest] = candidates;
      if (strategy === "smart" && only && rest.length === 0) {
        s = step(s, { type: "GUESS", characterId: only }, content).state;
        continue;
      }
      const open = questions.filter((q) => !askedKeys.has(q.key));
      const pick =
        strategy === "passive"
          ? open[0]
          : open
              .map((q) => ({
                q,
                d: Math.abs(
                  candidates.filter((id) => evaluate(noun(q.nounId), character(id))).length -
                    candidates.length / 2,
                ),
              }))
              .sort((a, b) => a.d - b.d)[0]?.q;
      if (!pick) throw new Error("no question left");
      s = step(s, { type: "ASK", tokens: questionTokens(pick, "pr.ta.m") }, content).state;
      const last = s.history.at(-1);
      if (last)
        candidates = candidates.filter(
          (id) => evaluate(noun(pick.nounId), character(id)) === last.answer,
        );
    } else if (s.phase === "cpuTurn") {
      const pending = s.pendingCpuQuestion;
      const verb = pending && index.verb.get(pending.key.split("|")[0] ?? "");
      s = step(s, { type: "ANSWER", answerId: verb?.yes ?? "", hintShown: false }, content).state;
    } else {
      s = step(s, { type: "END_TURN" }, content).state;
    }
  }
  return {
    seed,
    result: s.result ?? "lost",
    cpuQuestions: s.history.filter((h) => h.by === "cpu").length,
    playerQuestions: s.history.filter((h) => h.by === "player").length,
  };
}

export function simulate(games: number, strategy: PlayerStrategy, content: EngineContent) {
  const results = Array.from({ length: games }, (_, seed) => simulateGame(seed, strategy, content));
  const cpuWins = results.filter((r) => r.result === "lost");
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);
  return {
    games,
    playerWinRate: results.filter((r) => r.result === "won").length / games,
    avgCpuQuestionsToWin: avg(cpuWins.map((r) => r.cpuQuestions)),
    maxCpuQuestionsToWin: Math.max(...cpuWins.map((r) => r.cpuQuestions)),
    results,
  };
}
