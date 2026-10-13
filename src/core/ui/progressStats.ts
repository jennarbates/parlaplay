import { endOfLocalDay, isDue, replay } from "../services/srs.ts";
import { localDay } from "../services/localDay.ts";
import type { GuestData } from "../store/progressStore.ts";

// Desktop spec DS 3: the four totals on the desktop Progress dashboard, all from
// data the app already keeps (DD10).
export type ProgressStats = {
  wordsSeen: number; // distinct lexiconId in reviewLog
  dueToday: number; // reviewed cards due by the end of today: what the Due list shows
  mistakesThisWeek: number; // "again" or "slip" rows in the last 7 local days, today included
  roundsPlayed: number; // games rows with endedAt set
};

// `cardIds` is the language's own: the lexicon ids that have FSRS cards.
export function progressStats(
  data: GuestData,
  now: Date,
  cardIds: readonly string[],
): ProgressStats {
  const today = localDay(now);
  const weekStart = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  const end = endOfLocalDay(now);
  return {
    wordsSeen: new Set(data.reviewLog.map((r) => r.lexiconId)).size,
    dueToday: [...replay(cardIds, data.reviewLog).values()].filter((c) => isDue(c, end)).length,
    mistakesThisWeek: data.reviewLog.filter(
      (r) =>
        (r.rating === "again" || r.rating === "slip") &&
        r.localDay >= weekStart &&
        r.localDay <= today,
    ).length,
    roundsPlayed: data.games.filter((g) => g.endedAt).length,
  };
}
