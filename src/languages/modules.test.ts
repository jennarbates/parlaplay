// Platform spec 3.2 and 3.4.3: each language's module, as the shell loads it.
import "fake-indexeddb/auto";
import { describe, expect, test } from "vitest";
import type { LanguageModule } from "../core/language-module.ts";
import { loadModule } from "../core/modules.ts";
import { registry } from "../core/registry.ts";
import { content as itContent } from "./it/content/index.ts";
import { content as zhContent } from "./zh/content/index.ts";

const loaded: [string, LanguageModule][] = await Promise.all(
  registry.map(async (l) => [l.code, await loadModule(l.code)] as [string, LanguageModule]),
);

describe.each(loaded)("%s", (code, module) => {
  test("is the module of its own folder and content version", () => {
    expect(module.code).toBe(code);
    expect(module.contentVersion).toBe(registry.find((l) => l.code === code)?.contentVersion);
  });

  test("routes are Home, play and progress (8.1)", () => {
    expect(module.routes.map((r) => (r.index ? "" : r.path))).toEqual(["", "play", "progress"]);
    expect(module.routes.find((r) => r.path === "play")?.handle).toMatchObject({ game: true });
  });

  test("every card id has a label", () => {
    expect(module.cardIds().length).toBeGreaterThan(0);
    for (const id of module.cardIds()) expect(module.labelFor(id), id).toBeDefined();
    expect(module.labelFor("no.such.id")).toBeUndefined();
  });

  test("isResumable refuses what is not a saved round of this version", () => {
    for (const value of [null, undefined, 42, "x", {}, { contentVersion: -1, gameId: "g" }])
      expect(module.isResumable(value)).toBe(false);
  });

  test("device settings have defaults for a missing value", () => {
    expect(() => module.deviceSettings.parse({})).not.toThrow();
  });
});

test("Shéi's device settings default and repair (3.2, Shéi 7.3)", async () => {
  const zh = await loadModule("zh");
  expect(zh.deviceSettings.parse({})).toEqual({ pinyin: false, pronoun: "pr.ta.m" });
  expect(zh.deviceSettings.parse({ pinyin: "yes", pronoun: "pr.ta.f" })).toEqual({
    pinyin: false,
    pronoun: "pr.ta.f",
  });
});

test("lexicon ids of all languages are disjoint (3.4.3)", () => {
  const it = new Set(itContent.lexicon.map((e) => e.id));
  const shared = zhContent.lexicon.map((e) => e.id).filter((id) => it.has(id));
  expect(shared).toEqual([]);
});
