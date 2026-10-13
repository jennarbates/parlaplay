import { cardIds } from "../cards.ts";
import type { GuestData } from "../../../core/store/progressStore.ts";
import { progressStats as stats, type ProgressStats } from "../../../core/ui/progressStats.ts";

export type { ProgressStats };

// The shared dashboard totals (desktop spec DS 3), over Chi è?'s cards.
export const progressStats = (data: GuestData, now: Date): ProgressStats =>
  stats(data, now, cardIds());
