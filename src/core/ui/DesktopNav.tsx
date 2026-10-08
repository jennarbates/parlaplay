import { Link, NavLink, useNavigate } from "react-router";
import { firstCode, languageOf } from "../registry.ts";
import { useAccountStore } from "../store/account.ts";
import { useAuthStore } from "../store/authStore.ts";
import { useStore } from "zustand";
import { prefsStore } from "../store/prefs.ts";
import { useRounds } from "../store/rounds.ts";
import { useShell } from "../store/shell.ts";

const link =
  "inline-flex min-h-11 min-w-11 items-center justify-center px-1 underline-offset-8 decoration-2 hover:underline aria-[current=page]:underline";

// Desktop spec DS 5: the top nav on every screen but Game, at lg only. It belongs
// to the language open, or on a shared page to the one open earlier this session or
// else the last one chosen (platform spec 4.3); with none, it offers the picker. Play reads "Continue" when that
// language has a round saved, by the same rule as Home's "Continue round". The
// current route gets aria-current="page" (from NavLink) and an underline.
export function DesktopNav() {
  const code = useShell((s) => s.state.language ?? s.recent ?? s.state.lastLanguage);
  const saved = useRounds((r) => (code ? r.saved[code] === true : false));
  const settled = useAccountStore((a) => a.settled);
  const auth = useAuthStore();
  // Hooks can't be conditional: with no language yet, read the first one's level unused.
  const level = useStore(prefsStore(code ?? firstCode), (p) => p.level);
  const language = code ? languageOf(code) : null;
  const navigate = useNavigate();

  return (
    <div className="h-14 shrink-0 border-b border-stone-200 bg-white">
      <nav aria-label="Main" className="mx-auto flex h-full max-w-6xl items-center gap-8 px-6">
        {language ? (
          <>
            <NavLink to={`/${language.code}`} end className={`${link} text-xl font-bold`}>
              <span lang={language.gameTitleLang}>{language.gameTitle}</span>
            </NavLink>
            <NavLink
              to={saved ? `/${language.code}/play` : `/${language.code}/play?level=${level}`}
              // With no saved round, Play starts one at the chosen level, as Home's Play
              // does (and replaces a finished round still on screen). It goes to the game
              // first: starting a round chooses its language (platform spec 4.3), which
              // from a shared page would also navigate to that language's Home.
              onClick={(e) => {
                if (saved || !settled) return;
                e.preventDefault();
                const { code } = language;
                void Promise.resolve(navigate(`/${code}/play?level=${level}`)).then(() =>
                  useRounds.getState().hooks[code]?.newRound(level),
                );
              }}
              className={link}
            >
              {saved ? "Continue" : "Play"}
            </NavLink>
            <NavLink to={`/${language.code}/progress`} className={link}>
              Progress
            </NavLink>
          </>
        ) : (
          <NavLink to="/languages" className={`${link} text-xl font-bold`}>
            parlaplay
          </NavLink>
        )}
        <NavLink to="/settings" className={link}>
          Settings
        </NavLink>
        <NavLink to="/languages" className={link}>
          Change language
        </NavLink>
        {/* A plain link: Settings already marks the current page. */}
        <Link to="/settings" className={`${link} ml-auto text-sm text-stone-600`}>
          {auth.status === "signedIn" ? auth.email : "Guest · Sign in"}
        </Link>
      </nav>
    </div>
  );
}
