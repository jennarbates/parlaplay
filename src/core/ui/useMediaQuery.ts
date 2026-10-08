import { useCallback, useSyncExternalStore } from "react";

// True while the media query matches, re-rendering when that changes. Where there
// is no matchMedia (server rendering, Vitest's node environment) it is false, so
// those get the phone layout.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => typeof window !== "undefined" && !!window.matchMedia?.(query).matches,
    () => false,
  );
}

// Desktop spec DS 5, DD1: the desktop layout starts at Tailwind's lg, 64rem
// (1024px), on width alone. CSS uses lg:; this is for swapping components.
export const desktopQuery = "(min-width: 64rem)";

export function useIsDesktop(): boolean {
  return useMediaQuery(desktopQuery);
}
