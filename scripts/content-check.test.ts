import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { afterEach, describe, expect, test } from "vitest";
import { contentCheck, contentDir, validateContentDir } from "./content-check.ts";

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
      "grammar.json: missing",
      "messages.json: missing",
      "hsk1.json: missing",
      "released-ids.json: missing",
    ]);
  });

  test("valid files pass", () => {
    const dir = contentFolder({
      "version.json": '{ "contentVersion": 1 }',
      "grammar.json":
        '[{ "id": "gp.ma", "title": "吗 questions", "explain": "Put 吗 at the end." }]',
    });
    expect(validateContentDir(dir, partial)).toEqual([]);
  });

  test("names the file and the path of each problem", () => {
    const dir = contentFolder({
      "lexicon.json":
        '[{ "id": "n.gou", "pos": "noun", "hanzi": "狗", "pinyin": "gǒu", "gloss": "dog", "hsk": ["狗"], "category": "pet", "verb": "v.shi.", "en": "a dog" }]',
    });
    const problems = validateContentDir(dir, partial);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^lexicon\.json: 0\.verb: /);
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

describe("the build fails on invalid content", () => {
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
