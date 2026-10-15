import { useState, type KeyboardEvent } from "react";
import { content } from "../../content/index.ts";
import type { LogEntry } from "./roundLog.ts";
import { Ruby } from "./Ruby.tsx";

const hanziOf = new Map(content.lexicon.map((e) => [e.id, e.hanzi]));

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
