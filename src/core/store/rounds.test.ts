import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, test, vi } from "vitest";
import { registry } from "../registry.ts";
import { resetForTests, write } from "../services/storage.ts";
import { useRounds } from "./rounds.ts";

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  useRounds.setState({ saved: {}, hooks: {} });
});

const version = (code: "it" | "zh") => registry.find((l) => l.code === code)?.contentVersion ?? 0;

test("a saved round counts only for its own language and content version (3.1, 3.3)", async () => {
  await write("round:it", { contentVersion: version("it"), gameId: "g", state: {} });
  await write("round:zh", { contentVersion: version("zh") + 1, gameId: "g", state: {} });
  await useRounds.getState().hydrate();
  expect(useRounds.getState().saved).toEqual({ it: true, zh: false });
});

test("a loaded language's own flag is not overwritten by the stored copy", async () => {
  useRounds.getState().register("it", { newRound() {}, clearRound() {} });
  useRounds.getState().setSaved("it", false);
  await write("round:it", { contentVersion: version("it"), gameId: "g", state: {} });
  await useRounds.getState().hydrate();
  expect(useRounds.getState().saved.it).toBe(false);
});
