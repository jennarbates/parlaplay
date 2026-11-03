// The workbook's saved progress and how two copies of it combine. A device can be
// offline or behind, so sync merges rather than overwrites: the best score for each
// exercise, the newest value for everything else, and nothing from before a reset.
import { z } from "zod";

const score = z.object({ score: z.number(), total: z.number().positive(), t: z.number() });
const value = <T extends z.ZodType>(v: T) => z.object({ v, t: z.number() });

const docSchema = z.object({
  resetAt: z.number(),
  progress: z.record(z.string(), score),
  free: z.record(z.string(), value(z.string())),
  cando: z.record(z.string(), value(z.boolean())),
  etu: z.record(z.string(), value(z.boolean())),
});

export type WorkbookDoc = z.infer<typeof docSchema>;
type Stamped = { t: number };

export const emptyDoc = (resetAt = 0): WorkbookDoc => ({
  resetAt,
  progress: {},
  free: {},
  cando: {},
  etu: {},
});

// What came back from the server or storage; anything unreadable counts as empty.
export function parseDoc(data: unknown): WorkbookDoc {
  const parsed = docSchema.safeParse(data);
  return parsed.success ? parsed.data : emptyDoc();
}

const stable = (x: unknown) => JSON.stringify(x);

function mergeRecord<E extends Stamped>(
  a: Record<string, E>,
  b: Record<string, E>,
  resetAt: number,
  wins: (x: E, y: E) => boolean,
): Record<string, E> {
  const out: Record<string, E> = {};
  for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const x = a[key];
    const y = b[key];
    const best = x && y ? (wins(x, y) ? x : y) : (x ?? y);
    if (best && best.t > resetAt) out[key] = best;
  }
  return out;
}

const newer = <E extends Stamped>(x: E, y: E) => (x.t !== y.t ? x.t > y.t : stable(x) >= stable(y));

const better = (x: z.infer<typeof score>, y: z.infer<typeof score>) => {
  const diff = x.score / x.total - y.score / y.total;
  return diff !== 0 ? diff > 0 : newer(x, y);
};

export function mergeDocs(a: WorkbookDoc, b: WorkbookDoc): WorkbookDoc {
  const resetAt = Math.max(a.resetAt, b.resetAt);
  return {
    resetAt,
    progress: mergeRecord(
      // A best score from before a reset must not beat a newer, lower one.
      keepAfter(a.progress, resetAt),
      keepAfter(b.progress, resetAt),
      resetAt,
      better,
    ),
    free: mergeRecord(a.free, b.free, resetAt, newer),
    cando: mergeRecord(a.cando, b.cando, resetAt, newer),
    etu: mergeRecord(a.etu, b.etu, resetAt, newer),
  };
}

function keepAfter<E extends Stamped>(record: Record<string, E>, resetAt: number) {
  return Object.fromEntries(Object.entries(record).filter(([, e]) => e.t > resetAt));
}

export const sameDoc = (a: WorkbookDoc, b: WorkbookDoc) =>
  stable(normalise(a)) === stable(normalise(b));

function normalise(doc: WorkbookDoc) {
  const sorted = <E>(r: Record<string, E>) =>
    Object.fromEntries(Object.entries(r).sort(([x], [y]) => (x < y ? -1 : 1)));
  return {
    resetAt: doc.resetAt,
    progress: sorted(doc.progress),
    free: sorted(doc.free),
    cando: sorted(doc.cando),
    etu: sorted(doc.etu),
  };
}
