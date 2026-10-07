import { useState } from "react";
import { content } from "../../content/index.ts";
import type { LexiconEntry } from "../../content/schemas.ts";
import { Word } from "./Ruby.tsx";

const entry = new Map(content.lexicon.map((e) => [e.id, e]));
const pick = (ids: string[]) => ids.flatMap((id) => entry.get(id) ?? []);

// Spec 8.1, Level 2: pronouns, verbs and 吗 in one row (7 tiles), then the 14
// nouns in three rows. Order is free (D9): the tray holds tiles as tapped.
const rows: { label: string; tiles: LexiconEntry[] }[] = [
  {
    label: "Who, verbs and 吗",
    tiles: pick(["pr.ta.m", "pr.ta.f", "pr.ni", "v.shi", "v.you", "v.zai", "pt.ma"]),
  },
  { label: "People", tiles: pick(["n.nande", "n.nvde", "n.laoshi", "n.xuesheng", "n.yisheng"]) },
  { label: "Pets and things", tiles: pick(["n.gou", "n.mao", "n.shouji", "n.shu", "n.diannao"]) },
  { label: "Places", tiles: pick(["n.jia", "n.xuexiao", "n.yiyuan", "n.fandian"]) },
];
const maxTray = 6;

export function TileBuilder({
  pinyin,
  onPinyin,
  onAsk,
}: {
  pinyin: boolean;
  onPinyin: (on: boolean) => void;
  onAsk: (tokens: string[]) => void;
}) {
  const [tray, setTray] = useState<string[]>([]);
  const add = (id: string) => setTray((t) => (t.length >= maxTray ? t : [...t, id]));
  const removeAt = (i: number) => setTray((t) => t.filter((_, j) => j !== i));

  return (
    <form
      className="flex flex-col gap-2 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        onAsk(tray);
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-600">Build a question:</p>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pinyin}
            onChange={(e) => onPinyin(e.target.checked)}
            className="h-5 w-5"
          />
          Pinyin
        </label>
      </div>

      <div
        role="group"
        aria-label="Your question"
        className="flex min-h-14 flex-wrap items-center gap-1 rounded-xl bg-white px-2 py-1 ring-1 ring-stone-300"
      >
        {tray.length === 0 && <span className="text-sm text-stone-400">Tap words below</span>}
        {tray.map((id, i) => {
          const e = entry.get(id);
          return e ? (
            <button
              key={`${i}-${id}`}
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${e.hanzi}`}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-stone-900 px-2 text-lg text-white"
            >
              <Word hanzi={e.hanzi} pinyin={e.pinyin} showPinyin={pinyin} />
            </button>
          ) : null;
        })}
      </div>

      {rows.map((row, r) => (
        <div
          key={row.label}
          role="group"
          aria-label={row.label}
          // The first row is always one line of 7 (spec 8.1); nouns wrap as needed.
          className={r === 0 ? "grid grid-cols-7 gap-0.5" : "flex flex-wrap gap-1"}
        >
          {row.tiles.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => add(e.id)}
              disabled={tray.length >= maxTray}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-stone-100 px-2 text-lg ring-1 ring-stone-300 enabled:active:bg-stone-200 disabled:opacity-50"
            >
              <Word hanzi={e.hanzi} pinyin={e.pinyin} showPinyin={pinyin} />
            </button>
          ))}
        </div>
      ))}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTray([])}
          className="min-h-12 rounded-xl bg-stone-200 font-semibold active:bg-stone-300"
        >
          Clear
        </button>
        <button
          type="submit"
          className="min-h-12 rounded-xl bg-stone-900 font-semibold text-white active:bg-stone-700"
        >
          Ask
        </button>
      </div>
    </form>
  );
}
