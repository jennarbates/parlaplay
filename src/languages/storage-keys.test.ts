// Platform spec 3.4.6: every storage key a language writes carries its own code
// (or is one of the shared keys of 3.3).
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { beforeEach, expect, test, vi } from "vitest";
import { resetForTests } from "../core/services/storage.ts";
import { progressSaved } from "../core/store/progressStore.ts";
import { useShell } from "../core/store/shell.ts";
import { initialShellState } from "../core/state/reduce.ts";
import { savesSettled as zhSaves, useGameStore as zhGame } from "./zh/store/gameStore.ts";
import { useSettings } from "./zh/store/settings.ts";
import { savesSettled as itSaves, useGameStore as itGame } from "./it/store/gameStore.ts";

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  useShell.setState({ state: { ...initialShellState, hydrated: true }, recent: null });
  const empty = () => ({
    status: "ready" as const,
    game: null,
    gameId: null,
    lastAction: null,
    lastEvents: [],
  });
  itGame.setState(empty());
  zhGame.setState(empty());
});

async function keys(): Promise<string[]> {
  await progressSaved();
  await new Promise((r) => setTimeout(r, 0)); // the shell's write effect
  const db = await openDB("parlaplay");
  return (await db.getAllKeys("kv")).map(String).sort();
}

const shared = ["app"];

test.each([
  ["zh", zhGame, zhSaves],
  ["it", itGame, itSaves],
] as const)("a %s round writes only %s keys and shared ones", async (code, game, saves) => {
  game.getState().start(1, 7);
  await saves();
  if (code === "zh") {
    useSettings.getState().setPinyin(true);
    useSettings.getState().setPronoun("pr.ta.f");
  }
  for (const key of await keys()) {
    expect(shared.includes(key) || key.endsWith(`:${code}`), key).toBe(true);
  }
  expect(await keys()).toEqual(expect.arrayContaining([`guest:${code}`, `round:${code}`, "app"]));
});
