// CHI-040, spec 4.4: every invariant, checked after every action of random games.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import { indexContent } from "./content.ts";
import { evaluate } from "./meaning.ts";
import { allQuestions, questionByKey } from "./questions.ts";
import { setupState } from "./start.ts";
import { step } from "./step.ts";
import { parseTiles } from "./tiles.ts";
import type { Action, GameEvent, GameState } from "./types.ts";

const index = indexContent(content);
const questions = allQuestions(content);
const ids = content.characters.map((c) => c.id);
const lexicon = content.lexicon;
const verbs = lexicon.filter((e) => e.pos === "verb").map((e) => e.id);
const arts = lexicon.filter((e) => e.pos === "article").map((e) => e.id);
const nouns = lexicon.filter((e) => e.pos === "noun").map((e) => e.id);
const adjRefs = lexicon
  .filter((e) => e.pos === "adj")
  .flatMap((e) => ["ms", "fs", "mp", "fp"].map((k) => `${e.id}#${k}`));

// Valid questions most of the time, so games move forward; random tiles the rest,
// which covers grammar errors, slips, nonsense and shape problems.
const askAction: fc.Arbitrary<Action> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc
      .constantFrom(...questions)
      .map((q) => ({ type: "ASK" as const, templateId: q.templateId, fill: q.fill })),
  },
  {
    weight: 2,
    arbitrary: fc
      .record({
        verb: fc.constantFrom(...verbs),
        art: fc.constantFrom(...arts),
        noun: fc.constantFrom(...nouns),
        adj: fc.option(fc.constantFrom(...adjRefs), { nil: undefined }),
      })
      .map((tiles): Action => {
        const parsed = parseTiles(tiles, content);
        if ("templateId" in parsed) return { type: "ASK", ...parsed };
        // A shape error dispatches nothing in the UI; send the raw payload anyway.
        const { adj, ...rest } = tiles;
        return {
          type: "ASK",
          templateId: index.noun.get(tiles.noun)?.template ?? "",
          fill: adj ? { ...rest, adj } : rest,
        };
      }),
  },
);

const action: fc.Arbitrary<Action> = fc.oneof(
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant("START" as const),
      seed: fc.integer(),
      level: fc.constantFrom(1 as const, 2 as const),
    }),
  },
  { weight: 6, arbitrary: askAction },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant("GUESS" as const),
      characterId: fc.constantFrom(...ids, "c.nobody"),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      type: fc.constant("FLIP" as const),
      characterId: fc.constantFrom(...ids),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      type: fc.constant("ANSWER" as const),
      value: fc.boolean(),
      hintShown: fc.boolean(),
    }),
  },
  { weight: 6, arbitrary: fc.constant({ type: "END_TURN" as const }) },
);

const game = fc
  .tuple(
    fc.integer(),
    fc.constantFrom(1 as const, 2 as const),
    fc.array(action, { minLength: 1, maxLength: 120, size: "max" }),
  )
  .map(([seed, level, rest]): Action[] => [{ type: "START", seed, level }, ...rest]);

type Step = { before: GameState; action: Action; after: GameState; events: GameEvent[] };

function play(actions: Action[]): Step[] {
  let s = setupState();
  return actions.map((a) => {
    const { state, events } = step(s, a, content);
    const record = { before: s, action: a, after: state, events };
    s = state;
    return record;
  });
}

const truthFor = (key: string, secret: string) => {
  const q = questionByKey(content, key);
  const c = index.character.get(secret);
  if (!q || !c) throw new Error(`bad key or secret: ${key} ${secret}`);
  return evaluate(q.asked, c.attrs);
};

const runs = { numRuns: 300 };

describe("spec 4.4 invariants hold after every action of random games", () => {
  test("1. playerSecret and cpuSecret never change after START", () => {
    fc.assert(
      fc.property(game, (actions) => {
        for (const { before, action, after } of play(actions)) {
          // Only an accepted START begins a new game with new secrets.
          const newGame =
            action.type === "START" && (before.phase === "setup" || before.phase === "over");
          if (newGame) continue;
          expect([after.playerSecret, after.cpuSecret]).toEqual([
            before.playerSecret,
            before.cpuSecret,
          ]);
        }
      }),
      runs,
    );
  });

  test("2. cpuCandidates always contains playerSecret", () => {
    fc.assert(
      fc.property(game, (actions) => {
        for (const { after } of play(actions)) {
          if (after.phase !== "setup") expect(after.cpuCandidates).toContain(after.playerSecret);
        }
      }),
      runs,
    );
  });

  test("3. every answer is the predicate on the asked side's secret", () => {
    fc.assert(
      fc.property(game, (actions) => {
        for (const { after } of play(actions)) {
          for (const h of after.history) {
            expect(h.answer).toBe(
              truthFor(h.key, h.by === "player" ? after.cpuSecret : after.playerSecret),
            );
          }
        }
      }),
      runs,
    );
  });

  test("4. a rejected action changes no field except lastFeedback and ratedThisTurn", () => {
    fc.assert(
      fc.property(game, (actions) => {
        for (const { before, after, events } of play(actions)) {
          if (!events.some((e) => e.type === "rejected")) continue;
          const strip = (g: GameState) =>
            Object.entries(g).filter(([k]) => k !== "lastFeedback" && k !== "ratedThisTurn");
          expect(strip(after)).toEqual(strip(before));
        }
      }),
      runs,
    );
  });

  test("5. history only grows within a round", () => {
    fc.assert(
      fc.property(game, (actions) => {
        for (const { before, action, after } of play(actions)) {
          if (action.type === "START") continue;
          expect(after.history.slice(0, before.history.length)).toEqual(before.history);
        }
      }),
      runs,
    );
  });

  test("6. over accepts only START", () => {
    fc.assert(
      fc.property(game, (actions) => {
        for (const { before, action, after, events } of play(actions)) {
          if (before.phase !== "over" || action.type === "START") continue;
          expect(events).toEqual([{ type: "rejected", reason: "wrongPhase" }]);
          expect(after).toEqual(before);
        }
      }),
      runs,
    );
  });

  test("7. same seed and actions give the same states and events", () => {
    fc.assert(
      fc.property(game, (actions) => {
        expect(play(actions)).toEqual(play(actions));
      }),
      { numRuns: 100 },
    );
  });

  test("8. at most one rating per lexiconId|direction per turn", () => {
    fc.assert(
      fc.property(game, (actions) => {
        let seen = new Set<string>();
        for (const { before, after, events } of play(actions)) {
          if (
            after.turn !== before.turn ||
            after.seed !== before.seed ||
            (after.phase === "playerTurn" && before.phase !== "playerTurn")
          ) {
            seen = new Set();
          }
          for (const e of events) {
            if (e.type !== "rating") continue;
            const card = `${e.lexiconId}|${e.direction}`;
            expect(seen.has(card), card).toBe(false);
            seen.add(card);
          }
        }
      }),
      runs,
    );
  });

  test("9. ratedThisTurn is empty at the start of every player turn", () => {
    fc.assert(
      fc.property(game, (actions) => {
        for (const { before, after } of play(actions)) {
          if (after.phase === "playerTurn" && before.phase !== "playerTurn")
            expect(after.ratedThisTurn).toEqual([]);
        }
      }),
      runs,
    );
  });

  test("random games reach every phase and both results", () => {
    const phases = new Set<string>();
    const results = new Set<string>();
    fc.assert(
      fc.property(game, (actions) => {
        for (const { after } of play(actions)) {
          phases.add(after.phase);
          if (after.result) results.add(after.result);
        }
      }),
      { ...runs, seed: 2026 }, // fixed, so this coverage check cannot flake
    );
    expect([...phases].sort()).toEqual(
      ["cpuReview", "cpuTurn", "over", "playerReview", "playerTurn"].sort(),
    );
    expect([...results].sort()).toEqual(["lost", "won"]);
  });
});
