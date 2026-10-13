// Platform spec 5.3: the handoff page's decisions, and that reading Chi è?'s
// database never changes it.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { decodeHandoff } from "../../src/core/handoff/codec.ts";
import { encodeJson } from "../../src/core/handoff/encoding.ts";
import { buildHandoff, importUrl, mappedPath, redirectUrl } from "./chie.ts";
import { readChie } from "./read.ts";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const game = {
  id: uuid(1),
  seed: 1,
  level: 1,
  contentVersion: 1,
  startedAt: "2026-10-20T10:00:00.000Z",
};
const review = {
  id: uuid(101),
  gameId: uuid(1),
  lexiconId: "n.barba",
  direction: "produce",
  rating: "again",
  localDay: "2026-10-20",
  createdAt: "2026-10-20T10:01:00.000Z",
};
const round = { contentVersion: 1, gameId: uuid(1), state: { phase: "playerTurn" } };
const ops = [
  { kind: "game", row: game },
  { kind: "review", row: review },
];

// Chi è?'s database as its chie-launch build made it.
async function seed(entries: Record<string, unknown>) {
  const db = await openDB("chi-e", 1, { upgrade: (d) => void d.createObjectStore("kv") });
  for (const [key, value] of Object.entries(entries)) await db.put("kv", value, key);
  db.close();
}

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
});

describe("the path", () => {
  test.each([
    ["/", "/it"],
    ["/play", "/it/play"],
    ["/play/", "/it/play"],
    ["/progress", "/it/progress"],
    ["/settings", "/it"],
    ["/privacy", "/it"],
    ["/play/extra", "/it"],
    ["//evil.example", "/it"],
  ])("%s maps to %s", (from, to) => {
    expect(mappedPath(from)).toBe(to);
  });

  test("with nothing to bring, the redirect is parlaplay.games plus the mapped path", () => {
    expect(redirectUrl("https://parlaplay.games", "/play")).toBe("https://parlaplay.games/it/play");
    expect(redirectUrl("https://parlaplay.games", "/")).toBe("https://parlaplay.games/it");
  });

  test("with data, it is /import with the data and next in the fragment", () => {
    expect(importUrl("https://parlaplay.games", "/progress", "abc")).toBe(
      "https://parlaplay.games/import#data=abc&next=/it/progress",
    );
  });
});

describe("what is handed off", () => {
  test.each([
    ["an empty database", {}],
    ["empty guest data", { guest: { games: [], reviewLog: [] } }],
    ["an empty outbox", { [`outbox:${uuid(900)}`]: [] }],
    [
      "only a signed-in player's synced copy",
      { [`user:${uuid(900)}`]: { games: [game], reviewLog: [review] } },
    ],
  ])("%s is nothing to bring", (_, entries) => {
    expect(buildHandoff(new Map(Object.entries(entries)))).toBeNull();
  });

  test("guest rows, the round and each outbox that holds rows", () => {
    const handoff = buildHandoff(
      new Map<string, unknown>([
        ["guest", { games: [game], reviewLog: [review] }],
        ["round", round],
        [`outbox:${uuid(900)}`, ops],
        [`outbox:${uuid(901)}`, []],
        [`user:${uuid(900)}`, { games: [game], reviewLog: [] }],
      ]),
    );
    expect(handoff).toEqual({
      v: 1,
      guest: { games: [game], reviewLog: [review] },
      round,
      outboxes: [{ userId: uuid(900), ops }],
    });
  });

  test("a round alone, or an outbox alone, is enough", () => {
    expect(buildHandoff(new Map([["round", round]]))).toEqual({ v: 1, round });
    expect(buildHandoff(new Map([[`outbox:${uuid(900)}`, ops]]))).toEqual({
      v: 1,
      outboxes: [{ userId: uuid(900), ops }],
    });
  });

  test("what the page encodes is what /import accepts", async () => {
    await seed({
      guest: { games: [game], reviewLog: [review] },
      round,
      [`outbox:${uuid(900)}`]: ops,
    });
    const handoff = buildHandoff(await readChie());
    expect(await decodeHandoff(await encodeJson(handoff))).toEqual(handoff);
  });
});

describe("reading Chi è?'s database", () => {
  test("reads every key and leaves the data as it was", async () => {
    const entries = {
      guest: { games: [game], reviewLog: [review] },
      round,
      [`outbox:${uuid(900)}`]: ops,
    };
    await seed(entries);
    expect(Object.fromEntries(await readChie())).toEqual(entries);
    expect(Object.fromEntries(await readChie())).toEqual(entries); // Try again finds it all
    const db = await openDB("chi-e");
    expect(db.version).toBe(1);
    expect((await db.getAllKeys("kv")).sort()).toEqual(Object.keys(entries).sort());
    db.close();
  });

  test("a device that never played Chi è? gets no database made for it", async () => {
    expect((await readChie()).size).toBe(0);
    expect(await indexedDB.databases()).toEqual([]);
  });

  test("storage that cannot be opened reads as empty", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new Error("blocked");
      },
    });
    expect((await readChie()).size).toBe(0);
  });
});
