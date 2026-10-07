import { beforeEach, describe, expect, test, vi } from "vitest";

// A fake Supabase profile table.
const profiles = new Map<string, { level: number }>();
let broken = false;
vi.mock("../services/supabase.ts", () => ({
  supabase: {
    from: () => ({
      update: (values: { level: number }) => ({
        eq: async (_: string, id: string) => {
          if (broken) throw new Error("offline");
          profiles.set(id, values);
          return { error: null };
        },
      }),
      select: () => ({
        eq: (_: string, id: string) => ({
          maybeSingle: async () => {
            if (broken) throw new Error("offline");
            return { data: profiles.get(id) ?? null, error: null };
          },
        }),
      }),
    }),
  },
}));
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
});
const { usePrefs } = await import("./prefs.ts");

beforeEach(() => {
  profiles.clear();
  storage.clear();
  broken = false;
  usePrefs.setState({ level: 1 });
});

describe("default level (CHI-089)", () => {
  test("saved on the device", async () => {
    await usePrefs.getState().setLevel(2);
    expect(usePrefs.getState().level).toBe(2);
    expect(storage.get("chie.level")).toBe("2");
  });

  test("signed in, also saved to the profile", async () => {
    await usePrefs.getState().setLevel(2, "u1");
    expect(profiles.get("u1")).toEqual({ level: 2 });
  });

  test("after sign-in the profile's level wins", async () => {
    profiles.set("u1", { level: 2 });
    await usePrefs.getState().loadFromProfile("u1");
    expect(usePrefs.getState().level).toBe(2);
    expect(storage.get("chie.level")).toBe("2");
  });

  test("offline, nothing throws and the device keeps its level", async () => {
    broken = true;
    await usePrefs.getState().setLevel(2, "u1");
    await usePrefs.getState().loadFromProfile("u1");
    expect(usePrefs.getState().level).toBe(2);
  });
});
