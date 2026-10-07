// CHI-088: the sync rules of spec 7.3, proved against the local Supabase that CI
// starts (supabase start). Skipped when it isn't running, as on a laptop without
// Docker. The app's own sync code runs here, signed in as throwaway test users.
import "fake-indexeddb/auto";
import { rowsFor } from "../src/languages/it/store/rows.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { resetForTests } from "../src/core/services/storage.ts";
import { setClientForTests } from "../src/core/services/supabase.ts";
import { pull, useSyncStore } from "../src/core/services/sync.ts";
import { adoptGuestData, syncNow } from "../src/core/store/account.ts";
import {
  useProgressStore,
  type GameRow,
  type ReviewLogRow,
} from "../src/core/store/progressStore.ts";
import { write } from "../src/core/services/storage.ts";

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = !!(url && anonKey && serviceKey);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

async function newUser(): Promise<{
  id: string;
  client: SupabaseClient;
  email: string;
  password: string;
}> {
  if (!url || !anonKey || !serviceKey) throw new Error("no Supabase");
  const admin = createClient(url, serviceKey, noSession);
  const email = `sync-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("no user");
  return { id: data.user.id, email, password, client: await signedIn(email, password) };
}

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  if (!url || !anonKey) throw new Error("no Supabase");
  const client = createClient(url, anonKey, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const game = (id: string, over: Partial<GameRow> = {}): GameRow => ({
  id,
  seed: 1,
  level: 2,
  contentVersion: 1,
  startedAt: new Date().toISOString(),
  ...over,
});
const review = (gameId: string, minute: number): ReviewLogRow => ({
  id: crypto.randomUUID(),
  gameId,
  lexiconId: "n.capelli",
  direction: "produce",
  rating: "good",
  localDay: "2026-10-19",
  createdAt: new Date(Date.UTC(2026, 9, 19, 10, minute)).toISOString(),
});

// Run the app's stores as `userId` on a fresh device.
async function device(userId: string, client: SupabaseClient) {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  setClientForTests(client);
  useProgressStore.setState({ games: [], reviewLog: [], loaded: true, owner: userId });
  await useSyncStore.getState().load(userId);
}

const count = async (client: SupabaseClient, table: string) => {
  const { count: n, error } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return n;
};

describe.skipIf(!live)("sync against the local Supabase (CHI-088)", () => {
  beforeEach(() => setClientForTests(null));

  test("a new user gets a profile row", async () => {
    const { id, client } = await newUser();
    const { data } = await client.from("profiles").select("id, level");
    expect(data).toEqual([{ id, level: 1 }]);
  });

  test("games rows go before review rows: a log row for a game not yet on the server is refused", async () => {
    const { id, client } = await newUser();
    const g = game(crypto.randomUUID());
    const r = review(g.id, 1);
    const early = await client.from("review_log").insert({
      id: r.id,
      user_id: id,
      game_id: g.id,
      lexicon_id: r.lexiconId,
      direction: r.direction,
      rating: r.rating,
      local_day: r.localDay,
      created_at: r.createdAt,
    });
    expect(early.error).not.toBeNull();

    // The app queues them the wrong way round, and its flush still gets it right.
    await device(id, client);
    useSyncStore.getState().enqueue([
      { kind: "review", row: r },
      { kind: "game", row: g },
    ]);
    expect(await useSyncStore.getState().flush()).toBe(true);
    expect(await count(client, "games")).toBe(1);
    expect(await count(client, "review_log")).toBe(1);
  });

  test("the guest upload is idempotent", async () => {
    const { id, client } = await newUser();
    await device(id, client);
    const g = game(crypto.randomUUID(), { result: "won", endedAt: new Date().toISOString() });
    const guest = { games: [g], reviewLog: [review(g.id, 1), review(g.id, 2), review(g.id, 3)] };
    await write("guest", guest);
    await adoptGuestData(id, true);
    expect(await useSyncStore.getState().flush()).toBe(true);
    // The same rows again (say, a retry after a lost response).
    await write("guest", guest);
    await adoptGuestData(id, true);
    expect(await useSyncStore.getState().flush()).toBe(true);
    expect(await count(client, "games")).toBe(1);
    expect(await count(client, "review_log")).toBe(3);
  });

  test("two devices converge to the same log", async () => {
    const { id, client, email, password } = await newUser();
    const other = await signedIn(email, password);

    await device(id, client);
    const gA = game(crypto.randomUUID());
    useProgressStore.getState().recordGameStart(gA);
    useProgressStore
      .getState()
      .appendRows(
        rowsFor(
          gA.id,
          [{ type: "rating", lexiconId: "n.barba", direction: "produce", rating: "again" }],
          new Date(),
        ),
      );
    await syncNow();
    const phone = useProgressStore.getState();
    const phoneRows = { games: phone.games, reviewLog: phone.reviewLog };

    await device(id, other);
    const gB = game(crypto.randomUUID());
    useProgressStore.getState().recordGameStart(gB);
    useProgressStore
      .getState()
      .appendRows(
        rowsFor(
          gB.id,
          [{ type: "rating", lexiconId: "n.occhi", direction: "recognize", rating: "hard" }],
          new Date(),
        ),
      );
    await syncNow();
    const laptop = useProgressStore.getState();
    const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

    await device(id, client);
    useProgressStore.setState({ ...phoneRows });
    await syncNow();
    expect(ids(useProgressStore.getState().reviewLog)).toEqual(ids(laptop.reviewLog));
    expect(ids(useProgressStore.getState().games)).toEqual(ids(laptop.games));
    expect(ids(laptop.games)).toEqual([gA.id, gB.id].sort());
  });

  test("an upsert with a smaller log_count is ignored", async () => {
    const { id, client } = await newUser();
    const card = (logCount: number, tag: string) => ({
      user_id: id,
      lexicon_id: "n.capelli",
      direction: "produce",
      state: { tag },
      due: new Date().toISOString(),
      log_count: logCount,
    });
    await client.from("cards").upsert(card(5, "newer"));
    await client.from("cards").upsert(card(3, "stale"));
    const { data } = await client.from("cards").select("log_count, state");
    expect(data).toEqual([{ log_count: 5, state: { tag: "newer" } }]);
  });

  test("after a sync the cards on the server match the replayed log", async () => {
    const { id, client } = await newUser();
    await device(id, client);
    const g = game(crypto.randomUUID());
    useProgressStore.getState().recordGameStart(g);
    useProgressStore.getState().appendRows(
      rowsFor(
        g.id,
        [
          { type: "rating", lexiconId: "n.barba", direction: "produce", rating: "again" },
          { type: "rating", lexiconId: "n.occhi", direction: "recognize", rating: "hard" },
        ],
        new Date(),
      ),
    );
    await syncNow();
    const { data } = await client
      .from("cards")
      .select("lexicon_id, direction, log_count")
      .order("lexicon_id");
    expect(data).toEqual([
      { lexicon_id: "n.barba", direction: "produce", log_count: 2 },
      { lexicon_id: "n.occhi", direction: "recognize", log_count: 2 },
    ]);
    expect((await pull())?.reviewLog).toHaveLength(2);
  });

  test("one user cannot read another's rows", async () => {
    const a = await newUser();
    const b = await newUser();
    await device(b.id, b.client);
    const g = game(crypto.randomUUID());
    useProgressStore.getState().recordGameStart(g);
    useProgressStore
      .getState()
      .appendRows(
        rowsFor(
          g.id,
          [{ type: "rating", lexiconId: "n.barba", direction: "produce", rating: "good" }],
          new Date(),
        ),
      );
    await syncNow();
    expect(await count(b.client, "review_log")).toBe(1);
    expect(await count(a.client, "review_log")).toBe(0);
    expect(await count(a.client, "games")).toBe(0);
  });
});
