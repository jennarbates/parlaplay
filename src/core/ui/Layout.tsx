import { Outlet, useLocation } from "react-router";
import { DesktopNav } from "./DesktopNav.tsx";
import { SaveProgressPrompt } from "./SaveProgressPrompt.tsx";
import { SyncBanner } from "./SyncBanner.tsx";
import { useIsDesktop } from "./useMediaQuery.ts";

// Desktop spec DS 5: each screen's width at lg. The game takes the whole window.
const desktopWidth: Record<string, string> = {
  "/": "lg:max-w-5xl",
  "/play": "lg:max-w-none",
  "/progress": "lg:max-w-6xl",
  "/settings": "lg:max-w-3xl",
  "/privacy": "lg:max-w-3xl",
};

// Screens add their own padding; the game uses the full height of the phone.
// At lg (desktop spec DS 5) the page is grey, DesktopNav runs across the top of
// every screen but the game, and each screen sits in a lighter area at its own
// width. Below lg nothing changes (DD11).
export function Layout() {
  const desktop = useIsDesktop();
  const { pathname } = useLocation();
  const game = pathname === "/play";
  // The game shows the banner under its own top bar.
  const bannerOnTop = desktop && !game;

  return (
    <div className="lg:flex lg:min-h-dvh lg:flex-col lg:bg-stone-200 lg:text-stone-900">
      {desktop && !game && <DesktopNav />}
      {bannerOnTop && <SyncBanner />}
      <main
        className={`mx-auto flex min-h-dvh max-w-md flex-col bg-stone-50 text-stone-900 lg:min-h-0 lg:w-full lg:flex-1 ${desktopWidth[pathname] ?? "lg:max-w-5xl"}`}
      >
        {!bannerOnTop && <SyncBanner />}
        <Outlet />
        <SaveProgressPrompt />
      </main>
    </div>
  );
}
