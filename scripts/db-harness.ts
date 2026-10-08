// A local stand-in for Supabase's Postgres, for fast migration and RLS tests:
// PGlite (real Postgres in WebAssembly) with the parts of Supabase the
// migrations rely on: the auth schema, auth.uid(), and the anon and authenticated
// roles with Supabase's default grants. CI also applies the same migrations to a
// real local Supabase (supabase start).
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);

const supabaseShim = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  -- Supabase reads the signed-in user from the request's JWT claims.
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Supabase grants table access to both roles and relies on RLS to restrict it.
  alter default privileges in schema public grant all on tables to anon, authenticated;
`;

export const migrations = (): string[] =>
  readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

export const migrationText = (file: string) => readFileSync(new URL(file, migrationsDir), "utf8");

// Apply the migrations after `after` up to and including `through` (both file
// names; omit either for the start or the end).
export async function migrate(
  db: PGlite,
  { after, through }: { after?: string; through?: string } = {},
) {
  for (const file of migrations()) {
    if (after && file <= after) continue;
    if (through && file > through) break;
    await db.exec(migrationText(file));
  }
}

// A database with every migration applied, or only those up to `through`, so a
// test can seed data before applying the rest.
export async function freshDb({ through }: { through?: string } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(supabaseShim);
  await migrate(db, { through });
  return db;
}

// Run SQL as a signed-in user (or as anon when userId is null), inside a
// transaction so the role switch never leaks.
export async function as<T = Record<string, unknown>>(
  db: PGlite,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; affectedRows: number }> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    const result = await tx.query<T>(sql, params);
    return { rows: result.rows, affectedRows: result.affectedRows ?? 0 };
  });
}

export async function createUser(db: PGlite, id: string, email = `${id.slice(0, 8)}@example.com`) {
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
}
