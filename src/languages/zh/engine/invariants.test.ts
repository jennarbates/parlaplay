// Spec 4.5 and 10.2: random action sequences never break an invariant, and random
// token lists never throw.
import fc from "fast-check";
import { expect, test } from "vitest";
import { content } from "../content/index.ts";
import { indexContent } from "./content.ts";
import { evaluate, parseKey } from "./predicate.ts";
import { allQuestions, questionTokens } from "./questions.ts";
import { setupState } from "./start.ts";
import { step } from "./step.ts";
import type { Action, GameEvent, GameState } from "./types.ts";

const index = indexContent(content);
const ids = content.characters.map((c) => c.id);
const tokenIds = content.lexicon.filter((e) => e.pos !== "answer").map((e) => e.id);
const answerIds = content.lexicon.filter((e) => e.pos === "answer").map((e) => e.id);

// Valid questions most of the time, so games move forward; random tokens the rest.
const action: fc.Arbitrary<Action> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc
      .tuple(fc.constantFrom(...allQuestions(content)), fc.constantFrom("pr.ta.m", "pr.ta.f"))
      .map(([q, p]) => ({ type: "ASK" as const, tokens: questionTokens(q, p) })),
  },
  {
    weight: 2,
    arbitrary: fc
      .array(fc.constantFrom(...tokenIds, "n.unknown"), { maxLength: 7 })
      .map((tokens) => ({ type: "ASK" as const, tokens })),
  },
  {
    weight: 1,
    arbitrary: fc
      .constantFrom(...ids)
      .map((characterId) => ({ type: "GUESS" as const, characterId })),
  },
  {
    weight: 2,
    arbitrary: fc
      .constantFrom(...ids)
      .map((characterId) => ({ type: "FLIP" as const, characterId })),
  },
  {
    weight: 3,
    arbitrary: fc
      .tuple(fc.constantFrom(...answerIds), fc.boolean())
      .map(([answerId, hintShown]) => ({ type: "ANSWER" as const, answerId, hintShown })),
  },
  { weight: 5, arbitrary: fc.constant({ type: "END_TURN" as const }) },
  {
    weight: 1,
    arbitrary: fc
      .tuple(fc.nat(), fc.constantFrom(1 as const, 2 as const))
      .map(([seed, level]) => ({ type: "START" as const, seed, level })),
  },
);

const secretOf = (s: GameState, by: "player" | "cpu") =>
  by === "player" ? s.cpuSecret : s.playerSecret;

function check(prev: GameState, a: Action, s: GameState, events: GameEvent[]) {
  const newRound = a.type === "START" && !events.some((e) => e.type === "rejected");
  if (!newRound && prev.phase !== "setup") {
    // 1. Secrets never change. 5. History only grows.
    expect(s.playerSecret).toBe(prev.playerSecret);
    expect(s.cpuSecret).toBe(prev.cpuSecret);
    expect(s.history.slice(0, prev.history.length)).toEqual(prev.history);
  }
  if (s.phase === "setup") return;
  // 2. The CPU never rules out the right answer.
  expect(s.cpuCandidates).toContain(s.playerSecret);
  for (const h of s.history) {
    // 3. Answers are true for the asked side's secret.
    const noun = index.noun.get(parseKey(h.key).nounId);
    const attrs = index.character.get(secretOf(s, h.by))?.attrs;
    expect(noun && attrs && evaluate(noun, attrs)).toBe(h.answer);
    // 10. Answers use the asker's pronoun, never the other one.
    const [mine, other] = h.pron === "pr.ta.f" ? ["她", "他"] : ["他", "她"];
    expect(h.answerText).toContain(mine);
    expect(h.answerText).not.toContain(other);
  }
  // 4. A rejection changes nothing but lastFeedback and ratedThisTurn.
  if (events.some((e) => e.type === "rejected")) {
    const strip = (x: GameState) => ({ ...x, lastFeedback: undefined, ratedThisTurn: [] });
    expect(strip(s)).toEqual(strip(prev));
  }
  // 6. over accepts only START.
  if (prev.phase === "over" && a.type !== "START")
    expect(events).toEqual([{ type: "rejected", reason: "wrongPhase" }]);
  // 8. At most one rating per card per turn.
  expect(new Set(s.ratedThisTurn).size).toBe(s.ratedThisTurn.length);
  // 9. A player turn starts with no ratings.
  if (s.phase === "playerTurn" && prev.phase === "cpuReview") expect(s.ratedThisTurn).toEqual([]);
  // 11. Level 1 ASK never rates.
  if (a.type === "ASK" && s.level === 1)
    expect(events.some((e) => e.type === "rating")).toBe(false);
}

test("random games keep every invariant", () => {
  fc.assert(
    fc.property(
      fc.nat(),
      fc.constantFrom(1 as const, 2 as const),
      fc.array(action, { maxLength: 80 }),
      (seed, level, actions) => {
        let s = step(setupState(), { type: "START", seed, level }, content).state;
        const ratings = new Set<string>();
        for (const a of actions) {
          const prev = s;
          const r = step(s, a, content);
          s = r.state;
          check(prev, a, s, r.events);
          if (s.turn !== prev.turn || s.history.length < prev.history.length) ratings.clear();
          for (const e of r.events) {
            if (e.type !== "rating") continue;
            const card = `${e.lexiconId}|${e.direction}`;
            expect(ratings.has(card)).toBe(false); // 8, across the whole turn
            ratings.add(card);
          }
        }
      },
    ),
    { numRuns: 300 },
  );
});

test("the same seed and actions give the same states and events (invariant 7)", () => {
  fc.assert(
    fc.property(fc.nat(), fc.array(action, { maxLength: 40 }), (seed, actions) => {
      const run = () => {
        let s = step(setupState(), { type: "START", seed, level: 2 }, content).state;
        const all: unknown[] = [];
        for (const a of actions) {
          const r = step(s, a, content);
          s = r.state;
          all.push(r);
        }
        return all;
      };
      expect(run()).toEqual(run());
    }),
    { numRuns: 100 },
  );
});

test("random token lists never throw and give exactly one outcome", () => {
  const start = step(setupState(), { type: "START", seed: 1, level: 2 }, content).state;
  fc.assert(
    fc.property(fc.array(fc.constantFrom(...tokenIds), { maxLength: 8 }), (tokens) => {
      const { state, events } = step(start, { type: "ASK", tokens }, content);
      const reasons = events.flatMap((e) => (e.type === "rejected" ? [e.reason] : []));
      const accepted = events.some((e) => e.type === "asked");
      expect(reasons.length + (accepted ? 1 : 0)).toBe(1);
      if (!accepted) expect(["shape", "grammar", "offBoard", "duplicate"]).toContain(reasons[0]);
      expect(state.phase).toBe(accepted ? "playerReview" : "playerTurn");
    }),
    { numRuns: 2000 },
  );
});

test("questions that differ only in pronoun share a key (invariant 12)", () => {
  const start = step(setupState(), { type: "START", seed: 1, level: 1 }, content).state;
  for (const q of allQuestions(content)) {
    const he = step(start, { type: "ASK", tokens: questionTokens(q, "pr.ta.m") }, content).state;
    const she = step(start, { type: "ASK", tokens: questionTokens(q, "pr.ta.f") }, content).state;
    expect(he.history[0]?.key).toBe(she.history[0]?.key);
  }
});
