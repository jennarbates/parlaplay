import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { emptyDoc, mergeDocs, parseDoc, sameDoc, type WorkbookDoc } from "./merge.ts";

const key = fc.constantFrom("1.1-0", "1.1-1", "2.3-0", "3.5-2");
const t = fc.integer({ min: 1, max: 1000 });
const doc: fc.Arbitrary<WorkbookDoc> = fc.record({
  resetAt: fc.integer({ min: 0, max: 1000 }),
  progress: fc.dictionary(
    key,
    fc
      .record({ total: fc.integer({ min: 1, max: 10 }), got: fc.integer({ min: 0, max: 10 }), t })
      .map(({ total, got, t }) => ({ score: Math.min(got, total), total, t })),
  ),
  free: fc.dictionary(key, fc.record({ v: fc.string(), t })),
  cando: fc.dictionary(key, fc.record({ v: fc.boolean(), t })),
  etu: fc.dictionary(key, fc.record({ v: fc.boolean(), t })),
});

describe("mergeDocs", () => {
  test("order and repeats don't matter between two copies", () => {
    fc.assert(
      fc.property(doc, doc, (a, b) => {
        const once = mergeDocs(a, b);
        expect(sameDoc(once, mergeDocs(b, a))).toBe(true);
        expect(sameDoc(mergeDocs(once, b), once)).toBe(true);
      }),
    );
  });

  test("two devices syncing through the server end up the same", () => {
    fc.assert(
      fc.property(doc, doc, doc, (server, a, b) => {
        const afterA = mergeDocs(a, server);
        const afterB = mergeDocs(b, afterA);
        expect(sameDoc(mergeDocs(afterA, afterB), afterB)).toBe(true);
      }),
    );
  });

  test("keeps the best score even when a worse one is newer", () => {
    const merged = mergeDocs(
      { ...emptyDoc(), progress: { x: { score: 9, total: 10, t: 1 } } },
      { ...emptyDoc(), progress: { x: { score: 2, total: 10, t: 5 } } },
    );
    expect(merged.progress.x?.score).toBe(9);
  });

  test("keeps the newest writing and checklist answer", () => {
    const merged = mergeDocs(
      { ...emptyDoc(), free: { x: { v: "old", t: 1 } }, cando: { y: { v: true, t: 9 } } },
      { ...emptyDoc(), free: { x: { v: "new", t: 2 } }, cando: { y: { v: false, t: 3 } } },
    );
    expect(merged.free.x?.v).toBe("new");
    expect(merged.cando.y?.v).toBe(true);
  });

  test("a reset on one device clears what another device still holds", () => {
    const stale: WorkbookDoc = {
      ...emptyDoc(),
      progress: { x: { score: 10, total: 10, t: 5 } },
      free: { y: { v: "old", t: 5 } },
    };
    const merged = mergeDocs(stale, emptyDoc(6));
    expect(merged.progress).toEqual({});
    expect(merged.free).toEqual({});
    expect(merged.resetAt).toBe(6);
  });

  test("work after a reset survives it", () => {
    const merged = mergeDocs(emptyDoc(6), {
      ...emptyDoc(6),
      progress: { x: { score: 1, total: 2, t: 7 } },
    });
    expect(merged.progress.x?.score).toBe(1);
  });
});

test("parseDoc treats anything unreadable as empty", () => {
  expect(parseDoc(null)).toEqual(emptyDoc());
  expect(parseDoc({ progress: "nope" })).toEqual(emptyDoc());
});
