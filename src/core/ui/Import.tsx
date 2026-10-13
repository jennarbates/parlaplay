import { useEffect, useState } from "react";
import { Link, useNavigate, type NavigateFunction } from "react-router";
import { freshPath, importHandoff } from "../handoff/import.ts";
import { useShell } from "../store/shell.ts";

// Where Try again goes: the handoff page, which still has Chi è?'s data (5.3).
const handoffPage = import.meta.env.VITE_CHIE_URL ?? "https://chie.parlaplay.games/";

// Platform spec 5.3 step 1: read the fragment, then take it out of the address bar,
// before anything else. This file is loaded only for /import (routes.tsx), so that
// is as soon as the page knows it is an import.
function takeFragment(): string {
  if (typeof window === "undefined") return "";
  const { hash, pathname, search } = window.location;
  if (hash) window.history.replaceState(window.history.state, "", pathname + search);
  return hash;
}
const fragment = takeFragment();

// The one import of this page load, shared by every mount of the screen.
let importing: Promise<void> | undefined;

// Step 5: the Italian screen replaces /import, so Back never returns to it. Going
// there first makes Italian the open language, so choosing it (which makes / open
// Italian next time) does not navigate again.
async function finish(next: string, navigate: NavigateFunction) {
  await navigate(next, { replace: true });
  useShell.getState().dispatch({ type: "CHOOSE", code: "it" });
}

// Platform spec 8.1 and 8.2: only during a handoff. "Bringing your progress…",
// then the Italian screen, or the failure screen of 5.3 step 6.
export function Import() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    importing ??= importHandoff(fragment).then((next) => finish(next, navigate));
    let current = true;
    importing.catch(() => {
      if (current) setFailed(true);
    });
    return () => {
      current = false;
    };
  }, [navigate]);

  if (!failed) {
    return (
      <section className="flex flex-col gap-4 p-4 pt-10 lg:p-10">
        <p role="status" className="text-lg">
          Bringing your progress…
        </p>
      </section>
    );
  }

  return (
    <section role="alert" className="flex flex-col gap-4 p-4 pt-10 lg:p-10">
      <h1 className="text-2xl font-bold">We couldn&apos;t bring your progress over.</h1>
      <div className="flex flex-wrap gap-3">
        <a
          href={handoffPage}
          className="inline-flex min-h-12 items-center rounded-xl bg-stone-900 px-6 font-semibold text-white hover:bg-stone-700"
        >
          Try again
        </a>
        <Link
          to={freshPath}
          className="inline-flex min-h-12 items-center rounded-xl bg-stone-200 px-6 font-semibold hover:bg-stone-300"
        >
          Start fresh
        </Link>
      </div>
    </section>
  );
}
