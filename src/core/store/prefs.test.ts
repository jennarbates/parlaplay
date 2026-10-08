import { beforeEach, describe, expect, test, vi } from "vitest";

// A fake Supabase language_settings table, keyed "userId|language".
type Setting = { user_id: string; language: string; level: number };
const settings = new Map<string, Setting>();
let broken = false;
vi.mock("../services/supabase.ts", () => ({
  supabase: {
    from: () => ({
      upsert: async (row: Setting) => {
        if (broken) throw new Error("offline");
        settings.set(`${row.user_id}|${row.language}`, row);
        return { error: null };
      },
      select: () => ({
        eq: async (_: string, userId: string) => {
          if (broken) throw new Error("offline");
          return { data: [...settings.values()].filter((s) => s.user_id === userId), error: null };
        },
      }),
    }),
  },
}));
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
});
const { loadLevels, prefsStore } = await import("./prefs.ts");
const it = prefsStore("it");
const zh = prefsStore("zh");

beforeEach(() => {
  settings.clear();
  storage.clear();
  broken = false;
  it.setState({ level: 1 });
  zh.setState({ level: 1 });
});

describe("level, one per language (CHI-089, platform spec 2, 3.3)", () => {
  test("saved on the device under the language's own key", async () => {
    await zh.getState().setLevel(2);
    expect(zh.getState().level).toBe(2);
    expect(it.getState().level).toBe(1);
    expect(storage.get("parlaplay.level.zh")).toBe("2");
    expect(storage.has("parlaplay.level.it")).toBe(false);
  });

  test("signed in, also saved to language_settings for that language", async () => {
    await zh.getState().setLevel(2, "u1");
    expect([...settings.values()]).toEqual([
      expect.objectContaining({ user_id: "u1", language: "zh", level: 2 }),
    ]);
  });

  test("after sign-in the account's level wins, per language", async () => {
    settings.set("u1|it", { user_id: "u1", language: "it", level: 2 });
    settings.set("u1|fr", { user_id: "u1", language: "fr", level: 2 }); // unknown: ignored
    await loadLevels("u1");
    expect(it.getState().level).toBe(2);
    expect(zh.getState().level).toBe(1);
    expect(storage.get("parlaplay.level.it")).toBe("2");
  });

  test("offline, nothing throws and the device keeps its level", async () => {
    broken = true;
    await it.getState().setLevel(2, "u1");
    await loadLevels("u1");
    expect(it.getState().level).toBe(2);
  });
});
