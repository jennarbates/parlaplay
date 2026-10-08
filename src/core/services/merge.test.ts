import "fake-indexeddb/auto";
import { rowsFor } from "../../languages/it/store/rows.ts";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { GameRow, ReviewLogRow } from "../store/progressStore.ts";

// A fake Supabase holding one account's rows, shared by two "devices".
const server: {
  games: Record<string, unknown>[];
  review_log: Record<string, unknown>[];
  cards: Record<string, unknown>[];
} = {
  games: [],
  review_log: [],
  cards: [],
};
let ranges: [number, number][] = [];
vi.mock("./supabase.ts", () => ({
  supabase: {
    from: (table: keyof typeof server) => ({
      upsert: async (rows: Record<string, unknown>[], options?: { ignoreDuplicates?: boolean }) => {
        for (const row of rows) {
          // cards' primary key includes the language (platform spec 6.1).
          const keyOf = (r: Record<string, unknown>) =>
            table === "cards" ? `${r.language}|${r.lexicon_id}|${r.direction}` : r.id;
          const key = keyOf(row);
          const i = server[table].findIndex((r) => keyOf(r) === key);
          if (i === -1) server[table].push(row);
          else if (
            table === "cards" &&
            (row.log_count as number) < (server.cards[i]?.log_count as number)
          )
            continue; // the trigger
          else if (!options?.ignoreDuplicates) server[table][i] = row;
        }
        return { error: null };
      },
      select: () => ({
        order: () => ({
          range: async (from: number, to: number) => {
            ranges.push([from, to]);
            const sorted = [...server[table]].sort((a, b) =>
              String(a.id).localeCompare(String(b.id)),
            );
            return { data: sorted.slice(from, to + 1), error: null };
          },
        }),
      }),
    }),
  },
}));
const { useSyncStore, pull, reviewToDb, gameToDb } = await import("./sync.ts");
const useProgressStore = (await import("../store/progressStore.ts")).progressStore("it");
const { syncNow } = await import("../store/account.ts");
const { resetForTests } = await import("./storage.ts");

const user = "00000000-0000-4000-8000-00000000000a";
const game = (id: string, over: Partial<GameRow> = {}): GameRow => ({
  id,
  language: "it",
  seed: 1,
  level: 2,
  contentVersion: 1,
  startedAt: "2026-10-19T10:00:00.000Z",
  ...over,
});
const review = (id: string, gameId: string, minute = 1): ReviewLogRow => ({
  id,
  language: "it",
  gameId,
  lexiconId: "n.capelli",
  direction: "produce",
  rating: "good",
  localDay: "2026-10-19",
  createdAt: `2026-10-19T10:${String(minute).padStart(2, "0")}:00.000Z`,
});

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  server.games = [];
  server.review_log = [];
  server.cards = [];
  ranges = [];
  useProgressStore.setState({ games: [], reviewLog: [], loaded: true, owner: user });
  await useSyncStore.getState().load(user);
});

describe("pull (CHI-086)", () => {
  test("downloads the whole log, page by page", async () => {
    server.review_log = Array.from({ length: 2500 }, (_, i) =>
      reviewToDb(user, review(`r${String(i).padStart(5, "0")}`, "g1", i % 60)),
    );
    server.games = [gameToDb(user, game("g1"))];
    const remote = await pull();
    expect(remote?.reviewLog).toHaveLength(2500);
    expect(ranges.filter(([from]) => from >= 0).map(([from]) => from)).toEqual(
      expect.arrayContaining([0, 1000, 2000]),
    );
  });

  test("rows come back in the app's shape", async () => {
    server.games = [
      gameToDb(user, game("g1", { endedAt: "2026-10-19T10:09:00.000Z", result: "won" })),
    ];
    server.review_log = [
      reviewToDb(user, {
        ...review("r1", "g1"),
        detail: { slot: "art", given: "il", expected: "la", rule: "art.fsg" },
      }),
    ];
    const remote = await pull();
    expect(remote).toEqual({
      games: [game("g1", { endedAt: "2026-10-19T10:09:00.000Z", result: "won" })],
      reviewLog: [
        {
          ...review("r1", "g1"),
          detail: { slot: "art", given: "il", expected: "la", rule: "art.fsg" },
        },
      ],
    });
  });

  test("upserts the replayed cards with log_count = rows replayed", async () => {
    server.review_log = [
      reviewToDb(user, review("r1", "g1", 1)),
      reviewToDb(user, review("r2", "g1", 2)),
    ];
    await pull();
    expect(server.cards).toEqual([
      expect.objectContaining({
        user_id: user,
        lexicon_id: "n.capelli",
        direction: "produce",
        log_count: 2,
      }),
    ]);
  });

  test("each language's cards come from its own rows, with its own log_count (6.1)", async () => {
    server.review_log = [
      reviewToDb(user, review("r1", "g1", 1)),
      reviewToDb(user, review("r2", "g1", 2)),
      reviewToDb(user, { ...review("r3", "g2", 3), language: "zh", lexiconId: "n.gou" }),
    ];
    const remote = await pull();
    expect(server.cards).toEqual([
      expect.objectContaining({ language: "it", lexicon_id: "n.capelli", log_count: 2 }),
      expect.objectContaining({ language: "zh", lexicon_id: "n.gou", log_count: 1 }),
    ]);
    // Rows come back with their language, for each store to keep its own.
    expect(remote?.reviewLog.map((r) => [r.id, r.language])).toEqual([
      ["r1", "it"],
      ["r2", "it"],
      ["r3", "zh"],
    ]);
  });

  test("rows of a language this app doesn't have are left out", async () => {
    server.review_log = [{ ...reviewToDb(user, review("r1", "g1")), language: "fr" }];
    expect((await pull())?.reviewLog).toEqual([]);
  });

  test("a stale device cannot overwrite newer cards", async () => {
    server.cards = [
      {
        user_id: user,
        language: "it",
        lexicon_id: "n.capelli",
        direction: "produce",
        state: { newer: true },
        log_count: 9,
      },
    ];
    server.review_log = [reviewToDb(user, review("r1", "g1"))];
    await pull();
    expect(server.cards[0]).toMatchObject({ log_count: 9, state: { newer: true } });
  });
});

describe("two devices converge (CHI-086)", () => {
  test("each device's rows end up on both, with the same Progress", async () => {
    // Device A plays and syncs.
    useProgressStore.getState().recordGameStart(game("gA"));
    useProgressStore
      .getState()
      .appendRows(
        rowsFor(
          "gA",
          [{ type: "rating", lexiconId: "n.barba", direction: "produce", rating: "again" }],
          new Date(),
        ),
      );
    await syncNow();
    const deviceA = {
      games: useProgressStore.getState().games,
      reviewLog: useProgressStore.getState().reviewLog,
    };

    // Device B (fresh local copy, same account) plays something else and syncs.
    useProgressStore.setState({ games: [], reviewLog: [], loaded: true, owner: user });
    await useSyncStore.getState().load(user);
    useSyncStore.setState({ outbox: [] });
    useProgressStore.getState().recordGameStart(game("gB"));
    useProgressStore
      .getState()
      .appendRows(
        rowsFor(
          "gB",
          [{ type: "rating", lexiconId: "n.occhi", direction: "recognize", rating: "hard" }],
          new Date(),
        ),
      );
    await syncNow();
    const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();
    expect(ids(useProgressStore.getState().games)).toEqual(["gA", "gB"]);
    expect(useProgressStore.getState().reviewLog).toHaveLength(2);

    // Device A syncs again and now matches B.
    useProgressStore.setState({ ...deviceA, loaded: true, owner: user });
    await syncNow();
    expect(ids(useProgressStore.getState().games)).toEqual(["gA", "gB"]);
    expect(ids(useProgressStore.getState().reviewLog)).toEqual(
      ids(server.review_log as { id: string }[]),
    );
  });

  test("a finished game from another device beats the same game still open here", () => {
    useProgressStore.setState({ games: [game("g1")] });
    useProgressStore.getState().mergeRemote({
      games: [game("g1", { result: "lost", endedAt: "2026-10-19T11:00:00.000Z" })],
      reviewLog: [],
    });
    expect(useProgressStore.getState().games).toEqual([
      game("g1", { result: "lost", endedAt: "2026-10-19T11:00:00.000Z" }),
    ]);
    // And never the other way round.
    useProgressStore.getState().mergeRemote({ games: [game("g1")], reviewLog: [] });
    expect(useProgressStore.getState().games[0]?.result).toBe("lost");
  });
});
