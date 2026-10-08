// Spec 6: at most one rating per card per turn. ratedThisTurn remembers which
// "lexiconId|direction" pairs are already rated; a later rating is dropped, so a
// card that failed and was then fixed in the same turn keeps its "again".
import type { Direction, GameEvent, Rating, SlotError } from "./types.ts";

export type Rated = { events: GameEvent[]; ratedThisTurn: string[] };

export function rate(
  rated: Rated,
  lexiconId: string,
  direction: Direction,
  rating: Rating,
  detail?: SlotError,
): Rated {
  const card = `${lexiconId}|${direction}`;
  if (rated.ratedThisTurn.includes(card)) return rated;
  return {
    events: [
      ...rated.events,
      { type: "rating", lexiconId, direction, rating, ...(detail && { detail }) },
    ],
    ratedThisTurn: [...rated.ratedThisTurn, card],
  };
}
