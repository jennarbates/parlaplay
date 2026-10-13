import { useEffect, useId, useRef, useState, type ReactNode } from "react";

const showAfter = 200; // ms the pointer rests on the word
const grace = 100; // ms to cross from the word onto the tooltip

// zh-desktop.md ZS 7.4: a tooltip for a word or a truncated line, shown when a
// mouse rests on it. It meets WCAG 1.4.13: Esc dismisses it without moving the
// pointer, the pointer can move onto it, and it stays until the pointer leaves
// both, Esc, or a click. Mouse only ((hover: hover) and (pointer: fine)); what it
// shows must be reachable another way for keyboard and touch.
export function Tooltip({
  content,
  children,
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [spot, setSpot] = useState<{ left: number; top: number }>();

  const hide = () => {
    clearTimeout(timer.current);
    setSpot(undefined);
  };
  const show = () => {
    const el = anchor.current;
    if (!el || document.querySelector("dialog[open]")) return;
    // Placed once per show: under the word, or above it near the bottom edge.
    const r = el.getBoundingClientRect();
    const below = r.bottom + 96 < window.innerHeight;
    setSpot({ left: r.left + r.width / 2, top: below ? r.bottom + 6 : r.top - 6 - 72 });
  };
  const later = (fn: () => void, ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };
  const fine = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // While it shows: Esc, any other key, a click or a dialog closes it.
  useEffect(() => {
    if (!spot) return;
    const events = ["keydown", "pointerdown", "contextmenu"] as const;
    for (const e of events) document.addEventListener(e, hide, true);
    return () => {
      for (const e of events) document.removeEventListener(e, hide, true);
    };
  }, [spot]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <span
      ref={anchor}
      aria-describedby={spot ? id : undefined}
      className={className}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse" && fine()) later(show, showAfter);
      }}
      onPointerLeave={() => later(hide, grace)}
    >
      {children}
      {spot && (
        <span
          id={id}
          role="tooltip"
          onPointerEnter={() => clearTimeout(timer.current)}
          onPointerLeave={() => later(hide, grace)}
          style={{ left: spot.left, top: spot.top }}
          className="fixed z-40 -translate-x-1/2 rounded-xl bg-white px-3 py-2 text-base font-normal whitespace-nowrap text-stone-900 shadow-xl ring-1 ring-stone-300 motion-safe:animate-[preview-in_120ms_ease-out]"
        >
          {content}
        </span>
      )}
    </span>
  );
}
