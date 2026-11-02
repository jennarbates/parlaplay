import { expect, test } from "vitest";
import { gameEntries, gamePath, games } from "./games.ts";
import { GameId } from "./languages.ts";
import { registry } from "./registry.ts";

test("every game id has an entry", () => {
  expect(Object.keys(games).sort()).toEqual([...GameId.options].sort());
});

test("a language's first game agrees with its registry entry (3.1)", () => {
  for (const l of registry) {
    const [first] = gameEntries(l.code);
    expect(first).toMatchObject({ title: l.gameTitle, titleLang: l.gameTitleLang, blurb: l.blurb });
    expect(games[first?.id ?? "chie"].titlePinyin).toBe(l.titlePinyin);
  }
});

test("the first game is the language's Home, every other a path under it", () => {
  expect(gamePath("it", "chie")).toBe("/it");
  expect(gamePath("it", "giallo")).toBe("/it/giallo");
  expect(gamePath("zh", "shei")).toBe("/zh");
});

test("every first game is ready, since its card links to the language's Home", () => {
  for (const l of registry) expect(games[l.games[0] ?? "chie"].ready).toBe(true);
});
