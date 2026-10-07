import "fake-indexeddb/auto";
import { rowsFor } from "../../languages/it/store/rows.ts";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { GameRow, ReviewLogRow } from "../store/progressStore.ts";

// A fake Supabase that records every call, and can be told to fail.
const calls: { table: string; rows: unknown[]; options?: unknown }[] = [];
let failOn: string | null = null;
vi.mock("./supabase.ts", () => ({
  supabase: {
    from: (table: string) => ({
      upsert: async (rows: unknown[], options?: unknown) => {
        calls.push({ table, rows, options });
        return { error: failOn === table ? { message: "offline" } : null };
      },
    }),
  },
}));
const { useSyncStore, syncSaved } = await import("./sync.ts");
const { useProgressStore } = await import("../store/progressStore.ts");
const { read, resetForTests } = await import("./storage.ts");

const user = "00000000-0000-4000-8000-00000000000a";
const game = (id: string, over: Partial<GameRow> = {}): GameRow => ({
  id,
  seed: 1,
  level: 2,
  contentVersion: 1,
  startedAt: "2026-10-19T10:00:00.000Z",
  ...over,
});
const review = (id: string, gameId: string): ReviewLogRow => ({
  id,
  gameId,
  lexiconId: "n.capelli",
  direction: "produce",
  rating: "good",
  localDay: "2026-10-19",
  createdAt: "2026-10-19T10:01:00.000Z",
});

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  calls.length = 0;
  failOn = null;
  useProgressStore.setState({ games: [], reviewLog: [], loaded: true, owner: "guest" });
  await useSyncStore.getState().load(user);
});

describe("flush (CHI-084)", () => {
  test("games rows always go before review_log rows", async () => {
    const sync = useSyncStore.getState();
    // Logged in an awkward order: a review row first.
    sync.enqueue([
      { kind: "review", row: review("r1", "g1") },
      { kind: "game", row: game("g1") },
    ]);
    expect(await sync.flush()).toBe(true);
    expect(calls.map((c) => c.table)).toEqual(["games", "review_log"]);
    expect(calls[0]?.rows).toEqual([
      {
        id: "g1",
        user_id: user,
        seed: 1,
        level: 2,
        content_version: 1,
        started_at: "2026-10-19T10:00:00.000Z",
        ended_at: null,
        result: null,
      },
    ]);
    expect(calls[1]?.rows).toEqual([
      {
        id: "r1",
        user_id: user,
        game_id: "g1",
        lexicon_id: "n.capelli",
        direction: "produce",
        rating: "good",
        detail: null,
        local_day: "2026-10-19",
        created_at: "2026-10-19T10:01:00.000Z",
      },
    ]);
    expect(useSyncStore.getState()).toMatchObject({ outbox: [], status: "idle" });
  });

  test("a game written at START and again at round end is sent once, newest version", async () => {
    const sync = useSyncStore.getState();
    sync.enqueue([{ kind: "game", row: game("g1") }]);
    sync.enqueue([
      { kind: "game", row: game("g1", { endedAt: "2026-10-19T10:09:00.000Z", result: "won" }) },
    ]);
    await sync.flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.rows).toEqual([
      expect.objectContaining({ id: "g1", result: "won", ended_at: "2026-10-19T10:09:00.000Z" }),
    ]);
  });

  test("review rows are inserted with on conflict do nothing", async () => {
    useSyncStore.getState().enqueue([{ kind: "review", row: review("r1", "g1") }]);
    await useSyncStore.getState().flush();
    expect(calls[0]?.options).toEqual({ onConflict: "id", ignoreDuplicates: true });
  });

  test.each(["games", "review_log"])(
    "a failed flush (%s) keeps every row and marks the failure",
    async (table) => {
      failOn = table;
      const ops = [
        { kind: "game" as const, row: game("g1") },
        { kind: "review" as const, row: review("r1", "g1") },
      ];
      useSyncStore.getState().enqueue(ops);
      expect(await useSyncStore.getState().flush()).toBe(false);
      expect(useSyncStore.getState()).toMatchObject({ outbox: ops, status: "failed" });
      // The next flush sends them.
      failOn = null;
      expect(await useSyncStore.getState().flush()).toBe(true);
      expect(useSyncStore.getState()).toMatchObject({ outbox: [], status: "idle" });
    },
  );

  test("rows queued while a flush is in flight stay for the next one", async () => {
    const sync = useSyncStore.getState();
    sync.enqueue([{ kind: "game", row: game("g1") }]);
    const first = sync.flush();
    sync.enqueue([{ kind: "review", row: review("r1", "g1") }]);
    await first;
    expect(useSyncStore.getState().outbox).toEqual([{ kind: "review", row: review("r1", "g1") }]);
  });

  test("two flushes at once make one round of requests", async () => {
    useSyncStore.getState().enqueue([{ kind: "game", row: game("g1") }]);
    await Promise.all([useSyncStore.getState().flush(), useSyncStore.getState().flush()]);
    expect(calls).toHaveLength(1);
  });

  test("the outbox is saved per user and survives a reload", async () => {
    useSyncStore.getState().enqueue([{ kind: "game", row: game("g1") }]);
    await syncSaved();
    expect(await read(`outbox:${user}`)).toEqual([{ kind: "game", row: game("g1") }]);
    useSyncStore.setState({ outbox: [] });
    await useSyncStore.getState().load(user);
    expect(useSyncStore.getState().outbox).toHaveLength(1);
  });

  test("guests have no outbox and never call Supabase", async () => {
    await useSyncStore.getState().load(null);
    useSyncStore.getState().enqueue([{ kind: "game", row: game("g1") }]);
    expect(await useSyncStore.getState().flush()).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("the progress store feeds the outbox only when signed in", () => {
  test("signed in: games rows at start and end, and every review row", () => {
    useProgressStore.setState({ owner: user });
    const p = useProgressStore.getState();
    p.recordGameStart(game("g1"));
    p.appendRows(
      rowsFor(
        "g1",
        [{ type: "rating", lexiconId: "n.barba", direction: "produce", rating: "again" }],
        new Date(),
      ),
    );
    p.recordGameEnd("g1", "lost");
    expect(useSyncStore.getState().outbox.map((op) => op.kind)).toEqual(["game", "review", "game"]);
    expect(useSyncStore.getState().outbox[2]).toMatchObject({
      kind: "game",
      row: { id: "g1", result: "lost" },
    });
  });

  test("as a guest, nothing is queued", () => {
    const p = useProgressStore.getState();
    p.recordGameStart(game("g1"));
    p.appendRows(
      rowsFor(
        "g1",
        [{ type: "rating", lexiconId: "n.barba", direction: "produce", rating: "again" }],
        new Date(),
      ),
    );
    expect(useSyncStore.getState().outbox).toEqual([]);
  });
});
