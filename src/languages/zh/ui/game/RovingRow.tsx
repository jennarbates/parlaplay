import { useEffect, useRef, type ReactNode } from "react";

// zh-desktop.md ZS 9.4: a row of tiles. With roving on (lg), the row is one tab
// stop, the tile last focused or the first that can be, and ← → move along it
// without wrapping. Off (the phone), every tile is a tab stop as before.
export function RovingRow({
  label,
  roving,
  className,
  children,
}: {
  label: string;
  roving: boolean;
  className?: string;
  children: ReactNode;
}) {
  const row = useRef<HTMLDivElement>(null);
  const buttons = () => [...(row.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];

  // After every render: exactly one enabled tile is in the tab order.
  useEffect(() => {
    const tiles = buttons();
    if (!roving) {
      for (const t of tiles) t.removeAttribute("tabindex");
      return;
    }
    const enabled = tiles.filter((t) => !t.disabled);
    const current = enabled.find((t) => t.getAttribute("tabindex") === "0") ?? enabled[0];
    for (const t of tiles) t.tabIndex = t === current ? 0 : -1;
  });

  const stopAt = (to: HTMLButtonElement) => {
    for (const t of buttons()) t.tabIndex = t === to ? 0 : -1;
  };

  return (
    <div
      ref={row}
      role="group"
      aria-label={label}
      className={className}
      onFocus={(e) => {
        if (roving && e.target instanceof HTMLButtonElement) stopAt(e.target);
      }}
      onKeyDown={(e) => {
        if (!roving || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        const enabled = buttons().filter((t) => !t.disabled);
        const i = enabled.indexOf(e.target as HTMLButtonElement);
        const to = enabled[i + (e.key === "ArrowRight" ? 1 : -1)];
        if (i < 0) return;
        e.preventDefault();
        if (to) {
          stopAt(to);
          to.focus();
        }
      }}
    >
      {children}
    </div>
  );
}
