import { Kbd } from "../../../../core/ui/Kbd.tsx";
import { FindField } from "./FindField.tsx";
import { RovingRow } from "./RovingRow.tsx";
import { Word } from "./Ruby.tsx";
import { maxTray, tileEntry, tileRows as rows } from "./tiles.ts";

// The tray is held by Game, so a half-built question survives the swap between
// the phone's sheet and the desktop panel (zh-desktop.md ZS 2.2). At lg, Clear and
// Ask sit in the panel's actions instead of here (ZD5).
export function TileBuilder({
  tray,
  setTray,
  pinyin,
  onPinyin,
  onAsk,
  desktop = false,
}: {
  tray: string[];
  setTray: (update: (tray: string[]) => string[]) => void;
  pinyin: boolean;
  onPinyin: (on: boolean) => void;
  onAsk: (tokens: string[]) => void;
  desktop?: boolean;
}) {
  const add = (id: string) => setTray((t) => (t.length >= maxTray ? t : [...t, id]));
  const removeAt = (i: number) => setTray((t) => t.filter((_, j) => j !== i));

  return (
    <form
      // Tighter at lg, so one piece of feedback above it still fits 1024 × 640 (ZS 6.3).
      className={`flex flex-col ${desktop ? "gap-1.5 py-1" : "gap-2 py-2"}`}
      onSubmit={(e) => {
        e.preventDefault();
        // At lg, Ask is in the panel's actions and the find field asks for itself.
        if (!desktop) onAsk(tray);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        {desktop ? (
          // ZS 7.2: the find field and the Pinyin toggle share the top row.
          <FindField
            tray={tray}
            pinyin={pinyin}
            onAdd={(ids) => setTray((t) => [...t, ...ids].slice(0, maxTray))}
            onRemoveLast={() => setTray((t) => t.slice(0, -1))}
            onAsk={() => onAsk(tray)}
          />
        ) : (
          <p className="text-sm text-stone-600">Build a question:</p>
        )}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pinyin}
            aria-keyshortcuts="p"
            onChange={(e) => onPinyin(e.target.checked)}
            className="h-5 w-5"
          />
          Pinyin
          {desktop && <Kbd>P</Kbd>}
        </label>
      </div>

      <RovingRow
        label="Your question"
        roving={desktop}
        className="flex min-h-14 flex-wrap items-center gap-1 rounded-xl bg-white px-2 py-1 ring-1 ring-stone-300"
      >
        {tray.length === 0 && (
          <span className="text-sm text-stone-400">
            {desktop ? "Click words below, or type pinyin" : "Tap words below"}
          </span>
        )}
        {tray.map((id, i) => {
          const e = tileEntry(id);
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
      </RovingRow>

      {rows.map((row, r) => (
        <RovingRow
          key={row.label}
          label={row.label}
          roving={desktop}
          // The first row is always one line of 7 (spec 8.1); nouns wrap as needed.
          className={r === 0 ? "grid grid-cols-7 gap-0.5" : "flex flex-wrap gap-1"}
        >
          {row.tiles.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => add(e.id)}
              disabled={tray.length >= maxTray}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-stone-100 px-2 text-lg ring-1 ring-stone-300 enabled:hover:bg-stone-200 enabled:active:bg-stone-200 disabled:opacity-50"
            >
              <Word hanzi={e.hanzi} pinyin={e.pinyin} showPinyin={pinyin} />
            </button>
          ))}
        </RovingRow>
      ))}

      {!desktop && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTray(() => [])}
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
      )}
    </form>
  );
}
