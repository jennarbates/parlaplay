// Chi è stato? GS 7: every row of the event table, played through the real engine,
// and one rating per card per turn (it.md 6).
import { describe, expect, test } from "vitest";
import { localDay } from "../../../../core/services/localDay.ts";
import { lemmaOf } from "../engine/question.ts";
import { start } from "../engine/start.ts";
import { askOf, engineContent, run } from "../engine/testing.ts";
import type { Action, Built, CaseState, InspectorQuestion, Level } from "../engine/types.ts";
import { rowsFor } from "./rows.ts";

const at = new Date(2026, 11, 9, 23, 30); // 23:30 local time on 9 December
const begin = (level: Level = 2) => start(7, "case.torta", level, engineContent);

// A question as the Level 2 builder makes it: the lemma comes from the tiles.
const tiles = (to: string, frame: string, form: string, prep?: string, slot?: number): Built => ({
  to,
  frame,
  form,
  qword: lemmaOf(engineContent.lexicon, form, prep) ?? "",
  ...(prep && { prep }),
  ...(slot !== undefined && { slot }),
});

// The rows the actions make, without the fields every row shares.
function rowsOf(state: CaseState, ...actions: Action[]) {
  return rowsFor("g1", run(state, ...actions).events, at).map(
    ({ lexiconId, direction, rating, detail }) => ({
      lexiconId,
      direction,
      rating,
      ...(detail && { detail }),
    }),
  );
}

const question: InspectorQuestion = {
  qword: "q.dove",
  text: "Dov'era Paolo tra le otto e le nove?",
  options: ["In biblioteca.", "Tra le otto e le nove.", "Con Marta."],
  answer: "In biblioteca.",
};
const inspecting = (): CaseState => ({ ...begin(), phase: "inspector", inspector: question });

const umbrellaWrong = tiles("r.witness", "f.owner.umbrella", "chi");
const umbrellaRight = tiles("r.witness", "f.owner.umbrella", "chi", "prep.di");

describe("GS 7: each event of the table", () => {
  test("Level 2 accepted, no slip: good for the qword's produce card", () => {
    expect(rowsOf(begin(), askOf(umbrellaRight))).toEqual([
      { lexiconId: "q.di_chi", direction: "produce", rating: "good" },
    ]);
  });

  test("Level 2 accepted with a slip: produce isn't rated, a slip row is logged", () => {
    const built = tiles("r.pairA", "f.shoes", "quale");
    expect(rowsOf(begin(), askOf(built))).toEqual([
      {
        lexiconId: "q.quale",
        direction: "produce",
        rating: "slip",
        detail: { slot: "qword", given: "quale", expected: "quali", rule: "agree.quale" },
      },
    ]);
  });

  test("Level 2 rejected for elision: again, with the mistake", () => {
    const built = tiles("r.witness", "f.saw.slot", "dov'", undefined, 1);
    expect(rowsOf(begin(), askOf(built))).toEqual([
      {
        lexiconId: "q.dove",
        direction: "produce",
        rating: "again",
        detail: { slot: "qword", given: "dov'", expected: "dove", rule: "elide.consonant" },
      },
    ]);
  });

  test("Level 2 rejected for a known error: again for the qword that should have been built", () => {
    expect(rowsOf(begin(), askOf(umbrellaWrong))).toEqual([
      {
        lexiconId: "q.di_chi",
        direction: "produce",
        rating: "again",
        detail: { slot: "prep", given: "", expected: "di", rule: "prep.diChi" },
      },
    ]);
  });

  test("two errors: a row per card, each with its own mistake, and no slip row", () => {
    expect(rowsOf(begin(), askOf(tiles("r.pairA", "f.from", "dov'")))).toEqual([
      {
        lexiconId: "q.dove",
        direction: "produce",
        rating: "again",
        detail: { slot: "qword", given: "dov'", expected: "dove", rule: "elide.consonant" },
      },
      {
        lexiconId: "q.da_dove",
        direction: "produce",
        rating: "again",
        detail: { slot: "prep", given: "", expected: "da", rule: "prep.daDove" },
      },
    ]);
    // Elision with agreement: rejected, so agreement is feedback, not a slip row.
    const built = tiles("r.witness", "f.people.cucina.slot", "quant'", undefined, 1);
    expect(rowsOf(begin(), askOf(built)).map((r) => r.rating)).toEqual(["again"]);
  });

  test.each([
    ["accepted", umbrellaRight],
    ["accepted with a wrong form", tiles("r.pairA", "f.shoes", "quale")],
    ["rejected for a known error", umbrellaWrong],
  ])("Level 1 question %s: no rows", (_, built) => {
    expect(rowsOf(begin(1), askOf(built))).toEqual([]);
  });

  test("rejected as nonsense, duplicate or shape: no rows", () => {
    const nonsense = tiles("r.pairA", "f.arrive", "quanto");
    expect(rowsOf(begin(), askOf(nonsense))).toEqual([]);
    expect(rowsOf(begin(), askOf({ ...umbrellaRight, to: "r.nobody" }))).toEqual([]);
    const once = run(begin(), askOf(umbrellaRight)).state;
    expect(rowsOf(once, askOf(umbrellaRight))).toEqual([]);
  });

  test("inspector answered right, no hint: hard for the qword's recognize card", () => {
    const answer: Action = { type: "ANSWER_INSPECTOR", choice: question.answer };
    expect(rowsOf(inspecting(), answer)).toEqual([
      { lexiconId: "q.dove", direction: "recognize", rating: "hard" },
    ]);
  });

  test("inspector answered wrong: again, with detail", () => {
    const answer: Action = { type: "ANSWER_INSPECTOR", choice: "Con Marta." };
    expect(rowsOf(inspecting(), answer)).toEqual([
      {
        lexiconId: "q.dove",
        direction: "recognize",
        rating: "again",
        detail: {
          slot: "answer",
          given: "Con Marta.",
          expected: "In biblioteca.",
          rule: "answer.wrong",
        },
      },
    ]);
  });

  test.each(["In biblioteca.", "Con Marta."])("hint shown, answered %s: no rows", (choice) => {
    const answer: Action = { type: "ANSWER_INSPECTOR", choice, hintShown: true };
    expect(rowsOf(inspecting(), answer)).toEqual([]);
  });

  test("events that aren't learning data make no rows: asking the inspector, the end", () => {
    const ended = rowsOf(begin(), { type: "QUIT" });
    expect(ended).toEqual([]);
    expect(
      rowsFor(
        "g1",
        [
          { type: "inspectorAsked", question },
          { type: "ended", solved: false },
        ],
        at,
      ),
    ).toEqual([]);
  });
});

describe("one rating per card per turn (it.md 6)", () => {
  test("failing twice is one again, and fixing it keeps the again", () => {
    expect(
      rowsOf(begin(), askOf(umbrellaWrong), askOf(umbrellaWrong), askOf(umbrellaRight)).map(
        (r) => `${r.lexiconId} ${r.rating}`,
      ),
    ).toEqual(["q.di_chi again"]);
  });

  test("the next accepted question is a new turn, and can rate the card again", () => {
    const keys = tiles("r.witness", "f.owner.keys", "chi", "prep.di");
    expect(
      rowsOf(begin(), askOf(umbrellaWrong), askOf(umbrellaRight), askOf(keys)).map(
        (r) => `${r.lexiconId} ${r.rating}`,
      ),
    ).toEqual(["q.di_chi again", "q.di_chi good"]);
  });
});

describe("what every row carries", () => {
  test("a client id, the games row's id, the local day and the time", () => {
    let n = 0;
    const { events } = run(begin(), askOf(umbrellaRight));
    expect(rowsFor("g1", events, at, () => `id-${++n}`)).toEqual([
      {
        id: "id-1",
        gameId: "g1",
        lexiconId: "q.di_chi",
        direction: "produce",
        rating: "good",
        localDay: localDay(at),
        createdAt: at.toISOString(),
      },
    ]);
  });
});
