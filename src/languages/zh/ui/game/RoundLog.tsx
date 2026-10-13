import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { content } from "../../content/index.ts";
import type { LogEntry } from "./roundLog.ts";
import { Ruby } from "./Ruby.tsx";

const hanziOf = new Map(content.lexicon.map((e) => [e.id, e.hanzi]));

const title = (n: number) => (n > 0 ? `Round log (${n})` : "Round log");
export const emptyLog = "Questions you and the computer ask show up here.";

// zh-desktop.md ZS 7.3: every question and answer of the round, newest first. One
// tab stop with ↑ ↓ between entries; the focused entry shows its English when
// English is allowed (ZS 7.4).
export function LogEntries({
  entries,
  pinyin,
  english,
  className = "",
}: {
  entries: LogEntry[];
  pinyin: boolean;
  english: boolean;
  className?: string;
}) {
  // Every word is glossable (ZS 7.4), with English only when it is allowed.
  const gloss = english ? "full" : "noEnglish";
  const [active, setActive] = useState(0);
  const at = Math.min(active, Math.max(entries.length - 1, 0));
  const onKey = (e: KeyboardEvent<HTMLOListElement>) => {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    const to = at + step;
    if (!step || to < 0 || to >= entries.length) return;
    e.preventDefault();
    setActive(to);
    e.currentTarget.querySelector<HTMLElement>(`[data-log-entry="${to}"]`)?.focus();
  };
  if (entries.length === 0)
    return <p className={`px-5 py-2 text-sm text-stone-600 ${className}`}>{emptyLog}</p>;
  return (
    <ol
      aria-label="Round log"
      onKeyDown={onKey}
      className={`flex flex-col gap-1.5 overflow-y-auto overscroll-contain px-5 pb-2 text-sm ${className}`}
    >
      {entries.map((entry, i) => (
        <li
          // Newest first, so an entry's place from the end is what stays the same.
          key={entries.length - i}
          tabIndex={i === at ? 0 : -1}
          data-log-entry={i}
          onFocus={() => setActive(i)}
          className="group rounded-lg bg-white px-3 py-2 ring-1 ring-stone-200 outline-offset-2 hover:bg-stone-50"
        >
          <span className="text-xs text-stone-600">
            {entry.by === "player" ? "You asked" : "The computer asked"}
          </span>
          <p>
            <Ruby segments={entry.question.segments} pinyin={pinyin} gloss={gloss} />
          </p>
          <p className="font-medium">
            <Ruby segments={entry.answer.segments} pinyin={pinyin} gloss={gloss} />
            {entry.right === false && (
              <span className="ml-1 font-normal text-rose-700">
                (you said <span lang="zh-Hans">{hanziOf.get(entry.playerAnswerId ?? "")}</span>)
              </span>
            )}
          </p>
          {english && (
            <p className="hidden text-xs text-stone-600 group-focus:block">{entry.english}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

// The log in the side panel, under the phase area. It shows as far as the height
// left allows. With room for no more than its header, or when `closed` asks (Level
// 2 while the learner builds a question, ZD17), the header is a button that opens
// the log over the phase area instead.
export function RoundLog({
  entries,
  pinyin,
  english,
  closed,
  onOpen,
}: {
  entries: LogEntry[];
  pinyin: boolean;
  english: boolean;
  closed: boolean;
  onOpen: () => void;
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
  const headerOnly = closed || cramped;

  return (
    <div ref={slot} className="flex min-h-0 flex-1 flex-col">
      {headerOnly ? (
        <button
          type="button"
          data-log-toggle
          aria-keyshortcuts="l"
          disabled={entries.length === 0}
          onClick={onOpen}
          className="flex min-h-11 w-full shrink-0 items-center justify-between px-5 text-left text-sm font-semibold enabled:hover:bg-stone-50 disabled:text-stone-500"
        >
          {title(entries.length)}
          <span aria-hidden="true">▸</span>
        </button>
      ) : (
        <>
          <h2 className="flex min-h-11 shrink-0 items-center px-5 text-sm font-semibold">
            {title(entries.length)}
          </h2>
          <LogEntries
            entries={entries}
            pinyin={pinyin}
            english={english}
            className="min-h-0 flex-1"
          />
        </>
      )}
    </div>
  );
}

// The log opened over the phase area. Esc, l or its button closes it and gives
// focus back to the header button; while it is open it counts as a dialog for the
// game's shortcuts (ZS 9.1).
export function RoundLogOverlay({
  entries,
  pinyin,
  english,
  onClose,
}: {
  entries: LogEntry[];
  pinyin: boolean;
  english: boolean;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.querySelector<HTMLElement>('[data-log-entry][tabindex="0"]')?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.repeat || (e.key !== "Escape" && e.key.toLowerCase() !== "l")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // It closes the log and does nothing else, even while guessing.
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return (
    <div ref={root} data-log-overlay className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onClose}
        aria-expanded="true"
        className="flex min-h-11 w-full shrink-0 items-center justify-between px-5 text-left text-sm font-semibold hover:bg-stone-50"
      >
        {title(entries.length)}
        <span aria-hidden="true">▾</span>
      </button>
      <LogEntries entries={entries} pinyin={pinyin} english={english} className="min-h-0 flex-1" />
    </div>
  );
}
