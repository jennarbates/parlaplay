import { splitChinese } from "./messages.ts";

// English with Chinese in it ("没有, not 不有"): the Chinese runs get lang="zh-Hans".
export function Mixed({ text }: { text: string }) {
  return (
    <>
      {splitChinese(text).map((s, i) =>
        s.zh ? (
          <span key={i} lang="zh-Hans">
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

// A name in characters with its pinyin, as names always are (spec 3.2).
export function Name({ hanzi, pinyin }: { hanzi: string; pinyin: string }) {
  return (
    <>
      <span lang="zh-Hans">{hanzi}</span>{" "}
      <span lang="zh-Latn-pinyin" className="font-normal text-stone-600">
        {pinyin}
      </span>
    </>
  );
}
