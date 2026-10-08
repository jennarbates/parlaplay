// Spec 6 and 7.1: which of Shéi's round events are learning data. Ratings and
// grammar slips become review-log rows; every other event is not.
import type { Direction, GameEvent, SlotError } from "../engine/index.ts";
import { localDay } from "../../../core/services/localDay.ts";
import type { NewReview } from "../../../core/store/progressStore.ts";

const slipSlots: Record<string, { slot: SlotError["slot"]; direction: Direction }> = {
  "gp.ma": { slot: "ma", direction: "produce" },
  "gp.order": { slot: "order", direction: "produce" },
  "gp.pron.you": { slot: "pron", direction: "produce" },
  "gp.pron.gender": { slot: "pron", direction: "produce" },
  "gp.answer.verb": { slot: "answer", direction: "recognize" },
  "gp.neg.mei": { slot: "answer", direction: "recognize" },
};

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
    // Spec 6 and 7.1: a slip row carries the grammar point id. Answer-side slips
    // are filed under recognize, question-side slips under produce.
    if (e.type === "grammarSlip") {
      const slip = slipSlots[e.point] ?? { slot: "order", direction: "produce" };
      return [
        {
          id: newId(),
          ...common,
          lexiconId: e.point,
          direction: slip.direction,
          rating: "slip",
          detail: { slot: slip.slot, given: e.given, expected: e.expected, rule: e.point },
        },
      ];
    }
    return [];
  });
}
