import { useEffect } from "react";
import { Outlet, useLocation, useMatches, useNavigation } from "react-router";
import type { RouteHandle } from "../language-module.ts";
import { DesktopNav } from "./DesktopNav.tsx";
import { pageTitle } from "./pageTitle.ts";
import { SaveProgressPrompt } from "./SaveProgressPrompt.tsx";
import { SyncBanner } from "./SyncBanner.tsx";
import { useIsDesktop } from "./useMediaQuery.ts";

// Screens add their own padding; the game uses the full height of the phone.
// At lg (desktop spec DS 5) the page is grey, DesktopNav runs across the top of
// every screen but the game, and each screen sits in a lighter area at the width
// its route asks for (RouteHandle). Below lg nothing changes (DD11).
export function Layout() {
  const desktop = useIsDesktop();
  const handle = (useMatches().at(-1)?.handle ?? {}) as RouteHandle;
  const game = handle.game === true;
  // The game shows the banner under its own top bar.
  const bannerOnTop = desktop && !game;
  const { pathname } = useLocation();
  const loading = useNavigation().state === "loading";

  useEffect(() => {
    document.title = pageTitle(pathname);
  }, [pathname]);

  return (
    <div className="lg:flex lg:min-h-dvh lg:flex-col lg:bg-stone-200 lg:text-stone-900">
      {loading && (
        <div
          role="progressbar"
          aria-label="Loading"
          className="loading-bar fixed inset-x-0 top-0 z-50 h-1 bg-stone-900"
        />
      )}
      {desktop && !game && <DesktopNav />}
      {bannerOnTop && <SyncBanner />}
      <main
        className={`mx-auto flex min-h-dvh max-w-md flex-col bg-stone-50 text-stone-900 lg:min-h-0 lg:w-full lg:flex-1 ${handle.width ?? "lg:max-w-5xl"}`}
      >
        {!bannerOnTop && <SyncBanner />}
        <Outlet />
        <SaveProgressPrompt />
      </main>
    </div>
  );
}
