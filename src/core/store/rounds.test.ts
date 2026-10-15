import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, test, vi } from "vitest";
import { contentVersionOf } from "../registry.ts";
import { read, resetForTests, write } from "../services/storage.ts";
import { moveOldRounds, resetMoveForTests, roundKey, useRounds } from "./rounds.ts";

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  resetMoveForTests();
  useRounds.setState({ saved: {}, hooks: {} });
});

const round = (version = 1) => ({ contentVersion: version, gameId: "g", state: {} });

test("a saved round counts only for its own game and content version (3.1, 3.3)", async () => {
  await write("round:it:chie", round(contentVersionOf("it", "chie")));
  await write("round:zh:shei", round((contentVersionOf("zh", "shei") ?? 0) + 1));
  await useRounds.getState().hydrate();
  expect(useRounds.getState().saved).toEqual({ chie: true, giallo: false, shei: false });
});

test("a loaded game's own flag is not overwritten by the stored copy", async () => {
  useRounds.getState().register("chie", { newRound() {}, clearRound() {} });
  useRounds.getState().setSaved("chie", false);
  await write("round:it:chie", round(contentVersionOf("it", "chie")));
  await useRounds.getState().hydrate();
  expect(useRounds.getState().saved.chie).toBe(false);
});

test("each game's round has its own key (Chi è stato? GD3)", () => {
  expect(roundKey("it", "chie")).toBe("round:it:chie");
  expect(roundKey("it", "giallo")).toBe("round:it:giallo");
  expect(roundKey("zh", "shei")).toBe("round:zh:shei");
});

test("a round saved under round:{code} moves to the language's first game (GS 8)", async () => {
  await write("round:it", round(contentVersionOf("it", "chie")));
  await write("round:zh", round(contentVersionOf("zh", "shei")));
  await useRounds.getState().hydrate();
  expect(await read("round:it")).toBeUndefined();
  expect(await read("round:zh")).toBeUndefined();
  expect(await read("round:it:chie")).toEqual(round(contentVersionOf("it", "chie")));
  expect(await read("round:zh:shei")).toEqual(round(contentVersionOf("zh", "shei")));
  expect(useRounds.getState().saved).toMatchObject({ chie: true, shei: true });
});

test("a round already under the new key is kept over an old one", async () => {
  await write("round:it", { ...round(), gameId: "old" });
  await write("round:it:chie", { ...round(), gameId: "new" });
  await moveOldRounds();
  expect(await read("round:it")).toBeUndefined();
  expect(await read("round:it:chie")).toMatchObject({ gameId: "new" });
});

test("the move runs once per app start", async () => {
  await moveOldRounds();
  await write("round:it", round());
  await moveOldRounds();
  expect(await read("round:it")).toEqual(round());
});
