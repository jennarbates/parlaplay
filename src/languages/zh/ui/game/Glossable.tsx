import type { ReactNode } from "react";
import { content } from "../../content/index.ts";
import { Tooltip } from "../../../../core/ui/Tooltip.tsx";

const entries = new Map(content.lexicon.map((e) => [e.id, e]));

// zh-desktop.md ZS 7.4 (ZD9): a word in resolved text that shows its characters,
// pinyin and English when the mouse rests on it. `english` is false while a rating
// is pending (gloss.ts), and then the English is left out. Mouse only; keyboard
// users get the same from the focused log entry's English line.
export function Glossable({
  lexiconId,
  english,
  children,
}: {
  lexiconId: string;
  english: boolean;
  children: ReactNode;
}) {
  const entry = entries.get(lexiconId);
  if (!entry) return <>{children}</>;
  return (
    <Tooltip
      className="cursor-help"
      content={
        <span className="flex items-baseline gap-2">
          <span lang="zh-Hans" className="text-2xl">
            {entry.hanzi}
          </span>
          <span aria-hidden="true">·</span>
          <span lang="zh-Latn-pinyin">{entry.pinyin}</span>
          {english && (
            <>
              <span aria-hidden="true">·</span>
              <span lang="en">{entry.gloss}</span>
            </>
          )}
        </span>
      }
    >
      {children}
    </Tooltip>
  );
}
