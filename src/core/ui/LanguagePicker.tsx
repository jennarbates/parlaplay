import type { MouseEvent } from "react";
import { Link } from "react-router";
import type { LanguageCode } from "../languages.ts";
import { registry } from "../registry.ts";
import { useAuthStore } from "../store/authStore.ts";
import { useRounds } from "../store/rounds.ts";
import { useShell } from "../store/shell.ts";

// Platform spec 8.1 and 8.3: one card per language in registry order, fitting
// 360 × 560 for two languages; side by side from 1024 px, at most 480 px each.
// A card is a link, so it can open in a new tab; a plain click is a CHOOSE, which
// records the language and navigates (4.2).
export function LanguagePicker() {
  const dispatch = useShell((s) => s.dispatch);
  const saved = useRounds((r) => r.saved);
  const auth = useAuthStore();

  const choose = (code: LanguageCode) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    dispatch({ type: "CHOOSE", code });
  };

  return (
    <section className="flex flex-col gap-4 p-4 lg:p-10">
      <header className="flex items-baseline justify-between pt-2">
        <h1 className="text-3xl font-bold">Choose a language</h1>
        <Link
          to="/settings"
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm text-stone-600 underline lg:hidden"
        >
          {auth.status === "signedIn" ? auth.email : "Guest · Sign in"}
        </Link>
      </header>
      <ul className="flex flex-col gap-3 lg:flex-row lg:gap-6">
        {registry.map((l) => (
          <li key={l.code} className="lg:w-full lg:max-w-[480px]">
            <a
              href={`/${l.code}`}
              onClick={choose(l.code)}
              className="flex min-h-11 flex-col gap-1 rounded-2xl bg-white p-4 ring-1 ring-stone-200 hover:bg-stone-100"
            >
              <span lang={l.gameTitleLang} className="text-2xl font-bold">
                {l.gameTitle}
              </span>
              {l.titlePinyin && (
                <span lang="zh-Latn-pinyin" className="text-sm text-stone-600">
                  {l.titlePinyin}
                </span>
              )}
              {saved[l.code] && (
                <span className="self-start rounded-full bg-stone-900 px-3 py-1 text-sm font-semibold text-white">
                  Continue round
                </span>
              )}
              <span className="font-medium">
                {l.englishName} · {l.level}
              </span>
              <span className="text-sm text-stone-600">{l.blurb}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
