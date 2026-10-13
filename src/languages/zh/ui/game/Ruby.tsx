import { Fragment } from "react";
import type { Segment } from "../../engine/index.ts";
import { Glossable } from "./Glossable.tsx";

// Spec 3.4: Chinese with optional pinyin above each word, as HTML ruby. lang tags
// make browsers pick Chinese glyph shapes and screen readers a Chinese voice; the
// pinyin is in the accessibility tree only while it is shown (spec 9).
export function Ruby({
  segments,
  pinyin,
  className = "",
  gloss,
}: {
  segments: Segment[];
  pinyin: boolean;
  className?: string;
  // zh-desktop.md ZS 7.4: at lg, in resolved text, each word shows its gloss on
  // hover: "full" with its English, "noEnglish" while a rating is pending.
  gloss?: "full" | "noEnglish";
}) {
  return (
    <span lang="zh-Hans" className={className}>
      {segments.map((s, i) => {
        const word =
          pinyin && s.lexiconId ? (
            <ruby>
              {s.hanzi}
              <rt lang="zh-Latn-pinyin" className="text-[0.6em] font-normal text-stone-600">
                {s.pinyin}
              </rt>
            </ruby>
          ) : (
            s.hanzi
          );
        return gloss && s.lexiconId ? (
          <Glossable key={i} lexiconId={s.lexiconId} english={gloss === "full"}>
            {word}
          </Glossable>
        ) : (
          <Fragment key={i}>{word}</Fragment>
        );
      })}
    </span>
  );
}

// A single word, for tiles and buttons.
export function Word({
  hanzi,
  pinyin,
  showPinyin,
}: {
  hanzi: string;
  pinyin: string;
  showPinyin: boolean;
}) {
  return (
    <span className="flex flex-col items-center leading-tight">
      {showPinyin && (
        <span lang="zh-Latn-pinyin" className="text-[0.65em] font-normal opacity-80">
          {pinyin}
        </span>
      )}
      <span lang="zh-Hans">{hanzi}</span>
    </span>
  );
}
