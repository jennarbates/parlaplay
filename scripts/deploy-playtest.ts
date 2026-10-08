// PLAY-040: builds main against parlaplay-staging and deploys it to the playtest
// Worker (wrangler.playtest.jsonc). Needs `supabase login` and `wrangler login`.
import { spawnSync } from "node:child_process";
import { supabaseEnvFor } from "./cloudflare-env.ts";

const stagingRef = "advadzvwrdvdcjcyfpqn";

const keys = run("supabase", ["projects", "api-keys", "--project-ref", stagingRef, "-o", "json"]);
const publishable = (JSON.parse(keys) as { type: string; api_key: string }[]).find(
  (k) => k.type === "publishable",
);
if (!publishable) throw new Error("parlaplay-staging has no publishable key");

// Same checks as a Workers Builds preview: never production, never a secret key.
const env = {
  ...supabaseEnvFor("playtest", {
    STAGING_SUPABASE_URL: `https://${stagingRef}.supabase.co`,
    STAGING_SUPABASE_PUBLISHABLE_KEY: publishable.api_key,
  }),
  VITE_ENVIRONMENT: "staging",
};
console.log(`Building with staging Supabase: ${env.VITE_SUPABASE_URL}`);

run("pnpm", ["build"], env, true);
run("pnpm", ["exec", "wrangler", "deploy", "-c", "wrangler.playtest.jsonc"], {}, true);

function run(cmd: string, args: string[], extraEnv: Record<string, string> = {}, show = false) {
  const result = spawnSync(cmd, args, {
    env: { ...process.env, ...extraEnv },
    stdio: show ? "inherit" : ["inherit", "pipe", "inherit"],
    encoding: "utf8",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout ?? "";
}
