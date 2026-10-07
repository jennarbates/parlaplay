// PLAY-018: every cell of the spec 4.2 table, every 4.3 routing rule as the first
// match, and the 4.5 traced example with its variants.
import { describe, expect, test } from "vitest";
import registryJson from "../languages.json" with { type: "json" };
import type { LanguageEntry } from "../languages.ts";
import { initialShellState, reduce, routeOf } from "./reduce.ts";
import type { ShellAction, ShellState } from "./types.ts";

const registry = registryJson as LanguageEntry[];
const run = (state: ShellState, action: ShellAction) => reduce(state, action, registry);

const base: ShellState = { ...initialShellState, hydrated: true, path: "/it", language: "it", lastLanguage: "it" };
const guest = base;
const signedIn: ShellState = { ...base, account: { kind: "signedIn", userId: "u1" } };
const withP: ShellState = { ...signedIn, prompt: { kind: "saveGuest", languages: ["it", "zh"] } };
const withU: ShellState = { ...signedIn, prompt: { kind: "unsyncedSignOut" } };

const signedInAction: ShellAction = { type: "SIGNED_IN", userId: "u2", serverLast: "zh", guestLanguages: [] };
const ignored = (state: ShellState, action: ShellAction) =>
  expect(run(state, action)).toEqual({ state, effects: [] });

describe("4.2: Guest, no prompt", () => {
  test("OPEN routes", () => {
    expect(run(guest, { type: "OPEN", path: "/zh/progress" })).toEqual({
      state: { ...guest, path: "/zh/progress", language: "zh" },
      effects: [],
    });
  });

  test("CHOOSE sets language and last, writes app and navigates", () => {
    const state = { ...guest, path: "/languages", language: null };
    expect(run(state, { type: "CHOOSE", code: "zh" })).toEqual({
      state: { ...state, language: "zh", lastLanguage: "zh" },
      effects: [
        { type: "write", key: "app", value: { lastLanguage: "zh" } },
        { type: "navigate", to: "/zh", replace: false },
      ],
    });
  });

  test("CHOOSE from inside that language (starting a round) does not navigate", () => {
    const state = { ...guest, path: "/zh/play", language: "zh" as const, lastLanguage: "it" as const };
    expect(run(state, { type: "CHOOSE", code: "zh" })).toEqual({
      state: { ...state, lastLanguage: "zh" },
      effects: [{ type: "write", key: "app", value: { lastLanguage: "zh" } }],
    });
  });

  test("SIGNED_IN with no guest data: signed in, device last kept", () => {
    expect(run(guest, signedInAction)).toEqual({
      state: { ...guest, account: { kind: "signedIn", userId: "u2" } },
      effects: [],
    });
  });

  test("SIGNED_IN with no device last: the server's fills it and is written", () => {
    const state = { ...guest, path: "/languages", language: null, lastLanguage: null };
    expect(run(state, signedInAction)).toEqual({
      state: { ...state, lastLanguage: "zh", account: { kind: "signedIn", userId: "u2" } },
      effects: [{ type: "write", key: "app", value: { lastLanguage: "zh" } }],
    });
  });

  test("SIGNED_IN with guest data opens P, languages in registry order", () => {
    const { state, effects } = run(guest, { ...signedInAction, guestLanguages: ["zh", "it"] });
    expect(state.prompt).toEqual({ kind: "saveGuest", languages: ["it", "zh"] });
    expect(state.account).toEqual({ kind: "signedIn", userId: "u2" });
    expect(effects).toEqual([]);
  });

  test("SAVE_GUEST, SIGN_OUT and CONFIRM_SIGN_OUT are ignored", () => {
    ignored(guest, { type: "SAVE_GUEST", answer: "yes" });
    ignored(guest, { type: "SIGN_OUT", unsynced: false });
    ignored(guest, { type: "CONFIRM_SIGN_OUT", answer: "signOut" });
  });
});

describe("4.2: Signed in, no prompt", () => {
  test("OPEN routes", () => {
    expect(run(signedIn, { type: "OPEN", path: "/settings" }).state).toMatchObject({
      path: "/settings",
      language: null,
    });
  });

  test("CHOOSE as guest, plus writeProfile", () => {
    const state = { ...signedIn, path: "/languages", language: null };
    expect(run(state, { type: "CHOOSE", code: "zh" }).effects).toEqual([
      { type: "write", key: "app", value: { lastLanguage: "zh" } },
      { type: "writeProfile", lastLanguage: "zh" },
      { type: "navigate", to: "/zh", replace: false },
    ]);
  });

  test("SIGNED_IN and SAVE_GUEST are ignored", () => {
    ignored(signedIn, signedInAction);
    ignored(signedIn, { type: "SAVE_GUEST", answer: "no" });
    ignored(signedIn, { type: "CONFIRM_SIGN_OUT", answer: "signOut" });
  });

  test("SIGN_OUT with unsynced rows opens U", () => {
    expect(run(signedIn, { type: "SIGN_OUT", unsynced: true })).toEqual({
      state: { ...signedIn, prompt: { kind: "unsyncedSignOut" } },
      effects: [],
    });
  });

  test("SIGN_OUT with nothing queued signs out", () => {
    expect(run(signedIn, { type: "SIGN_OUT", unsynced: false })).toEqual({
      state: { ...signedIn, account: { kind: "guest" } },
      effects: [{ type: "signOut" }],
    });
  });
});

describe("4.2: P open", () => {
  test("OPEN routes and the prompt stays", () => {
    const { state } = run(withP, { type: "OPEN", path: "/zh" });
    expect(state.language).toBe("zh");
    expect(state.prompt).toEqual(withP.prompt);
  });

  test("SAVE_GUEST yes uploads and closes", () => {
    expect(run(withP, { type: "SAVE_GUEST", answer: "yes" })).toEqual({
      state: { ...withP, prompt: null },
      effects: [{ type: "uploadGuest", languages: ["it", "zh"] }],
    });
  });

  test("SAVE_GUEST no deletes and closes", () => {
    expect(run(withP, { type: "SAVE_GUEST", answer: "no" })).toEqual({
      state: { ...withP, prompt: null },
      effects: [{ type: "deleteGuest", languages: ["it", "zh"] }],
    });
  });

  test("CHOOSE, SIGNED_IN, SIGN_OUT and CONFIRM_SIGN_OUT are ignored", () => {
    ignored(withP, { type: "CHOOSE", code: "zh" });
    ignored(withP, signedInAction);
    ignored(withP, { type: "SIGN_OUT", unsynced: false });
    ignored(withP, { type: "CONFIRM_SIGN_OUT", answer: "signOut" });
  });
});

describe("4.2: U open", () => {
  test("OPEN routes and the prompt stays", () => {
    const { state } = run(withU, { type: "OPEN", path: "/privacy" });
    expect(state.language).toBeNull();
    expect(state.prompt).toEqual({ kind: "unsyncedSignOut" });
  });

  test("CONFIRM_SIGN_OUT signOut signs out", () => {
    expect(run(withU, { type: "CONFIRM_SIGN_OUT", answer: "signOut" })).toEqual({
      state: { ...withU, account: { kind: "guest" }, prompt: null },
      effects: [{ type: "signOut" }],
    });
  });

  test("CONFIRM_SIGN_OUT wait closes the prompt", () => {
    expect(run(withU, { type: "CONFIRM_SIGN_OUT", answer: "wait" })).toEqual({
      state: { ...withU, prompt: null },
      effects: [],
    });
  });

  test("CHOOSE, SIGNED_IN, SAVE_GUEST and SIGN_OUT are ignored", () => {
    ignored(withU, { type: "CHOOSE", code: "zh" });
    ignored(withU, signedInAction);
    ignored(withU, { type: "SAVE_GUEST", answer: "yes" });
    ignored(withU, { type: "SIGN_OUT", unsynced: true });
  });
});

describe("4.2: HYDRATED", () => {
  const fresh = initialShellState;

  test("accepted once: sets hydrated and last, then re-runs OPEN", () => {
    const opened = run(fresh, { type: "OPEN", path: "/" }).state;
    expect(run(opened, { type: "HYDRATED", lastLanguage: "zh" })).toEqual({
      state: { ...opened, hydrated: true, lastLanguage: "zh" },
      effects: [{ type: "navigate", to: "/zh", replace: true }],
    });
  });

  test("before any OPEN it only records", () => {
    expect(run(fresh, { type: "HYDRATED", lastLanguage: "it" })).toEqual({
      state: { ...fresh, hydrated: true, lastLanguage: "it" },
      effects: [],
    });
  });

  test("a second HYDRATED is ignored", () => {
    ignored(guest, { type: "HYDRATED", lastLanguage: "zh" });
  });

  test("accepted with a prompt open, which stays", () => {
    const state = { ...withU, hydrated: false };
    expect(run(state, { type: "HYDRATED", lastLanguage: "it" }).state.prompt).toEqual(withU.prompt);
  });

  test("a stored code that is not in the registry counts as none", () => {
    const opened = run(fresh, { type: "OPEN", path: "/" }).state;
    const stale = { type: "HYDRATED", lastLanguage: "fr" } as unknown as ShellAction;
    expect(run(opened, stale).effects).toEqual([{ type: "navigate", to: "/languages", replace: true }]);
  });
});

describe("4.3: each rule is the first match", () => {
  const unhydrated = { ...initialShellState, lastLanguage: "zh" as const };

  test("0: / before hydration waits", () => {
    expect(run(unhydrated, { type: "OPEN", path: "/" })).toEqual({
      state: { ...unhydrated, path: "/" },
      effects: [],
    });
  });

  test("1: / with a last language", () => {
    expect(run({ ...guest, lastLanguage: "zh" }, { type: "OPEN", path: "/" }).effects).toEqual([
      { type: "navigate", to: "/zh", replace: true },
    ]);
  });

  test("2: / with no last language", () => {
    expect(run({ ...guest, lastLanguage: null }, { type: "OPEN", path: "/" }).effects).toEqual([
      { type: "navigate", to: "/languages", replace: true },
    ]);
  });

  test.each(["/languages", "/settings", "/privacy", "/import", "/settings/"])("3: %s", (path) => {
    expect(run(guest, { type: "OPEN", path })).toEqual({
      state: { ...guest, path, language: null },
      effects: [],
    });
  });

  test.each(["/zh", "/zh/", "/zh/play", "/zh/progress"])("4: %s sets the language, not the default", (path) => {
    expect(run(guest, { type: "OPEN", path })).toEqual({
      state: { ...guest, path, language: "zh" },
      effects: [],
    });
  });

  test.each(["/fr", "/fr/play", "/settings/extra", "/IT", "/play"])("5: %s is not found", (path) => {
    expect(run(guest, { type: "OPEN", path })).toEqual({
      state: { ...guest, path, language: null },
      effects: [],
    });
  });

  test("routeOf names each kind", () => {
    expect(routeOf("/", registry)).toEqual({ kind: "root" });
    expect(routeOf("/import", registry)).toEqual({ kind: "page", page: "import" });
    expect(routeOf("/it/play", registry)).toEqual({ kind: "language", code: "it" });
    expect(routeOf("/fr", registry)).toEqual({ kind: "notFound" });
  });
});

describe("4.5 traced example", () => {
  // Step 1: a guest with Italian and Chinese guest data, on /zh/progress.
  const start: ShellState = {
    ...initialShellState,
    hydrated: true,
    path: "/zh/progress",
    language: "zh",
    lastLanguage: "zh",
  };
  // Steps 2 and 3.
  const signIn = run(start, { type: "SIGNED_IN", userId: "u1", serverLast: "it", guestLanguages: ["it", "zh"] });

  test("steps 2 and 3: signed in with P, device last kept over the server's", () => {
    expect(signIn).toEqual({
      state: {
        ...start,
        account: { kind: "signedIn", userId: "u1" },
        prompt: { kind: "saveGuest", languages: ["it", "zh"] },
      },
      effects: [],
    });
  });

  test("step 5: Save uploads both and closes the prompt", () => {
    expect(run(signIn.state, { type: "SAVE_GUEST", answer: "yes" })).toEqual({
      state: { ...signIn.state, prompt: null },
      effects: [{ type: "uploadGuest", languages: ["it", "zh"] }],
    });
  });

  test("variant No: deletes both", () => {
    expect(run(signIn.state, { type: "SAVE_GUEST", answer: "no" }).effects).toEqual([
      { type: "deleteGuest", languages: ["it", "zh"] },
    ]);
  });

  test("variant unknown language: /fr is not found, no effects", () => {
    expect(run(start, { type: "OPEN", path: "/fr" })).toEqual({
      state: { ...start, path: "/fr", language: null },
      effects: [],
    });
  });
});
