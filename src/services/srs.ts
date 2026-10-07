// Spec 6: spaced repetition with FSRS (ts-fsrs, default parameters, desired
// retention 0.9). Card state is never stored as the truth: it is rebuilt by
// replaying the append-only review log in createdAt order.
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from "ts-fsrs";
import type { LexiconEntry } from "../content/schemas.ts";
import type { Direction } from "../engine/index.ts";
import type { ReviewLogRow } from "../store/progressStore.ts";

export type CardState = {
  lexiconId: string;
  direction: Direction;
  card: Card;
  reviews: number; // log rows applied (slips excluded)
};
export type Cards = Map<string, CardState>; // keyed "lexiconId|direction"

// No fuzz, so the same log always gives the same schedule on every device.
const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: false }));

// The game never produces "easy" (spec 6), so it has no grade here.
export const grades: Record<"again" | "hard" | "good", Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
};

const directions: Direction[] = ["recognize", "produce"];
export const cardKey = (lexiconId: string, direction: Direction) => `${lexiconId}|${direction}`;

// One card per noun per direction: 14 nouns × 2 = 28 in the MVP (spec 6).
export function emptyCards(lexicon: LexiconEntry[]): Cards {
  const cards: Cards = new Map();
  for (const e of lexicon) {
    if (e.pos !== "noun") continue;
    for (const direction of directions) {
      cards.set(cardKey(e.id, direction), {
        lexiconId: e.id,
        direction,
        card: createEmptyCard(new Date(0)),
        reviews: 0,
      });
    }
  }
  return cards;
}

// Apply one log row. Slip rows feed the Mistakes tab and are skipped here.
export function applyRow(cards: Cards, row: ReviewLogRow): Cards {
  if (row.rating === "slip") return cards;
  const key = cardKey(row.lexiconId, row.direction);
  const at = new Date(row.createdAt);
  const current = cards.get(key) ?? {
    lexiconId: row.lexiconId,
    direction: row.direction,
    card: createEmptyCard(at),
    reviews: 0,
  };
  // A card's first review starts its clock at that moment.
  const card = current.reviews === 0 ? createEmptyCard(at) : current.card;
  const next = new Map(cards);
  next.set(key, {
    ...current,
    card: scheduler.next(card, at, grades[row.rating]).card,
    reviews: current.reviews + 1,
  });
  return next;
}

// The one order every device replays in: createdAt, then id to break ties, so the
// same rows always give the same cards however they arrived (spec 7.3).
export function logOrder(a: ReviewLogRow, b: ReviewLogRow): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

// Rebuild every card from the log, oldest first.
export function replay(lexicon: LexiconEntry[], log: ReviewLogRow[]): Cards {
  return [...log].sort(logOrder).reduce(applyRow, emptyCards(lexicon));
}

// Reviewed cards whose next review falls on or before the end of `day` (local).
export function isDue(state: CardState, endOfDay: Date): boolean {
  return state.reviews > 0 && state.card.due.getTime() <= endOfDay.getTime();
}

export function endOfLocalDay(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate(), 23, 59, 59, 999);
}
