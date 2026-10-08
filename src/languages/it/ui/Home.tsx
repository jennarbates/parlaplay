import { Link, useNavigate } from "react-router";
import type { Level } from "../engine/index.ts";
import { useAccountStore } from "../../../core/store/account.ts";
import { useAuthStore } from "../../../core/store/authStore.ts";
import { inProgress, useGameStore } from "../store/gameStore.ts";
import { paths } from "../paths.ts";
import { usePrefs } from "../stores.ts";

const levels: { level: Level; title: string; detail: string }[] = [
  { level: 1, title: "Level 1", detail: "Tap ready-made questions, with English hints" },
  { level: 2, title: "Level 2", detail: "Build each question from word tiles" },
];

// Spec 8.1: Play (or Continue round when one is saved), the level picker,
// Progress, Settings and sign-in status. Desktop spec DS 9.1: two columns at lg,
// the name, pitch and round in progress on the left, the levels and Play on the
// right; the links and sign-in status are in DesktopNav there, so hidden here.
// The column wrappers are display: contents on the phone, which lays out as before.
export function Home() {
  const navigate = useNavigate();
  const { status, game, start } = useGameStore();
  const auth = useAuthStore();
  const settled = useAccountStore((a) => a.settled);
  const { level, setLevel } = usePrefs();
  const saved = status === "ready" && inProgress(game);

  const choose = (l: Level) => void setLevel(l, auth.userId);
  const newRound = () => {
    start(level); // over a saved round, this records it as abandoned
    void navigate(paths.play);
  };

  return (
    <section className="flex flex-col gap-6 p-4 lg:grid lg:flex-1 lg:grid-cols-2 lg:content-center lg:gap-12 lg:p-10">
      <div className="contents lg:flex lg:flex-col lg:gap-6">
        <header className="flex items-baseline justify-between pt-2 lg:block lg:pt-0">
          <div>
            <h1 lang="it" className="text-4xl font-bold lg:text-6xl">
              Chi è?
            </h1>
            {/* Platform spec 8.1: the English name under the title. */}
            <p className="text-sm text-stone-600 lg:mt-2 lg:text-base">Italian</p>
          </div>
          <p className="hidden text-lg text-stone-600 lg:mt-4 lg:block">
            Ask yes-or-no questions in Italian to find the secret character.
          </p>
          <p className="text-sm text-stone-600 lg:hidden">
            {auth.status === "signedIn" ? (
              <Link to="/settings" className="inline-flex min-h-11 items-center underline">
                {auth.email}
              </Link>
            ) : (
              <>
                Guest ·{" "}
                <Link
                  to="/settings"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center text-blue-700 underline"
                >
                  Sign in
                </Link>
              </>
            )}
          </p>
        </header>

        {saved && (
          <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <p className="text-sm text-stone-600">
              You have a round in progress (Level {game.level}, turn {game.turn}).
            </p>
            <Link
              to={paths.play}
              className="flex min-h-12 items-center justify-center rounded-xl bg-stone-900 font-semibold text-white"
            >
              Continue round
            </Link>
          </div>
        )}
      </div>

      <div className="contents lg:flex lg:flex-col lg:gap-6">
        <fieldset className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
          <legend className="mb-2 font-semibold">Level</legend>
          {levels.map((l) => (
            <label
              key={l.level}
              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl bg-white px-4 py-2 ring-2 hover:bg-stone-100 lg:min-h-32 lg:flex-col lg:items-start lg:p-5 ${
                level === l.level ? "ring-stone-900" : "ring-stone-200"
              }`}
            >
              <input
                type="radio"
                name="level"
                value={l.level}
                checked={level === l.level}
                onChange={() => choose(l.level)}
                className="h-5 w-5 accent-stone-900"
              />
              <span>
                <span className="block font-medium">{l.title}</span>
                <span className="block text-sm text-stone-600">{l.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          onClick={newRound}
          disabled={status !== "ready" || !settled}
          className={`min-h-12 rounded-xl font-semibold ${saved ? "bg-stone-200" : "bg-stone-900 text-white"}`}
        >
          {saved ? "New round" : "Play"}
        </button>
      </div>

      <nav className="flex flex-col gap-3 lg:hidden">
        {[
          { to: paths.progress, label: "Progress" },
          { to: "/settings", label: "Settings" },
          { to: "/languages", label: "Change language" }, // platform spec 2, 8.1
        ].map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className="flex min-h-11 items-center rounded-lg bg-white px-4 shadow-sm ring-1 ring-stone-200"
          >
            {label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
