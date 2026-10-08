import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { RegistryFile } from "../src/core/languages.ts";
import { buildRegistry, codeOf, knownCode, registry } from "../src/core/registry.ts";

const languagesDir = new URL("../src/languages/", import.meta.url);
const folders = readdirSync(languagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

test("languages.json is a valid registry file (3.1)", () => {
  const file = JSON.parse(
    readFileSync(new URL("../src/core/languages.json", import.meta.url), "utf8"),
  );
  expect(RegistryFile.safeParse(file).success).toBe(true);
});

test("every registry code has a module folder, and every folder a code (3.4.5)", () => {
  expect(registry.map((l) => l.code).sort()).toEqual(folders);
  for (const code of folders) {
    expect(readdirSync(new URL(`${code}/`, languagesDir))).toContain("index.ts");
  }
});

test("each contentVersion equals the language's version.json (3.4.8)", () => {
  for (const { code, contentVersion } of registry) {
    const file = new URL(`${code}/content/version.json`, languagesDir);
    expect(contentVersion).toBe(JSON.parse(readFileSync(file, "utf8")).contentVersion);
  }
});

test("a language without version.json fails loudly", () => {
  const entry = {
    code: "zh" as const,
    englishName: "Chinese",
    gameTitle: "谁？",
    gameTitleLang: "zh-Hans",
    blurb: "b",
    level: "HSK 1",
  };
  expect(() => buildRegistry([entry], {})).toThrow(/No content\/version.json for language "zh"/);
});

test("codeOf reads the first segment, and only registry codes count", () => {
  expect(codeOf("/it/play")).toBe("it");
  expect(codeOf("/zh")).toBe("zh");
  expect(codeOf("/fr/play")).toBeNull();
  expect(codeOf("/settings")).toBeNull();
  expect(codeOf("/")).toBeNull();
  expect(knownCode(42)).toBeNull();
});
