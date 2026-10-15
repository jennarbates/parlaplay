import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type PanelTab = {
  id: string;
  title: string; // "What you know"
  count: number;
  content: ReactNode; // the list, or its empty line
  // Shown only on request, over the phase area (zh-desktop.md ZD17).
  closed?: boolean;
};

const label = (t: PanelTab) => (t.count > 0 ? `${t.title} (${t.count})` : t.title);
const headerClass =
  "flex min-h-11 shrink-0 items-center px-5 text-left text-sm font-semibold enabled:hover:bg-stone-50 disabled:text-stone-500";

// Tabs move with ← → (WAI-ARIA tabs, automatic activation).
function onTabKeys(tabs: PanelTab[], current: string, pick: (id: string) => void) {
  return (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const to = tabs[tabs.findIndex((t) => t.id === current) + step];
    if (!step || !to) return;
    e.preventDefault();
    pick(to.id);
    e.currentTarget.querySelector<HTMLElement>(`[data-tab="${to.id}"]`)?.focus();
  };
}

function Tabs({
  tabs,
  current,
  onPick,
}: {
  tabs: PanelTab[];
  current: string;
  onPick: (t: PanelTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Round so far"
      onKeyDown={onTabKeys(tabs, current, (id) => {
        const t = tabs.find((x) => x.id === id);
        if (t && !t.closed) onPick(t);
      })}
      className="flex shrink-0"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          data-tab={t.id}
          aria-selected={t.id === current}
          tabIndex={t.id === current ? 0 : -1}
          onClick={() => onPick(t)}
          className={`${headerClass} border-b-2 ${t.id === current ? "border-stone-900" : "border-transparent text-stone-600"}`}
        >
          {label(t)}
        </button>
      ))}
    </div>
  );
}

// #132, zh-desktop.md ZS 7.3: the side panel's section under the phase area. One
// tab has a heading; more have a tab list. It shows the selected tab in place as
// far as the height left allows. With room for no more than its header, a closed
// tab, or nothing to show, a tab's button opens it over the phase area instead
// (PanelTabsOverlay).
export function PanelTabs({
  tabs,
  selected,
  onSelect,
  onOpen,
}: {
  tabs: PanelTab[];
  selected: string;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [cramped, setCramped] = useState(false);
  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    // Less than the header and one short entry: nothing useful fits in place.
    const measure = () => setCramped(el.clientHeight < 44 + 72);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const shown = cramped
    ? undefined
    : (tabs.find((t) => t.id === selected && !t.closed) ?? tabs.find((t) => !t.closed));

  return (
    <div ref={slot} className="flex min-h-0 flex-1 flex-col">
      {shown ? (
        <>
          {tabs.length > 1 ? (
            <Tabs
              tabs={tabs}
              current={shown.id}
              onPick={(t) => (t.closed ? onOpen(t.id) : onSelect(t.id))}
            />
          ) : (
            <h2 className={headerClass}>{label(shown)}</h2>
          )}
          <div
            {...(tabs.length > 1 && { role: "tabpanel", "aria-label": label(shown) })}
            className="flex min-h-0 flex-1 flex-col"
          >
            {shown.content}
          </div>
        </>
      ) : (
        <div className="flex shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              data-tab={t.id}
              data-tab-toggle
              disabled={t.count === 0}
              onClick={() => onOpen(t.id)}
              className={`${headerClass} ${tabs.length > 1 ? "" : "w-full justify-between"}`}
            >
              {label(t)}
              <span aria-hidden="true" className="ml-1.5">
                ▸
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The section opened over the phase area. Esc, `closeKey` or its close button
// closes it, and the caller gives focus back to the tab that opened it; while it is
// open it counts as a dialog for the game's shortcuts (ZS 9.1).
export function PanelTabsOverlay({
  tabs,
  selected,
  onSelect,
  onClose,
  closeKey,
}: {
  tabs: PanelTab[];
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  closeKey?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  // Over the phase area every tab may show, closed ones too: that is the request.
  const open = tabs.map((t) => ({ ...t, closed: false }));
  const shown = open.find((t) => t.id === selected) ?? open[0];
  // On opening: into the list when it has a tab stop (the round log), else onto
  // the header.
  useEffect(() => {
    const r = root.current;
    (
      r?.querySelector<HTMLElement>(
        '[role="tabpanel"] [tabindex="0"], [data-log-entry][tabindex="0"]',
      ) ?? r?.querySelector<HTMLElement>("button")
    )?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.repeat || (e.key !== "Escape" && e.key.toLowerCase() !== closeKey)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // It closes the section and does nothing else, even while guessing.
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, closeKey]);
  if (!shown) return null;
  return (
    <div ref={root} data-panel-overlay className="flex min-h-0 flex-1 flex-col">
      {tabs.length > 1 ? (
        <div className="flex shrink-0 items-stretch justify-between">
          <Tabs tabs={open} current={shown.id} onPick={(t) => onSelect(t.id)} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-11 min-w-11 items-center justify-center hover:bg-stone-50"
          >
            <span aria-hidden="true">▾</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onClose}
          aria-expanded="true"
          className={`${headerClass} w-full justify-between`}
        >
          {label(shown)}
          <span aria-hidden="true">▾</span>
        </button>
      )}
      <div
        {...(tabs.length > 1 && { role: "tabpanel", "aria-label": label(shown) })}
        className="flex min-h-0 flex-1 flex-col"
      >
        {shown.content}
      </div>
    </div>
  );
}
