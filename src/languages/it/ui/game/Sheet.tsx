import { useId, type ReactNode } from "react";

type Props = {
  summary: ReactNode; // the one line shown when collapsed (e.g. the last answer)
  open: boolean;
  onToggle: () => void;
  actions?: ReactNode; // buttons that stay in reach, open or closed
  children: ReactNode;
};

// Spec 8, D18: the question picker, tile builder or CPU question lives in a sheet
// over the board. It overlays instead of pushing, so the board never shrinks, and
// collapses to one line. Controls sit at the bottom, in thumb reach.
export function Sheet({ summary, open, onToggle, actions, children }: Props) {
  const id = useId();
  return (
    <section
      aria-label="Questions"
      className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-h-[75dvh] max-w-md flex-col rounded-t-2xl border-t border-stone-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)]"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
        className="flex min-h-12 w-full shrink-0 items-center gap-2 px-4 text-left"
      >
        <span aria-hidden="true" className="text-stone-400">
          {open ? "▾" : "▴"}
        </span>
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <span className="sr-only">{open ? "Hide" : "Show"} questions</span>
      </button>
      <div id={id} hidden={!open} className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-2">
        {children}
      </div>
      {actions && (
        <div className="flex shrink-0 gap-2 border-t border-stone-100 px-4 py-2">{actions}</div>
      )}
    </section>
  );
}
