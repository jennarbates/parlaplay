// Spec 8.1: the Mistakes tab groups wrong answers and slips by word, each showing
// what was given and what was expected.
import type { ReviewLogRow } from "../store/progressStore.ts";

export type Group = {
  lexiconId: string;
  last: string;
  pairs: { given: string; expected: string; count: number }[];
};

export function groupMistakes(log: ReviewLogRow[]): Group[] {
  const groups = new Map<string, Group>();
  for (const r of log) {
    if (!r.detail || (r.rating !== "again" && r.rating !== "slip")) continue;
    const g = groups.get(r.lexiconId) ?? { lexiconId: r.lexiconId, last: r.createdAt, pairs: [] };
    if (r.createdAt > g.last) g.last = r.createdAt;
    const pair = g.pairs.find(
      (p) => p.given === r.detail?.given && p.expected === r.detail?.expected,
    );
    if (pair) pair.count++;
    else g.pairs.push({ given: r.detail.given, expected: r.detail.expected, count: 1 });
    groups.set(r.lexiconId, g);
  }
  return [...groups.values()].sort((a, b) => b.last.localeCompare(a.last));
}
