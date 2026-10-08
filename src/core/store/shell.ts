// Platform spec 4: runs the shell reducer and carries out its effects. The router
// reports every navigation as OPEN; the app key's last language arrives as
// HYDRATED; a picker card or a new round dispatches CHOOSE.
import { create } from "zustand";
import type { LanguageCode } from "../languages.ts";
import { knownCode, registry } from "../registry.ts";
import { read, write } from "../services/storage.ts";
import { initialShellState, reduce } from "../state/reduce.ts";
import type { ShellAction, ShellEffect, ShellState } from "../state/types.ts";

type Navigate = (to: string, options: { replace: boolean }) => unknown;

type Shell = {
  state: ShellState;
  // The language last open in this session (not saved). Shared pages lead back to
  // it, so a player who arrived by a link returns to that game, not the picker.
  recent: LanguageCode | null;
  dispatch: (action: ShellAction) => void;
};

let navigateTo: Navigate | null = null;

function run(effect: ShellEffect) {
  switch (effect.type) {
    case "navigate":
      void navigateTo?.(effect.to, { replace: effect.replace });
      return;
    case "write":
      void write(effect.key, effect.value);
      return;
    case "writeProfile":
      // profiles.last_language comes with migration 1 (PLAY-021); writing it is
      // part of language-aware sync (PLAY-023).
      return;
    case "uploadGuest":
    case "deleteGuest":
    case "signOut":
      // Sign-in and sign-out still run through store/account.ts; they move onto
      // the shell with the combined save-guest prompt (PLAY-025).
      return;
  }
}

export const useShell = create<Shell>((set, get) => ({
  state: initialShellState,
  recent: null,
  dispatch(action) {
    const { state, effects } = reduce(get().state, action, registry);
    set({ state, recent: state.language ?? get().recent });
    // After the state is set, so a navigation sees it.
    queueMicrotask(() => effects.forEach(run));
  },
}));

type Router = {
  state: { location: { pathname: string } };
  subscribe: (listener: (state: { location: { pathname: string } }) => void) => unknown;
  navigate: Navigate;
};

// Connect the router: every new path is an OPEN, and navigate effects go to it.
export function connectRouter(router: Router) {
  navigateTo = router.navigate;
  let last = router.state.location.pathname;
  useShell.getState().dispatch({ type: "OPEN", path: last });
  router.subscribe(({ location }) => {
    if (location.pathname === last) return;
    last = location.pathname;
    useShell.getState().dispatch({ type: "OPEN", path: last });
  });
}

// Read the app key once at start (3.3): the last language chosen on this device.
export async function hydrateShell() {
  const app = await read<{ lastLanguage?: unknown }>("app");
  useShell.getState().dispatch({ type: "HYDRATED", lastLanguage: knownCode(app?.lastLanguage) });
}

// Where a shared page's Home leads: the language open this session, else the last
// one chosen, else the picker.
export function homePath({ recent, state }: Pick<Shell, "recent" | "state">): string {
  const code = recent ?? state.lastLanguage;
  return code ? `/${code}` : "/languages";
}
