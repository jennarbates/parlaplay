// PLAY-018, spec 4.4: every invariant, checked after every action of random sequences.
import fc from "fast-check";
import { expect, test } from "vitest";
import registryJson from "../languages.json" with { type: "json" };
import { LanguageCode, type LanguageEntry } from "../languages.ts";
import { initialShellState, reduce } from "./reduce.ts";
import type { ShellAction, ShellResult, ShellState } from "./types.ts";

const registry = registryJson as LanguageEntry[];
const codes = LanguageCode.options;

const code = fc.constantFrom(...codes);
const maybeCode = fc.option(code, { nil: null });
const path = fc.oneof(
  fc.constantFrom(
    "/",
    "/languages",
    "/settings",
    "/privacy",
    "/import",
    "/fr",
    "/fr/play",
    "/play",
  ),
  fc.tuple(code, fc.constantFrom("", "/", "/play", "/progress")).map(([c, rest]) => `/${c}${rest}`),
  fc.string().map((s) => `/${s}`),
);

const action: fc.Arbitrary<ShellAction> = fc.oneof(
  maybeCode.map((lastLanguage) => ({ type: "HYDRATED" as const, lastLanguage })),
  path.map((p) => ({ type: "OPEN" as const, path: p })),
  code.map((c) => ({ type: "CHOOSE" as const, code: c })),
  fc
    .record({
      userId: fc.constantFrom("u1", "u2"),
      serverLast: maybeCode,
      guestLanguages: fc.subarray([...codes]),
    })
    .map((a) => ({ type: "SIGNED_IN" as const, ...a })),
  fc.constantFrom("yes", "no").map((answer) => ({ type: "SAVE_GUEST" as const, answer })),
  fc.constant({ type: "SIGNED_OUT" as const }),
  fc.boolean().map((unsynced) => ({ type: "SIGN_OUT" as const, unsynced })),
  fc
    .constantFrom("signOut", "wait")
    .map((answer) => ({ type: "CONFIRM_SIGN_OUT" as const, answer })),
);

// Every navigate target is a route of 4.3 that a navigate may point at.
const targets = new Set(["/languages", ...codes.map((c) => `/${c}`)]);

function check(before: ShellState, act: ShellAction, result: ShellResult) {
  const { state, effects } = result;

  // 1. Pure: the same state and action give the same result, and the input is untouched.
  const copy = structuredClone(before);
  expect(reduce(copy, act, registry)).toEqual(result);
  expect(copy).toEqual(before);

  // 2. navigate effects only point at routes in 4.3.
  for (const e of effects) if (e.type === "navigate") expect(targets).toContain(e.to);

  // 3. A prompt is never replaced by another prompt.
  if (before.prompt && state.prompt) expect(state.prompt).toEqual(before.prompt);

  // 4. After SIGN_OUT completes, the account is guest. (Clearing user:{id}:* is
  // the signOut effect's job, tested with storage.)
  if (effects.some((e) => e.type === "signOut")) {
    expect(before.account.kind).toBe("signedIn");
    expect(state.account.kind).toBe("guest");
  }

  // 5. uploadGuest and deleteGuest list exactly the prompt's languages, which are
  // the guest languages in registry order (3.4 invariant 7).
  for (const e of effects) {
    if (e.type === "uploadGuest" || e.type === "deleteGuest") {
      expect(before.prompt).toEqual({ kind: "saveGuest", languages: e.languages });
    }
  }
  if (state.prompt?.kind === "saveGuest" && before.prompt === null) {
    const asked = act.type === "SIGNED_IN" ? act.guestLanguages : [];
    expect(state.prompt.languages).toEqual(codes.filter((c) => asked.includes(c)));
  }

  // Prompts only exist while signed in.
  if (state.prompt) expect(state.account.kind).toBe("signedIn");
  // After OPEN, the language is the path's first segment if that is a code.
  if (act.type === "OPEN") {
    const first = act.path.split("/").filter(Boolean)[0];
    expect(state.language).toBe(codes.find((c) => c === first) ?? null);
  }
}

test("4.4 invariants hold after every action", () => {
  fc.assert(
    fc.property(fc.array(action, { maxLength: 40 }), (actions) => {
      let state = initialShellState;
      for (const act of actions) {
        const result = reduce(state, act, registry);
        check(state, act, result);
        state = result.state;
      }
    }),
    { numRuns: 500 },
  );
});
