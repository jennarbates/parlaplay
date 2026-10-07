import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { read, remove, requestPersistence, resetForTests, write } from "./storage.ts";

beforeEach(() => {
  resetForTests();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("read, write, remove", () => {
  test("round-trips structured data under a key", async () => {
    const round = { phase: "playerTurn", flipped: ["c.anna"], nested: { turn: 3 } };
    expect(await write("round:it", round)).toBe(true);
    expect(await read("round:it")).toEqual(round);
    expect(await remove("round:it")).toBe(true);
    expect(await read("round:it")).toBeUndefined();
  });

  test("guest data lives under the key guest, apart from the round", async () => {
    await write("guest", { reviewLog: [1, 2] });
    await write("round:it", { turn: 1 });
    expect(await read("guest")).toEqual({ reviewLog: [1, 2] });
    expect(await read("round:it")).toEqual({ turn: 1 });
  });

  test("survives reopening the database", async () => {
    await write("guest", { kept: true });
    resetForTests();
    expect(await read("guest")).toEqual({ kept: true });
  });
});

describe("failures never block play", () => {
  test("with IndexedDB broken, reads return undefined and writes return false", async () => {
    resetForTests();
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new Error("QuotaExceededError");
      },
    });
    await expect(read("round:it")).resolves.toBeUndefined();
    await expect(write("round:it", { a: 1 })).resolves.toBe(false);
    await expect(remove("round:it")).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  test("a value that cannot be stored is a failed write, not a crash", async () => {
    await expect(write("round:it", { f: () => 1 })).resolves.toBe(false);
  });
});

describe("requestPersistence", () => {
  test("asks the browser to persist when not already persisted", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("navigator", {
      storage: { persisted: vi.fn().mockResolvedValue(false), persist },
    });
    expect(await requestPersistence()).toBe(true);
    expect(persist).toHaveBeenCalledOnce();
  });

  test("does not ask again when already persisted", async () => {
    const persist = vi.fn();
    vi.stubGlobal("navigator", {
      storage: { persisted: vi.fn().mockResolvedValue(true), persist },
    });
    expect(await requestPersistence()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  test("returns false when the browser refuses, lacks the API, or throws", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        persisted: vi.fn().mockResolvedValue(false),
        persist: vi.fn().mockResolvedValue(false),
      },
    });
    expect(await requestPersistence()).toBe(false);
    vi.stubGlobal("navigator", {});
    expect(await requestPersistence()).toBe(false);
    vi.stubGlobal("navigator", {
      storage: { persisted: vi.fn().mockRejectedValue(new Error("nope")), persist: vi.fn() },
    });
    expect(await requestPersistence()).toBe(false);
  });
});
