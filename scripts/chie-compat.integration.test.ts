// PLAY-024: the compatibility window (platform spec 5.2, 10.2). Between migration 1
// reaching production and chie.parlaplay.games switching to the handoff page, the
// launched Chi è? app keeps syncing against the migrated schema. This runs its own
// sync code, pinned in e2e/compat/chie-launch/, against the local Supabase that CI
// starts (supabase start applies every migration). Skipped when Supabase isn't
// running, as on a laptop without Docker; in CI it must run.
import "fake-indexeddb/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { IDBFactory } from "fake-indexeddb";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { LexiconEntry } from "../e2e/compat/chie-launch/src/content/schemas.ts";
import { resetForTests } from "../e2e/compat/chie-launch/src/services/storage.ts";
import { setClientForTests } from "../e2e/compat/chie-launch/src/services/supabase.ts";
import { pull, useSyncStore } from "../e2e/compat/chie-launch/src/services/sync.ts";
import type { GameRow, ReviewLogRow } from "../e2e/compat/chie-launch/src/store/progressStore.ts";

const pinned = new URL("../e2e/compat/chie-launch/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("PINNED.json", pinned), "utf8")) as {
  commit: string;
  files: Record<string, string>;
};
// Chi è? calls pull() with its own lexicon; so does this test.
const lexicon = JSON.parse(
  readFileSync(new URL("src/content/lexicon.json", pinned), "utf8"),
) as LexiconEntry[];

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
  const email = `compat-${crypto.randomUUID()}@example.com`;
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

// Rows in Chi è?'s own shapes: they have no language.
const game = (over: Partial<GameRow> = {}): GameRow => ({
  id: crypto.randomUUID(),
  seed: 7,
  level: 1,
  contentVersion: 1,
  startedAt: new Date(Date.UTC(2026, 10, 13, 17, 0)).toISOString(),
  ...over,
});
const review = (gameId: string, lexiconId: string, minute: number): ReviewLogRow => ({
  id: crypto.randomUUID(),
  gameId,
  lexiconId,
  direction: "produce",
  rating: "good",
  localDay: "2026-11-13",
  createdAt: new Date(Date.UTC(2026, 10, 13, 17, minute)).toISOString(),
});

// A Chi è? device signed in as `userId`: a fresh IndexedDB, its client, its outbox.
async function device(userId: string, client: SupabaseClient) {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  setClientForTests(client);
  await useSyncStore.getState().load(userId);
}

// Flush as Chi è? does at round end; it reports failure instead of throwing.
async function flush() {
  expect(await useSyncStore.getState().flush()).toBe(true);
  expect(useSyncStore.getState()).toMatchObject({ outbox: [], status: "idle" });
}
async function pullOk() {
  const remote = await pull(lexicon);
  expect(useSyncStore.getState().status).not.toBe("failed");
  if (!remote) throw new Error("pull returned null");
  return remote;
}

async function rows<T>(client: SupabaseClient, table: string, columns: string, order: string) {
  const { data, error } = await client.from(table).select(columns).order(order);
  if (error) throw error;
  return data as T[];
}

test("the pinned Chi è? code is unchanged since it was pinned", () => {
  for (const [file, sha] of Object.entries(manifest.files)) {
    const bytes = readFileSync(new URL(file, pinned));
    expect(createHash("sha256").update(bytes).digest("hex"), file).toBe(sha);
  }
});

test.runIf(!!process.env.CI)("CI runs the compatibility test against Supabase", () => {
  expect(live).toBe(true);
});

describe.skipIf(!live)("Chi è? sync on the migrated schema (PLAY-024)", () => {
  beforeEach(() => setClientForTests(null));

  test("uploads games then review_log, and every row lands as it", async () => {
    const { id, client } = await newUser();
    await device(id, client);
    const g = game();
    const ended: GameRow = { ...g, result: "won", endedAt: g.startedAt };
    const barba = review(g.id, "n.barba", 1);
    const occhi = review(g.id, "n.occhi", 2);
    // Queued as the app can queue them: the log first, then the game's start and
    // its end. The flush sends games first and the newest version of each.
    const ops = [
      { kind: "review" as const, row: barba },
      { kind: "game" as const, row: g },
      { kind: "review" as const, row: occhi },
      { kind: "game" as const, row: ended },
    ];
    useSyncStore.getState().enqueue(ops);
    await flush();
    // The same rows again (say, a retry after a lost response) are fine too.
    useSyncStore.getState().enqueue(ops);
    await flush();

    expect(await rows(client, "games", "id, language, result", "id")).toEqual([
      { id: g.id, language: "it", result: "won" },
    ]);
    expect(await rows(client, "review_log", "lexicon_id, language", "lexicon_id")).toEqual([
      { lexicon_id: "n.barba", language: "it" },
      { lexicon_id: "n.occhi", language: "it" },
    ]);
  });

  test("pulls the account's rows and upserts its cards, which land as it", async () => {
    const { id, client } = await newUser();
    await device(id, client);
    const g = game({ result: "lost", endedAt: new Date().toISOString() });
    const log = [review(g.id, "n.barba", 1), review(g.id, "n.occhi", 2)];
    useSyncStore
      .getState()
      .enqueue([{ kind: "game", row: g }, ...log.map((row) => ({ kind: "review" as const, row }))]);
    await flush();

    const remote = await pullOk();
    expect(remote.games.map((x) => [x.id, x.result])).toEqual([[g.id, "lost"]]);
    expect(remote.reviewLog.map((r) => r.id).sort()).toEqual(log.map((r) => r.id).sort());

    expect(
      await rows(client, "cards", "lexicon_id, direction, language, log_count", "lexicon_id"),
    ).toEqual([
      { lexicon_id: "n.barba", direction: "produce", language: "it", log_count: 2 },
      { lexicon_id: "n.occhi", direction: "produce", language: "it", log_count: 2 },
    ]);
  });

  test("a later pull updates the same cards in place (its upsert meets the new primary key)", async () => {
    const { id, client, email, password } = await newUser();
    await device(id, client);
    const g = game();
    useSyncStore.getState().enqueue([
      { kind: "game", row: g },
      { kind: "review", row: review(g.id, "n.barba", 1) },
    ]);
    await flush();
    await pullOk();

    // A second device adds to the same card, then pulls.
    await device(id, await signedIn(email, password));
    useSyncStore.getState().enqueue([{ kind: "review", row: review(g.id, "n.barba", 5) }]);
    await flush();
    await pullOk();

    // And the first device pulls again: still one card per word and direction.
    await device(id, client);
    await pullOk();

    expect(await rows(client, "cards", "lexicon_id, language, log_count", "lexicon_id")).toEqual([
      { lexicon_id: "n.barba", language: "it", log_count: 2 },
    ]);
  });

  test("still syncs for an account that parlaplay has also written zh rows for", async () => {
    const { id, client } = await newUser();
    // parlaplay's writes, in the same launch hour: a zh game and log row.
    const zhGame = crypto.randomUUID();
    const zh = await client.from("games").insert({
      id: zhGame,
      user_id: id,
      language: "zh",
      seed: 3,
      level: 1,
      content_version: 1,
      started_at: new Date().toISOString(),
    });
    expect(zh.error).toBeNull();
    const zhLog = await client.from("review_log").insert({
      id: crypto.randomUUID(),
      user_id: id,
      language: "zh",
      game_id: zhGame,
      lexicon_id: "zh.n.test",
      direction: "recognize",
      rating: "good",
      local_day: "2026-11-13",
      created_at: new Date().toISOString(),
    });
    expect(zhLog.error).toBeNull();

    await device(id, client);
    const g = game();
    useSyncStore.getState().enqueue([
      { kind: "game", row: g },
      { kind: "review", row: review(g.id, "n.barba", 1) },
    ]);
    await flush();
    await pullOk();

    // Chi è?'s rows are it; parlaplay's zh rows are left as they were.
    expect(await rows(client, "games", "id, language", "language")).toEqual([
      { id: g.id, language: "it" },
      { id: zhGame, language: "zh" },
    ]);
  });
});
