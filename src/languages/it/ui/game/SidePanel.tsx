import type { ReactNode } from "react";

type Props = {
  summary: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

// Desktop spec DS 6.2, DD2, DD3: at lg the questions sit beside the board in an
// always-open panel, showing what the phone's sheet shows (sheetFor() in Game).
// Its width is fixed by the grid, so its content never resizes the board.
export function SidePanel({ summary, actions, children }: Props) {
  return (
    <aside
      aria-label="Questions"
      className="flex min-h-0 flex-col border-l border-stone-200 bg-white"
    >
      <p aria-live="polite" className="shrink-0 border-b border-stone-100 px-5 py-4 text-lg">
        {summary}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">{children}</div>
      <div className="shrink-0 border-t border-stone-100 px-5 py-3">
        {actions && <div className="mb-2 flex gap-2">{actions}</div>}
        <p className="text-sm text-stone-600">Press ? for shortcuts</p>
      </div>
    </aside>
  );
}
