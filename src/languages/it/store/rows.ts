// Spec 6 and 7: which of Chi è?'s round events are learning data. Ratings and
// agreement slips become review-log rows; every other event is not.
import type { GameEvent } from "../engine/index.ts";
import { localDay } from "../../../core/services/localDay.ts";
import type { NewReview } from "../../../core/store/progressStore.ts";

// Rating and slip events become log rows; every other event is not learning data.
export function rowsFor(
  gameId: string,
  events: GameEvent[],
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
    if (e.type === "agreementSlip") {
      return [
        {
          id: newId(),
          ...common,
          lexiconId: e.lexiconId,
          direction: "produce",
          rating: "slip",
          detail: { slot: "adj", given: e.given, expected: e.expected, rule: "agreement" },
        },
      ];
    }
    return [];
  });
}
