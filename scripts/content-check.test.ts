import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { afterEach, describe, expect, test } from "vitest";
import {
  contentCheck,
  contentDir,
  registryFile,
  validateContentDir,
  validateRegistryFile,
} from "./content-check.ts";

// Folders in these tests hold only the files under test.
const partial = { requireAll: false };
const dirs: string[] = [];
function contentFolder(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "content-"));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("validateContentDir", () => {
  test("the real content folder is valid", () => {
    expect(validateContentDir(contentDir)).toEqual([]);
  });

  test("every content file is required", () => {
    const dir = contentFolder({ "version.json": '{ "contentVersion": 1 }' });
    expect(validateContentDir(dir)).toEqual([
      "characters.json: missing",
      "lexicon.json: missing",
      "templates.json: missing",
      "messages.json: missing",
      "released-ids.json: missing",
    ]);
  });

  test("valid files pass", () => {
    const dir = contentFolder({
      "version.json": '{ "contentVersion": 1 }',
      "templates.json":
        '[{ "id": "t.have", "pattern": "Ha {art} {noun}?", "verb": "v.ha", "article": "def", "needsAdj": false, "predicate": "hasFeature" }]',
    });
    expect(validateContentDir(dir, partial)).toEqual([]);
  });

  test("names the file and the path of each problem", () => {
    const dir = contentFolder({
      "templates.json":
        '[{ "id": "t.have", "pattern": "Ha {art} {noun}?", "verb": "v.sono", "article": "def", "needsAdj": false, "predicate": "hasFeature" }]',
    });
    const problems = validateContentDir(dir, partial);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^templates\.json: 0\.verb: /);
  });

  test("broken JSON", () => {
    const dir = contentFolder({ "lexicon.json": "[{,]" });
    expect(validateContentDir(dir, partial)[0]).toMatch(/^lexicon\.json: not valid JSON/);
  });

  test("a JSON file with no schema", () => {
    const dir = contentFolder({ "characters2.json": "[]" });
    expect(validateContentDir(dir, partial)[0]).toMatch(/^characters2\.json: no schema/);
  });

  test("ignores files that are not JSON", () => {
    const dir = contentFolder({ "notes.md": "anything" });
    expect(validateContentDir(dir, partial)).toEqual([]);
  });
});

describe("validateRegistryFile", () => {
  const registry = (text: string) => join(contentFolder({ "languages.json": text }), "languages.json");
  const it = '{ "code": "it", "englishName": "Italian", "gameTitle": "Chi è?", "gameTitleLang": "it", "blurb": "b", "level": "A1" }';

  test("the real registry is valid", () => {
    expect(validateRegistryFile(registryFile)).toEqual([]);
  });

  test("an unknown code fails", () => {
    const problems = validateRegistryFile(registry(`[${it.replace('"it"', '"fr"')}]`));
    expect(problems[0]).toMatch(/^languages\.json: 0\.code: /);
  });

  test("a misspelled key fails", () => {
    const problems = validateRegistryFile(registry(`[${it.replace("blurb", "blurp")}]`));
    expect(problems.length).toBeGreaterThan(0);
  });

  test("contentVersion is not written by hand", () => {
    const problems = validateRegistryFile(registry(`[${it.replace("}", ', "contentVersion": 1 }')}]`));
    expect(problems.length).toBeGreaterThan(0);
  });

  test("a code listed twice fails", () => {
    expect(validateRegistryFile(registry(`[${it}, ${it}]`))).toEqual([
      "languages.json: each language code appears once",
    ]);
  });

  test("broken JSON", () => {
    expect(validateRegistryFile(registry("[{,]"))[0]).toMatch(/^languages\.json: not valid JSON/);
  });
});

describe("the build fails on invalid content", () => {
  test("vite build throws on an invalid registry", async () => {
    const dir = contentFolder({ "version.json": '{ "contentVersion": 1 }' });
    const registry = join(contentFolder({ "languages.json": "[]" }), "languages.json");
    await expect(
      build({
        configFile: false,
        logLevel: "silent",
        root: contentFolder({ "index.html": "<!doctype html><title>x</title>" }),
        plugins: [contentCheck(dir, partial, registry)],
        build: { write: false },
      }),
    ).rejects.toThrow(/languages\.json: /);
  });

  test("vite build throws with the problem in the message", async () => {
    const dir = contentFolder({ "version.json": '{ "contentVersion": "one" }' });
    await expect(
      build({
        configFile: false,
        logLevel: "silent",
        root: contentFolder({ "index.html": "<!doctype html><title>x</title>" }),
        plugins: [contentCheck(dir, partial)],
        build: { write: false },
      }),
    ).rejects.toThrow(/version\.json: contentVersion: /);
  });

  test("vite build passes on valid content", async () => {
    const dir = contentFolder({ "version.json": '{ "contentVersion": 1 }' });
    await expect(
      build({
        configFile: false,
        logLevel: "silent",
        root: contentFolder({ "index.html": "<!doctype html><title>x</title>" }),
        plugins: [contentCheck(dir, partial)],
        build: { write: false },
      }),
    ).resolves.toBeDefined();
  });
});
