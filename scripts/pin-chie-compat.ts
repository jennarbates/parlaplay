// PLAY-024: pin Chi è?'s launched sync code into e2e/compat/chie-launch/ for the
// compatibility test (platform spec 5.2, 10.2). Copies src/services/sync.ts and
// every file it imports, plus the lexicon its pull is called with, byte for byte
// from a git ref of jennarbates/Italian, and records the commit and each file's
// sha256 in PINNED.json. scripts/chie-compat.integration.test.ts checks the files
// still match it, so the pinned code can't drift by hand.
//
//   git fetch italian --tags
//   node scripts/pin-chie-compat.ts chie-launch
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ref = process.argv[2];
if (!ref) {
  console.error("usage: node scripts/pin-chie-compat.ts <git ref of jennarbates/Italian>");
  process.exit(1);
}

const root = new URL("../e2e/compat/chie-launch/", import.meta.url);
const git = (...args: string[]) => execFileSync("git", args);
const commit = git("rev-parse", `${ref}^{commit}`).toString().trim();

// sync.ts and its import closure (type imports too, so the copy typechecks), and
// the lexicon the app passes to pull().
const entry = "src/services/sync.ts";
const extra = ["src/content/lexicon.json"];
const files = new Map<string, Buffer>();
const queue = [entry, ...extra];
for (let file = queue.shift(); file; file = queue.shift()) {
  if (files.has(file)) continue;
  const bytes = git("show", `${commit}:${file}`);
  files.set(file, bytes);
  if (!file.endsWith(".ts")) continue;
  for (const [, spec] of bytes
    .toString()
    .matchAll(/(?:import|export)\s[^;]*?from\s+"(\.[^"]+)"/g)) {
    if (spec) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));
  }
}

rmSync(root, { recursive: true, force: true });
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
for (const [file, bytes] of files) {
  const out = new URL(file, root);
  mkdirSync(new URL(".", out), { recursive: true });
  writeFileSync(out, bytes);
}
const manifest = {
  repo: "jennarbates/Italian",
  ref,
  commit,
  files: Object.fromEntries(
    [...files].sort(([a], [b]) => a.localeCompare(b)).map(([f, b]) => [f, sha256(b)]),
  ),
};
writeFileSync(new URL("PINNED.json", root), JSON.stringify(manifest, null, 2) + "\n");
console.log(`pinned ${files.size} files from ${ref} (${commit.slice(0, 7)})`);
