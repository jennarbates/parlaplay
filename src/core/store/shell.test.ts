// Platform spec 4.3 through the real store: the router's paths go in as OPEN, the
// app key as HYDRATED, and navigate and write effects come out.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { createMemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { read, resetForTests, write } from "../services/storage.ts";
import { initialShellState } from "../state/reduce.ts";
import { connectRouter, hydrateShell, useShell } from "./shell.ts";

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  useShell.setState({ state: initialShellState });
});

const settle = () => new Promise((r) => setTimeout(r, 0));

function start(path: string) {
  const router = createMemoryRouter([{ path: "*" }], { initialEntries: [path] });
  connectRouter(router);
  return router;
}

test("a first visit to / goes to the picker once the app key is read (rules 0, 2)", async () => {
  const router = start("/");
  await settle();
  expect(router.state.location.pathname).toBe("/"); // rule 0: waits
  await hydrateShell();
  await settle();
  expect(router.state.location.pathname).toBe("/languages");
});

test("a returning visit to / opens the last language (rule 1)", async () => {
  await write("app", { lastLanguage: "zh" });
  const router = start("/");
  await hydrateShell();
  await settle();
  expect(router.state.location.pathname).toBe("/zh");
  expect(useShell.getState().state.language).toBe("zh");
});

test("a damaged app key counts as no last language", async () => {
  await write("app", { lastLanguage: "fr" });
  const router = start("/");
  await hydrateShell();
  await settle();
  expect(router.state.location.pathname).toBe("/languages");
});

test("following a link does not change the default; choosing does (D14)", async () => {
  const router = start("/languages");
  await hydrateShell();
  await router.navigate("/it/progress");
  expect(useShell.getState().state).toMatchObject({ language: "it", lastLanguage: null });

  await router.navigate("/languages");
  useShell.getState().dispatch({ type: "CHOOSE", code: "zh" });
  await settle();
  await settle();
  expect(router.state.location.pathname).toBe("/zh");
  expect(await read("app")).toEqual({ lastLanguage: "zh" });
});
