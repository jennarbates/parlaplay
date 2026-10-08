import { Link } from "react-router";
import logo from "./logo.svg";
import logoMark from "./logo-mark.svg";

// Platform spec 8.4: the logo at the top left of every screen links to /, which
// routes by 4.3 (last language's Home, or the picker). A plain Link, never a NavLink,
// so it never carries aria-current. Drawn by scripts/logo.py.
// `compact` (the game's top bar) shows the speech bubble alone below lg, so the bar
// keeps its items on one line at 360 px.
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex min-h-11 min-w-11 shrink-0 items-center rounded">
      {compact ? (
        <>
          <img src={logoMark} alt="parlaplay home" className="h-7 w-auto lg:hidden" />
          <img
            src={logo}
            alt="parlaplay home"
            className="hidden h-7 w-auto max-w-[140px] lg:block"
          />
        </>
      ) : (
        <img src={logo} alt="parlaplay home" className="h-7 w-auto max-w-[140px]" />
      )}
    </Link>
  );
}
