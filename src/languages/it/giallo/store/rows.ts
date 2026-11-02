// Chi è stato? GS 7: which of a case's events are learning data. Ratings and slips
// become rows in the shared Italian review log; every other event is not.
import { localDay } from "../../../../core/services/localDay.ts";
import type { NewReview } from "../../../../core/store/progressStore.ts";
import type { Event } from "../engine/types.ts";

export function rowsFor(
  gameId: string,
  events: Event[],
  at: Date,
  newId: () => string = () => crypto.randomUUID(),
): NewReview[] {
  const common = { gameId, localDay: localDay(at), createdAt: at.toISOString() };
  return events.flatMap((e): NewReview[] => {
    if (e.type === "rating") {
      return [
        {
          id: newId(),
          ...common,
          lexiconId: e.lexiconId,
          direction: e.direction,
          rating: e.rating,
          ...(e.detail && { detail: e.detail }),
        },
      ];
    }
    if (e.type === "slip") {
      return [
        {
          id: newId(),
          ...common,
          lexiconId: e.lexiconId,
          direction: "produce",
          rating: "slip",
          detail: e.error,
        },
      ];
    }
    return [];
  });
}
