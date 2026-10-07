// Spec 4: engine/ imports nothing from React, the DOM or time, and gets its
// randomness only from the seed. Platform spec 4 and 9: src/core/state/ follows
// the same rules. ESLint enforces them while editing; this test makes CI fail
// even if the lint config changes.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

type PureDir = {
  name: string;
  dir: string;
  // Which non-local imports are allowed, given the module path and the statement.
  allowed: (from: string, statement: string) => boolean;
};

const pureDirs: PureDir[] = [
  {
    name: "engine/",
    dir: new URL("../src/languages/it/engine/", import.meta.url).pathname,
    allowed: (from, statement) =>
      from.startsWith("../content/") && statement.startsWith("import type"),
  },
  {
    name: "core/state/",
    dir: new URL("../src/core/state/", import.meta.url).pathname,
    allowed: (from, statement) => from.startsWith("../") && statement.startsWith("import type"),
  },
];

describe.each(pureDirs.map((d) => [d.name, d] as const))("%s", (_, { name, dir, allowed }) => {
  const sources = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  test(`${name} has source files`, () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  describe.each(sources.map((f) => [f] as const))("%s", (file) => {
    const text = readFileSync(`${dir}${file}`, "utf8");
    const code = text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

    test("imports only local files and types", () => {
      for (const [, statement = "", from = ""] of code.matchAll(
        /^(import[^;]*?) from "([^"]+)";/gms,
      )) {
        const ok = from.startsWith("./") || allowed(from, statement);
        expect(ok, `${file}: ${from}`).toBe(true);
      }
    });

    test("uses no DOM, time or unseeded randomness", () => {
      expect(code).not.toMatch(
        /\b(window|document|localStorage|indexedDB|navigator|Date|performance|setTimeout|setInterval|fetch|crypto)\b|Math\.random/,
      );
    });
  });
});
