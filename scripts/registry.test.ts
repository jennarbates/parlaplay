import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { RegistryFile } from "../src/core/languages.ts";
import {
  buildRegistry,
  codeOf,
  gameOf,
  knownCode,
  registry,
  versionPath,
} from "../src/core/registry.ts";

const languagesDir = new URL("../src/languages/", import.meta.url);
const coreDir = new URL("../src/core/", import.meta.url); // where versionPath is relative to
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

test("each game's contentVersion equals its version.json (3.4.8)", () => {
  for (const { code, games, contentVersions } of registry) {
    games.forEach((game, i) => {
      const file = new URL(versionPath(code, game, i === 0), coreDir);
      expect(contentVersions[game], game).toBe(
        JSON.parse(readFileSync(file, "utf8")).contentVersion,
      );
    });
  }
});

test("Italian has Chi è? first and Chi è stato? second; Chinese has Shéi (GS 8)", () => {
  expect(registry.map((l) => [l.code, l.games])).toEqual([
    ["it", ["chie", "giallo"]],
    ["zh", ["shei"]],
  ]);
});

test("a row with no game, or another language's, reads as the first game (GS 8)", () => {
  expect(gameOf("it", undefined)).toBe("chie");
  expect(gameOf("it", "giallo")).toBe("giallo");
  expect(gameOf("it", "shei")).toBe("chie");
  expect(gameOf("zh", "nonsense")).toBe("shei");
});

test("a game appears in only one language", () => {
  const entries = JSON.parse(
    readFileSync(new URL("../src/core/languages.json", import.meta.url), "utf8"),
  );
  entries[1].games = ["chie"];
  expect(RegistryFile.safeParse(entries).success).toBe(false);
});

test("a language without version.json fails loudly", () => {
  const entry = {
    code: "zh" as const,
    englishName: "Chinese",
    gameTitle: "谁？",
    gameTitleLang: "zh-Hans",
    blurb: "b",
    level: "HSK 1",
    games: ["shei" as const],
  };
  expect(() => buildRegistry([entry], {})).toThrow(
    /No content\/version.json for game "shei" of language "zh"/,
  );
});

test("codeOf reads the first segment, and only registry codes count", () => {
  expect(codeOf("/it/play")).toBe("it");
  expect(codeOf("/zh")).toBe("zh");
  expect(codeOf("/fr/play")).toBeNull();
  expect(codeOf("/settings")).toBeNull();
  expect(codeOf("/")).toBeNull();
  expect(knownCode(42)).toBeNull();
});
