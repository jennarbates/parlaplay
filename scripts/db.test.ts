// CHI-080 and CHI-081: the migrations and RLS policies from spec 7.1 and 7.2.
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { as, createUser, freshDb } from "./db-harness.ts";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const gameA = "10000000-0000-4000-8000-00000000000a";
const gameB = "10000000-0000-4000-8000-00000000000b";

let db: PGlite;

// Each PGlite holds a whole Postgres in memory; free it after every test.

afterEach(() => db.close());
beforeEach(async () => {
  db = await freshDb();
  await createUser(db, A);
  await createUser(db, B);
});

const insertGame = (user: string, id: string, owner = user) =>
  as(
    db,
    user,
    "insert into public.games (id, user_id, seed, level, content_version, started_at) values ($1, $2, 1, 1, 1, now())",
    [id, owner],
  );
const insertLog = (user: string, id: string, game: string | null, owner = user) =>
  as(
    db,
    user,
    `insert into public.review_log (id, user_id, game_id, lexicon_id, direction, rating, local_day, created_at)
     values ($1, $2, $3, 'n.capelli', 'produce', 'good', '2026-10-19', now())`,
    [id, owner, game],
  );
const logId = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("tables (spec 7.1, platform spec 6.1)", () => {
  test("profiles, games, review_log and cards exist with their columns", async () => {
    const { rows } = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`,
    );
    const columns = (t: string) => rows.filter((r) => r.table_name === t).map((r) => r.column_name);
    expect(columns("profiles")).toEqual([
      "id",
      "display_name",
      "level",
      "created_at",
      "last_language",
    ]);
    expect(columns("games")).toEqual([
      "id",
      "user_id",
      "seed",
      "level",
      "content_version",
      "started_at",
      "ended_at",
      "result",
      "language",
    ]);
    expect(columns("review_log")).toEqual([
      "id",
      "user_id",
      "game_id",
      "lexicon_id",
      "direction",
      "rating",
      "detail",
      "local_day",
      "created_at",
      "language",
    ]);
    expect(columns("cards")).toEqual([
      "user_id",
      "lexicon_id",
      "direction",
      "state",
      "due",
      "log_count",
      "updated_at",
      "language",
    ]);
  });

  test("a new auth user gets a profile row", async () => {
    const { rows } = await db.query("select id, level from public.profiles order by id");
    expect(rows).toEqual([
      { id: A, level: 1 },
      { id: B, level: 1 },
    ]);
  });

  test.each([
    [
      "games level",
      "insert into public.games (id, user_id, seed, level, content_version, started_at) values (gen_random_uuid(), $1, 1, 3, 1, now())",
    ],
    [
      "games result",
      "insert into public.games (id, user_id, seed, level, content_version, started_at, result) values (gen_random_uuid(), $1, 1, 1, 1, now(), 'draw')",
    ],
    [
      "review_log rating easy",
      "insert into public.review_log (id, user_id, lexicon_id, direction, rating, local_day, created_at) values (gen_random_uuid(), $1, 'n.x', 'produce', 'easy', current_date, now())",
    ],
    [
      "review_log direction",
      "insert into public.review_log (id, user_id, lexicon_id, direction, rating, local_day, created_at) values (gen_random_uuid(), $1, 'n.x', 'sideways', 'good', current_date, now())",
    ],
  ])("check constraint: %s", async (_, sql) => {
    await expect(db.query(sql, [A])).rejects.toThrow(/check constraint/);
  });

  test("a cards update with a smaller log_count is skipped", async () => {
    const card = () =>
      as<{ log_count: number; state: { v: number } }>(
        db,
        A,
        "select log_count, state from public.cards",
      );
    const set = (v: number) =>
      as(
        db,
        A,
        `update public.cards set state = '{"v":${v}}', log_count = ${v} where user_id = $1`,
        [A],
      );
    await as(
      db,
      A,
      `insert into public.cards (user_id, lexicon_id, direction, state, due, log_count) values ($1, 'n.capelli', 'produce', '{"v":5}', now(), 5)`,
      [A],
    );
    expect((await set(3)).affectedRows).toBe(0); // stale: skipped
    expect((await card()).rows).toEqual([{ log_count: 5, state: { v: 5 } }]);
    await set(5); // equal: allowed
    await set(8); // newer: allowed
    expect((await card()).rows).toEqual([{ log_count: 8, state: { v: 8 } }]);
  });

  test("deleting a user removes every row of theirs (account deletion, spec 7.3)", async () => {
    await insertGame(A, gameA);
    await insertLog(A, logId(1), gameA);
    await as(
      db,
      A,
      "insert into public.cards (user_id, lexicon_id, direction, state, due, log_count) values ($1, 'n.x', 'produce', '{}', now(), 1)",
      [A],
    );
    await insertGame(B, gameB);
    await db.query("delete from auth.users where id = $1", [A]);
    for (const t of ["profiles", "games", "review_log", "cards"]) {
      const col = t === "profiles" ? "id" : "user_id";
      const { rows } = await db.query(
        `select count(*)::int as n from public.${t} where ${col} = $1`,
        [A],
      );
      expect(rows, t).toEqual([{ n: 0 }]);
    }
    const { rows } = await db.query("select count(*)::int as n from public.games");
    expect(rows).toEqual([{ n: 1 }]); // B's game is untouched
  });
});

describe("Row Level Security (spec 7.2)", () => {
  test("RLS is enabled on every table", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname",
    );
    expect(rows).toEqual([
      { relname: "cards", relrowsecurity: true },
      { relname: "games", relrowsecurity: true },
      { relname: "language_settings", relrowsecurity: true },
      { relname: "languages", relrowsecurity: true },
      { relname: "profiles", relrowsecurity: true },
      { relname: "review_log", relrowsecurity: true },
    ]);
  });

  test("review_log has no update or delete policy", async () => {
    const { rows } = await db.query<{ cmd: string }>(
      "select cmd from pg_policies where tablename = 'review_log' order by cmd",
    );
    expect(rows.map((r) => r.cmd)).toEqual(["INSERT", "SELECT"]);
  });

  test("user A cannot read user B's review_log, games, profile or cards", async () => {
    await insertGame(B, gameB);
    await insertLog(B, logId(1), gameB);
    await as(
      db,
      B,
      "insert into public.cards (user_id, lexicon_id, direction, state, due, log_count) values ($1, 'n.x', 'produce', '{}', now(), 1)",
      [B],
    );
    for (const t of ["review_log", "games", "cards", "profiles"]) {
      expect((await as(db, A, `select * from public.${t}`)).rows, t).toEqual(
        t === "profiles" ? [expect.objectContaining({ id: A })] : [],
      );
      expect((await as(db, B, `select * from public.${t}`)).rows.length, t).toBe(1);
    }
  });

  test("anon can read and write nothing", async () => {
    await insertGame(A, gameA);
    await insertLog(A, logId(1), gameA);
    for (const t of ["profiles", "games", "review_log", "cards"]) {
      expect((await as(db, null, `select * from public.${t}`)).rows, t).toEqual([]);
    }
    await expect(
      insertGame(null as unknown as string, gameB, A).catch((e: Error) => Promise.reject(e)),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(
        db,
        null,
        "insert into public.review_log (id, user_id, lexicon_id, direction, rating, local_day, created_at) values ($1, $2, 'n.x', 'produce', 'good', current_date, now())",
        [logId(9), A],
      ),
    ).rejects.toThrow(/row-level security/);
    expect((await as(db, null, "update public.games set result = 'won'")).affectedRows).toBe(0);
    expect((await as(db, null, "delete from public.games")).affectedRows).toBe(0);
  });

  test("you can only write rows as yourself", async () => {
    await expect(insertGame(A, gameB, B)).rejects.toThrow(/row-level security/);
    await insertGame(A, gameA);
    await expect(insertLog(A, logId(1), null, B)).rejects.toThrow(/row-level security/);
  });

  test("a review row cannot point at someone else's game", async () => {
    await insertGame(B, gameB);
    await expect(insertLog(A, logId(1), gameB)).rejects.toThrow(/row-level security/);
    await insertGame(A, gameA);
    await insertLog(A, logId(2), gameA);
    await insertLog(A, logId(3), null); // no game is fine too
  });

  test("review_log is append-only: updates and deletes change nothing", async () => {
    await insertGame(A, gameA);
    await insertLog(A, logId(1), gameA);
    expect((await as(db, A, "update public.review_log set rating = 'again'")).affectedRows).toBe(0);
    expect((await as(db, A, "delete from public.review_log")).affectedRows).toBe(0);
    expect((await as(db, A, "select rating from public.review_log")).rows).toEqual([
      { rating: "good" },
    ]);
  });

  test("you can end your own game but not someone else's", async () => {
    await insertGame(A, gameA);
    await insertGame(B, gameB);
    expect(
      (
        await as(db, A, "update public.games set ended_at = now(), result = 'won' where id = $1", [
          gameA,
        ])
      ).affectedRows,
    ).toBe(1);
    expect(
      (await as(db, A, "update public.games set result = 'lost' where id = $1", [gameB]))
        .affectedRows,
    ).toBe(0);
    // And you cannot hand your game to someone else.
    await expect(
      as(db, A, "update public.games set user_id = $1 where id = $2", [B, gameA]),
    ).rejects.toThrow(/row-level security/);
  });

  test("you can update your own profile only", async () => {
    expect(
      (await as(db, A, "update public.profiles set level = 2 where id = $1", [A])).affectedRows,
    ).toBe(1);
    expect(
      (await as(db, A, "update public.profiles set level = 2 where id = $1", [B])).affectedRows,
    ).toBe(0);
  });
});
