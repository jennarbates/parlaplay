// Spec 4: the one place the shell decides where to go, what the prompts show and
// what to write. Pure: no React, DOM, network or clock (eslint and
// scripts/purity.test.ts check this).
import type { LanguageCode } from "../languages.ts";
import type {
  Registry,
  Route,
  SharedPage,
  ShellAction,
  ShellEffect,
  ShellResult,
  ShellState,
} from "./types.ts";

export const initialShellState: ShellState = {
  hydrated: false,
  path: null,
  language: null,
  lastLanguage: null,
  account: { kind: "guest" },
  prompt: null,
};

const sharedPages: readonly SharedPage[] = ["languages", "settings", "privacy", "import"];

function known(code: LanguageCode | null, registry: Registry): LanguageCode | null {
  return code !== null && registry.some((l) => l.code === code) ? code : null;
}

// 4.3: which route a path is.
export function routeOf(path: string, registry: Registry): Route {
  const segments = path.split("/").filter(Boolean);
  const [first] = segments;
  if (first === undefined) return { kind: "root" };
  if (segments.length === 1 && (sharedPages as readonly string[]).includes(first)) {
    return { kind: "page", page: first as SharedPage };
  }
  const code = registry.find((l) => l.code === first)?.code;
  return code ? { kind: "language", code } : { kind: "notFound" };
}

function open(state: ShellState, path: string, registry: Registry): ShellResult {
  const route = routeOf(path, registry);
  const next = { ...state, path };
  switch (route.kind) {
    case "language": // rule 3: following a link does not change the default
      return { state: { ...next, language: route.code }, effects: [] };
    case "root": // rule 1: the home page, whatever the last language
    case "page": // rule 2
    case "notFound": // rule 4
      return { state: { ...next, language: null }, effects: [] };
  }
}

const unchanged = (state: ShellState): ShellResult => ({ state, effects: [] });

export function reduce(state: ShellState, action: ShellAction, registry: Registry): ShellResult {
  switch (action.type) {
    case "HYDRATED": {
      if (state.hydrated) return unchanged(state);
      const next: ShellState = {
        ...state,
        hydrated: true,
        lastLanguage: known(action.lastLanguage, registry) ?? state.lastLanguage,
      };
      return next.path === null ? unchanged(next) : open(next, next.path, registry);
    }

    case "OPEN": // every state routes; an open prompt stays open
      return open(state, action.path, registry);

    case "CHOOSE": {
      if (state.prompt || !known(action.code, registry)) return unchanged(state);
      const code = action.code;
      const effects: ShellEffect[] = [{ type: "write", key: "app", value: { lastLanguage: code } }];
      if (state.account.kind === "signedIn")
        effects.push({ type: "writeProfile", lastLanguage: code });
      // Starting a round chooses the language it is already in; stay on the page.
      if (state.language !== code)
        effects.push({ type: "navigate", to: `/${code}`, replace: false });
      return { state: { ...state, language: code, lastLanguage: code }, effects };
    }

    case "SIGNED_IN": {
      if (state.account.kind !== "guest") return unchanged(state);
      const effects: ShellEffect[] = [];
      // Section 2: the device's last language wins; the server's fills an empty one.
      let lastLanguage = state.lastLanguage;
      const serverLast = known(action.serverLast, registry);
      if (lastLanguage === null && serverLast !== null) {
        lastLanguage = serverLast;
        effects.push({ type: "write", key: "app", value: { lastLanguage } });
      }
      // 3.4 invariant 7: exactly the languages with guest rows, in registry order.
      const languages = registry
        .map((l) => l.code)
        .filter((code) => action.guestLanguages.includes(code));
      const next: ShellState = {
        ...state,
        lastLanguage,
        account: { kind: "signedIn", userId: action.userId },
        prompt: languages.length ? { kind: "saveGuest", languages } : null,
      };
      return { state: next, effects };
    }

    case "SAVE_GUEST": {
      if (state.prompt?.kind !== "saveGuest") return unchanged(state);
      const { languages } = state.prompt;
      const effect: ShellEffect =
        action.answer === "yes"
          ? { type: "uploadGuest", languages }
          : { type: "deleteGuest", languages };
      return { state: { ...state, prompt: null }, effects: [effect] };
    }

    case "SIGNED_OUT": {
      // The session ended outside Settings (another tab signed out, or it expired).
      // The player confirmed nothing, so nothing on the device is cleared: no effects.
      if (state.account.kind !== "signedIn") return unchanged(state);
      return unchanged({ ...state, account: { kind: "guest" }, prompt: null });
    }

    case "SIGN_OUT": {
      if (state.account.kind !== "signedIn" || state.prompt) return unchanged(state);
      if (action.unsynced) return unchanged({ ...state, prompt: { kind: "unsyncedSignOut" } });
      return { state: { ...state, account: { kind: "guest" } }, effects: [{ type: "signOut" }] };
    }

    case "CONFIRM_SIGN_OUT": {
      if (state.prompt?.kind !== "unsyncedSignOut") return unchanged(state);
      if (action.answer === "wait") return unchanged({ ...state, prompt: null });
      return {
        state: { ...state, account: { kind: "guest" }, prompt: null },
        effects: [{ type: "signOut" }],
      };
    }
  }
}
