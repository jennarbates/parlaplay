import { Fragment } from "react";
import type { Segment } from "../../engine/index.ts";

// Spec 3.4: Chinese with optional pinyin above each word, as HTML ruby. lang tags
// make browsers pick Chinese glyph shapes and screen readers a Chinese voice; the
// pinyin is in the accessibility tree only while it is shown (spec 9).
export function Ruby({
  segments,
  pinyin,
  className = "",
}: {
  segments: Segment[];
  pinyin: boolean;
  className?: string;
}) {
  return (
    <span lang="zh-Hans" className={className}>
      {segments.map((s, i) =>
        pinyin && s.lexiconId ? (
          <ruby key={i}>
            {s.hanzi}
            <rt lang="zh-Latn-pinyin" className="text-[0.6em] font-normal text-stone-600">
              {s.pinyin}
            </rt>
          </ruby>
        ) : (
          <Fragment key={i}>{s.hanzi}</Fragment>
        ),
      )}
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
