// PLAY-021: migration 1 (platform spec 5.2, 6.1, 6.2) on a database that already
// holds Chi è? data, and the per-language rules it adds.
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { as, createUser, freshDb, migrate, migrationText } from "./db-harness.ts";

const init = "20261019000000_init.sql";
const migration1 = "20261103000000_languages.sql";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const id = (prefix: string, n: number) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("the migration file is the SQL of spec 6.2", () => {
  const spec = readFileSync(new URL("../docs/spec.md", import.meta.url), "utf8");
  const start = spec.indexOf("**Migration 1, `supabase/migrations/20261103000000_languages.sql`**");
  const sql = spec.slice(
    spec.indexOf("```sql\n", start) + 7,
    spec.indexOf("```", spec.indexOf("```sql\n", start) + 7),
  );
  const strip = (text: string) =>
    text
      .split("\n")
      .filter((l) => !l.startsWith("--"))
      .join("\n")
      .trim();
  expect(strip(migrationText(migration1))).toBe(strip(sql));
});

describe("on a database with Chi è? data (spec 5.2)", () => {
  let db: PGlite;
  // Each PGlite holds a whole Postgres in memory; free it after every test.
  afterEach(() => db.close());
  beforeEach(async () => {
    db = await freshDb({ through: init });
    await createUser(db, A);
    await createUser(db, B);
    await db.query("update public.profiles set level = 2 where id = $1", [B]);
    for (const [user, n] of [
      [A, 1],
      [A, 2],
      [B, 3],
    ] as const) {
      await db.query(
        `insert into public.games (id, user_id, seed, level, content_version, started_at)
         values ($1, $2, 1, 1, 1, now())`,
        [id("1", n), user],
      );
      await db.query(
        `insert into public.review_log (id, user_id, game_id, lexicon_id, direction, rating, local_day, created_at)
         values ($1, $2, $3, 'n.capelli', 'produce', 'good', '2026-10-19', now())`,
        [id("2", n), user, id("1", n)],
      );
    }
    await db.query(
      `insert into public.cards (user_id, lexicon_id, direction, state, due, log_count)
       values ($1, 'n.capelli', 'produce', '{}', now(), 1)`,
      [A],
    );
  });

  const count = async (table: string, where = "true") =>
    (await db.query<{ n: number }>(`select count(*)::int as n from public.${table} where ${where}`))
      .rows[0]?.n;

  test("every old row becomes it, and no row is lost", async () => {
    const before = {
      games: await count("games"),
      log: await count("review_log"),
      cards: await count("cards"),
    };
    await migrate(db, { after: init });
    expect({
      games: await count("games"),
      log: await count("review_log"),
      cards: await count("cards"),
    }).toEqual(before);
    for (const table of ["games", "review_log", "cards"])
      expect(await count(table, "language <> 'it'"), table).toBe(0);
  });

  test("language_settings holds one it row per profile, with the profile's level", async () => {
    await migrate(db, { after: init });
    const { rows } = await db.query(
      "select user_id, language, level from public.language_settings order by user_id",
    );
    expect(rows).toEqual([
      { user_id: A, language: "it", level: 1 },
      { user_id: B, language: "it", level: 2 },
    ]);
  });

  test("the launched Chi è? app's writes still work, and land as it (compatibility window)", async () => {
    await migrate(db, { after: init });
    await as(
      db,
      A,
      `insert into public.games (id, user_id, seed, level, content_version, started_at)
       values ($1, $2, 1, 1, 1, now())`,
      [id("1", 9), A],
    );
    await as(
      db,
      A,
      `insert into public.review_log (id, user_id, game_id, lexicon_id, direction, rating, local_day, created_at)
       values ($1, $2, $3, 'n.barba', 'produce', 'good', '2026-11-13', now())`,
      [id("2", 9), A, id("1", 9)],
    );
    // Its cards upsert targets the primary key, which now includes language.
    await as(
      db,
      A,
      `insert into public.cards (user_id, lexicon_id, direction, state, due, log_count)
       values ($1, 'n.capelli', 'produce', '{"x":1}', now(), 2)
       on conflict (user_id, language, lexicon_id, direction)
       do update set state = excluded.state, log_count = excluded.log_count`,
      [A],
    );
    expect(await count("games", `id = '${id("1", 9)}' and language = 'it'`)).toBe(1);
    expect(await count("review_log", `id = '${id("2", 9)}' and language = 'it'`)).toBe(1);
    expect(await count("cards", "log_count = 2")).toBe(1);
  });
});

describe("after migration 1 (platform spec 6.1, 6.2)", () => {
  let db: PGlite;
  // Each PGlite holds a whole Postgres in memory; free it after every test.
  afterEach(() => db.close());
  beforeEach(async () => {
    db = await freshDb();
    await createUser(db, A);
    await createUser(db, B);
  });

  const game = (user: string, n: number, language: string) =>
    as(
      db,
      user,
      `insert into public.games (id, user_id, language, seed, level, content_version, started_at)
       values ($1, $2, $3, 1, 1, 1, now())`,
      [id("1", n), user, language],
    );
  const log = (user: string, n: number, gameN: number, language: string) =>
    as(
      db,
      user,
      `insert into public.review_log (id, user_id, language, game_id, lexicon_id, direction, rating, local_day, created_at)
       values ($1, $2, $3, $4, 'n.gou', 'produce', 'good', '2026-11-02', now())`,
      [id("2", n), user, language, id("1", gameN)],
    );

  test("the languages table lists it and zh (3.4.4)", async () => {
    const { rows } = await db.query("select code from public.languages order by code");
    expect(rows).toEqual([{ code: "it" }, { code: "zh" }]);
  });

  test("a review row whose game has the other language is refused (3.4.2)", async () => {
    await game(A, 1, "zh");
    await expect(log(A, 1, 1, "it")).rejects.toThrow(/row-level security/);
    await expect(log(A, 2, 1, "zh")).resolves.toBeDefined();
  });

  test("a language not in the languages table is refused", async () => {
    await expect(game(A, 1, "fr")).rejects.toThrow(/foreign key/);
  });

  test("the same word has a card per language", async () => {
    for (const language of ["it", "zh"])
      await as(
        db,
        A,
        `insert into public.cards (user_id, language, lexicon_id, direction, state, due, log_count)
         values ($1, $2, 'n.x', 'produce', '{}', now(), 1)`,
        [A, language],
      );
    const { rows } = await db.query("select language from public.cards order by language");
    expect(rows).toEqual([{ language: "it" }, { language: "zh" }]);
  });

  test("language_settings: your own rows only", async () => {
    await as(
      db,
      A,
      "insert into public.language_settings (user_id, language, level) values ($1, 'zh', 2)",
      [A],
    );
    await expect(
      as(
        db,
        A,
        "insert into public.language_settings (user_id, language, level) values ($1, 'zh', 2)",
        [B],
      ),
    ).rejects.toThrow(/row-level security/);
    expect((await as(db, B, "select * from public.language_settings")).rows).toEqual([]);
    const updated = await as(
      db,
      B,
      "update public.language_settings set level = 1 where user_id = $1",
      [A],
    );
    expect(updated.affectedRows).toBe(0);
  });

  test("a new user can set their last language", async () => {
    await as(db, A, "update public.profiles set last_language = 'zh' where id = $1", [A]);
    const { rows } = await db.query("select last_language from public.profiles where id = $1", [A]);
    expect(rows).toEqual([{ last_language: "zh" }]);
  });
});
