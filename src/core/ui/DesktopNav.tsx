import { Link, NavLink } from "react-router";
import { useAccountStore } from "../store/account.ts";
import { useAuthStore } from "../store/authStore.ts";
import { inProgress, useGameStore } from "../../languages/it/store/gameStore.ts";
import { usePrefs } from "../store/prefs.ts";

const link =
  "inline-flex min-h-11 min-w-11 items-center justify-center px-1 underline-offset-8 decoration-2 hover:underline aria-[current=page]:underline";

// Desktop spec DS 5: the top nav on every screen but Game, at lg only. Play reads
// "Continue" when a round is saved, by the same rule as Home's "Continue round".
// The current route gets aria-current="page" (from NavLink) and an underline.
export function DesktopNav() {
  const { status, game, start } = useGameStore();
  const settled = useAccountStore((a) => a.settled);
  const saved = status === "ready" && inProgress(game);
  const auth = useAuthStore();
  const level = usePrefs((p) => p.level);

  return (
    <div className="h-14 shrink-0 border-b border-stone-200 bg-white">
      <nav aria-label="Main" className="mx-auto flex h-full max-w-6xl items-center gap-8 px-6">
        <NavLink to="/" end className={`${link} text-xl font-bold`}>
          Chi è?
        </NavLink>
        <NavLink
          to={saved ? "/play" : `/play?level=${level}`}
          // With no saved round, Play starts one at the chosen level, as Home's Play does
          // (and replaces a finished round still on screen).
          onClick={() => {
            if (!saved && status === "ready" && settled) start(level);
          }}
          className={link}
        >
          {saved ? "Continue" : "Play"}
        </NavLink>
        <NavLink to="/progress" className={link}>
          Progress
        </NavLink>
        <NavLink to="/settings" className={link}>
          Settings
        </NavLink>
        {/* A plain link: Settings already marks the current page. */}
        <Link to="/settings" className={`${link} ml-auto text-sm text-stone-600`}>
          {auth.status === "signedIn" ? auth.email : "Guest · Sign in"}
        </Link>
      </nav>
    </div>
  );
}
