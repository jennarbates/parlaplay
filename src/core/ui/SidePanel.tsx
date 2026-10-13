import type { ReactNode } from "react";

type Props = {
  summary: ReactNode;
  actions?: ReactNode;
  // Shéi's round log (ZS 7.3), between the phase area and the actions. It takes
  // the height the phase area leaves; Chi è? has none.
  log?: ReactNode;
  children: ReactNode;
};

// Desktop spec DS 6.2, DD2, DD3: at lg the questions sit beside the board in an
// always-open panel, showing what the phone's sheet shows (sheetFor() in Game).
// Its width is fixed by the grid, so its content never resizes the board.
export function SidePanel({ summary, actions, log, children }: Props) {
  return (
    <aside
      aria-label="Questions"
      className="flex min-h-0 flex-col border-l border-stone-200 bg-white"
    >
      <p aria-live="polite" className="shrink-0 border-b border-stone-100 px-5 py-4 text-lg">
        {summary}
      </p>
      <div
        className={`min-h-0 overflow-y-auto overscroll-contain px-5 ${log ? "shrink" : "flex-1"}`}
      >
        {children}
      </div>
      {log && <div className="flex min-h-11 flex-1 flex-col border-t border-stone-100">{log}</div>}
      <div className="shrink-0 border-t border-stone-100 px-5 py-3">
        {actions && <div className="mb-2 flex gap-2">{actions}</div>}
        <p className="text-sm text-stone-600">Press ? for shortcuts</p>
      </div>
    </aside>
  );
}
