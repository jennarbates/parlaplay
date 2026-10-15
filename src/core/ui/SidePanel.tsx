import type { ReactNode } from "react";

type Props = {
  // Above the summary: the player's own card, larger, where the screen is tall
  // enough (#131).
  top?: ReactNode;
  summary: ReactNode;
  actions?: ReactNode;
  // Shéi's round log (zh-desktop.md ZS 7.3), between the phase area and the
  // actions. It takes the height the phase area leaves; Chi è? has none.
  log?: ReactNode;
  // Keep at least 10rem for the log when the phase area may scroll (Chi è?'s
  // "What you know", #132); otherwise it gets only what the phase area leaves.
  logRoom?: boolean;
  // Drawn over the phase area and the log, between the summary and the actions:
  // the log opened from its header when there is no room to show it in place.
  overlay?: ReactNode;
  children: ReactNode;
};

// Desktop spec DS 6.2, DD2, DD3: at lg the questions sit beside the board in an
// always-open panel, showing what the phone's sheet shows (sheetFor() in Game).
// Its width is fixed by the grid, so its content never resizes the board.
export function SidePanel({ top, summary, actions, log, logRoom, overlay, children }: Props) {
  return (
    <aside
      aria-label="Questions"
      className="flex min-h-0 flex-col border-l border-stone-200 bg-white"
    >
      {/* One child with the summary, so the panel stays header, middle, actions. */}
      <div className="shrink-0">
        {top}
        <p aria-live="polite" className="border-b border-stone-100 px-5 py-4 text-lg">
          {summary}
        </p>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className={`min-h-0 overflow-y-auto overscroll-contain px-5 ${log ? "shrink" : "flex-1"}`}
        >
          {children}
        </div>
        {log && (
          <div
            className={`flex flex-1 flex-col border-t border-stone-100 ${logRoom ? "min-h-40" : "min-h-11"}`}
          >
            {log}
          </div>
        )}
        {overlay && <div className="absolute inset-0 z-10 flex flex-col bg-white">{overlay}</div>}
      </div>
      <div className="shrink-0 border-t border-stone-100 px-5 py-3">
        {actions && <div className="mb-2 flex gap-2">{actions}</div>}
        <p className="text-sm text-stone-600">Press ? for shortcuts</p>
      </div>
    </aside>
  );
}
