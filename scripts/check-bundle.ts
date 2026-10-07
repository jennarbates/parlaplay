// Platform spec 9, D17: the JS each page loads, gzipped, against its budget.
//   /languages: the shell alone (Supabase client and Sentry included), under 150 KB.
//   /{code}:    the shell plus that one language's module, under 250 KB.
// A language's module is loaded with import() (core/modules.ts), so the shell must
// not load any module up front, and no module may load another.
// Reads Vite's build manifest (build.manifest in vite.config.ts).
//
//   pnpm build && pnpm check:bundle
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

export const budgetsKb = { picker: 150, language: 250 } as const;

// The parts of a Vite manifest chunk this check reads.
export type Chunk = { file: string; src?: string; isEntry?: boolean; imports?: string[] };
export type Manifest = Record<string, Chunk>;

export const moduleKey = (code: string) => `src/languages/${code}/index.ts`;

// A chunk and everything it imports statically: what loading it fetches.
export function closure(manifest: Manifest, key: string): Set<string> {
  const seen = new Set<string>();
  const visit = (k: string) => {
    if (seen.has(k)) return;
    const chunk = manifest[k];
    if (!chunk) throw new Error(`${k} is not in the build manifest`);
    seen.add(k);
    chunk.imports?.forEach(visit);
  };
  visit(key);
  return seen;
}

export type Page = { name: string; budgetKb: number; keys: Set<string> };

export function pages(manifest: Manifest, codes: readonly string[]): Page[] {
  const shell = closure(manifest, "index.html");
  return [
    { name: "/languages", budgetKb: budgetsKb.picker, keys: shell },
    ...codes.map((code) => ({
      name: `/${code}`,
      budgetKb: budgetsKb.language,
      keys: new Set([...shell, ...closure(manifest, moduleKey(code))]),
    })),
  ];
}

// The rule of D17: a page holds no language module but its own.
export function strayModules(manifest: Manifest, codes: readonly string[]): string[] {
  return pages(manifest, codes).flatMap((page) =>
    codes
      .filter((code) => page.name !== `/${code}` && page.keys.has(moduleKey(code)))
      .map((code) => `${page.name} loads the ${code} module`),
  );
}

export function gzippedKb(text: string | Buffer): number {
  return gzipSync(text, { level: 9 }).length / 1024;
}

if (import.meta.main) {
  const dist = new URL("../dist/", import.meta.url);
  const read = (path: string) => readFileSync(new URL(path, dist));
  let manifest: Manifest;
  try {
    manifest = JSON.parse(read(".vite/manifest.json").toString("utf8")) as Manifest;
  } catch {
    throw new Error("No dist/.vite/manifest.json; run pnpm build first");
  }
  const registry = JSON.parse(
    readFileSync(new URL("../src/core/languages.json", import.meta.url), "utf8"),
  ) as { code: string }[];
  const codes = registry.map((l) => l.code);

  const fileOf = (k: string) => {
    const chunk = manifest[k];
    if (!chunk) throw new Error(`${k} is not in the build manifest`);
    return chunk.file;
  };

  const problems = strayModules(manifest, codes);
  for (const page of pages(manifest, codes)) {
    const kb = [...page.keys].reduce((sum, k) => sum + gzippedKb(read(fileOf(k))), 0);
    console.log(`${kb.toFixed(1).padStart(7)} KB  ${page.name} (budget ${page.budgetKb} KB)`);
    if (kb > page.budgetKb)
      problems.push(`${page.name} is over budget by ${(kb - page.budgetKb).toFixed(1)} KB`);
  }
  if (problems.length) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
}
