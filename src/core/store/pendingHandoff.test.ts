// Platform spec 5.3 step 4: a Chi è? player's unsynced rows flush only when that
// same user signs in, never under another account, and are deleted after 30 days.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, test, vi } from "vitest";

const uploaded: { table: string; rows: { id: string; user_id: string }[] }[] = [];
vi.mock("../services/supabase.ts", () => ({
  supabase: {
    from: (table: string) => ({
      upsert: async (rows: { id: string; user_id: string }[]) => {
        uploaded.push({ table, rows });
        return { error: null };
      },
    }),
  },
}));
const { encodeHandoff } = await import("../handoff/codec.ts");
const { importHandoff } = await import("../handoff/import.ts");
const { read, resetForTests } = await import("../services/storage.ts");
const { useSyncStore } = await import("../services/sync.ts");
const { useAccountStore } = await import("./account.ts");
const { useAuthStore } = await import("./authStore.ts");
const { adoptPendingHandoff, pendingKey } = await import("./pendingHandoff.ts");
const { progressStore } = await import("./progressStore.ts");

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const user = uuid(900);
const other = uuid(901);
const game = {
  id: uuid(1),
  seed: 1,
  level: 1 as const,
  contentVersion: 1,
  startedAt: "2026-11-01T10:00:00.000Z",
};
const review = {
  id: uuid(101),
  gameId: uuid(1),
  lexiconId: "n.cappello",
  direction: "recognize" as const,
  rating: "good" as const,
  localDay: "2026-11-01",
  createdAt: "2026-11-01T10:01:00.000Z",
};
const handedOff = new Date("2026-11-13T12:00:00Z");
const days = (n: number) => new Date(handedOff.getTime() + n * 24 * 60 * 60 * 1000);
const italian = progressStore("it");

async function signIn(userId: string | null) {
  useAuthStore.setState(
    userId
      ? { status: "signedIn", userId, email: "a@b.co" }
      : { status: "guest", userId: null, email: null },
  );
  italian.setState({ games: [], reviewLog: [], loaded: true, owner: userId ?? "guest" });
  await useSyncStore.getState().load(userId);
}

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  uploaded.length = 0;
  useAccountStore.setState({ settled: true });
  await signIn(null);
  // A signed-in Chi è? player's outbox arrives while nobody is signed in here.
  const data = await encodeHandoff({
    v: 1,
    outboxes: [
      {
        userId: user,
        ops: [
          { kind: "game", row: game },
          { kind: "review", row: review },
        ],
      },
    ],
  });
  await importHandoff(`#data=${data}`, handedOff);
});

test("the rows wait under outbox:pending-handoff with their user id", async () => {
  expect(await read(pendingKey)).toEqual([
    {
      userId: user,
      ops: [
        { kind: "game", row: { ...game, language: "it" } },
        { kind: "review", row: { ...review, language: "it" } },
      ],
    },
  ]);
  expect(await read("guest:it")).toEqual({ games: [], reviewLog: [] });
  expect(useSyncStore.getState().outbox).toHaveLength(0);
});

test("a guest, or a different account, leaves them untouched", async () => {
  await adoptPendingHandoff(null, days(1));
  await signIn(other);
  await adoptPendingHandoff(other, days(1));
  expect(useSyncStore.getState().outbox).toHaveLength(0);
  expect(await read(`outbox:${other}`)).toBeUndefined();
  expect(italian.getState().games).toHaveLength(0);
  expect(await read<unknown[]>(pendingKey)).toHaveLength(1);
});

test("the same user signing in flushes them under their own id", async () => {
  await signIn(user);
  await adoptPendingHandoff(user, days(1));
  expect(await read(pendingKey)).toBeUndefined();
  expect(await read<unknown[]>(`outbox:${user}`)).toHaveLength(2);
  expect(italian.getState().games.map((g) => g.id)).toEqual([game.id]);
  expect(italian.getState().reviewLog.map((r) => r.id)).toEqual([review.id]);

  expect(await useSyncStore.getState().flush()).toBe(true);
  expect(uploaded.map((u) => u.table)).toEqual(["games", "review_log"]); // games first
  for (const { rows } of uploaded) for (const row of rows) expect(row.user_id).toBe(user);
  expect(useSyncStore.getState().outbox).toHaveLength(0);

  // Signing in again finds nothing more to add.
  await adoptPendingHandoff(user, days(2));
  expect(useSyncStore.getState().outbox).toHaveLength(0);
});

test("arriving already signed in as that user flushes at once", async () => {
  await signIn(user);
  const data = await encodeHandoff({
    v: 1,
    outboxes: [{ userId: user, ops: [{ kind: "game", row: game }] }],
  });
  await importHandoff(`#data=${data}`, handedOff);
  expect(await read(pendingKey)).toBeUndefined();
  expect(useSyncStore.getState().outbox.length).toBeGreaterThan(0);
});

test("they are deleted once the handoff is older than 30 days", async () => {
  await adoptPendingHandoff(null, days(30));
  expect(await read<unknown[]>(pendingKey)).toHaveLength(1);
  await signIn(user);
  await adoptPendingHandoff(user, days(31));
  expect(await read(pendingKey)).toBeUndefined();
  expect(useSyncStore.getState().outbox).toHaveLength(0);
});

test("with no handoff date, the 30 days start at the next look", async () => {
  const { remove } = await import("../services/storage.ts");
  await remove("handoff");
  await adoptPendingHandoff(null, days(40));
  expect(await read<unknown[]>(pendingKey)).toHaveLength(1);
  expect(await read("handoff")).toEqual({ from: "chie", at: days(40).toISOString() });
  await adoptPendingHandoff(null, days(71));
  expect(await read(pendingKey)).toBeUndefined();
});
