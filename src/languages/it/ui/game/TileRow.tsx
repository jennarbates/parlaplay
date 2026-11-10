import { useEffect, useRef, type ReactNode } from "react";

// Desktop spec DS 8.1, shared by Chi è?'s tile builder and the giallo's (GS 9.2).
// With roving on, a row is one tab stop: the tile last focused, or the first.
// The arrow keys move along the row, without wrapping.
export function TileRow({
  label,
  roving,
  children,
}: {
  label: string;
  roving: boolean;
  children: ReactNode;
}) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tiles = [...(row.current?.querySelectorAll("button") ?? [])];
    if (!roving) {
      for (const t of tiles) t.removeAttribute("tabindex");
      return;
    }
    const current = tiles.find((t) => t.tabIndex === 0 && t.hasAttribute("tabindex")) ?? tiles[0];
    for (const t of tiles) t.tabIndex = t === current ? 0 : -1;
  }, [roving]);

  const move = (to: HTMLButtonElement | undefined) => {
    if (!to) return;
    for (const t of row.current?.querySelectorAll("button") ?? []) t.tabIndex = -1;
    to.tabIndex = 0;
    to.focus();
  };

  return (
    <div
      ref={row}
      role="group"
      aria-label={label}
      className="flex flex-wrap gap-1.5"
      onFocus={(e) => {
        if (!roving || !(e.target instanceof HTMLButtonElement)) return;
        for (const t of row.current?.querySelectorAll("button") ?? []) t.tabIndex = -1;
        e.target.tabIndex = 0;
      }}
      onKeyDown={(e) => {
        if (!roving || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        const tiles = [...(row.current?.querySelectorAll("button") ?? [])];
        const i = tiles.indexOf(e.target as HTMLButtonElement);
        if (i < 0) return;
        e.preventDefault();
        move(tiles[e.key === "ArrowLeft" ? Math.max(0, i - 1) : Math.min(tiles.length - 1, i + 1)]);
      }}
    >
      {children}
    </div>
  );
}
