import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Kbd } from "../../../../core/ui/Kbd.tsx";
import { findTiles, splitTiles, type Tile } from "./findTiles.ts";
import { Word } from "./Ruby.tsx";
import { builderTiles, maxTray } from "./tiles.ts";

const maxOptions = 9;
const fullMessage = "The question is full. Ask it, or remove a word.";

// zh-desktop.md ZS 7.2 (ZD7): at lg, pick tiles by typing their pinyin, or their
// characters with an IME. An editable combobox with a listbox popup (WAI-ARIA
// APG): DOM focus stays in the field and aria-activedescendant names the option.
export function FindField({
  tray,
  onAdd,
  onRemoveLast,
  onAsk,
  pinyin,
}: {
  tray: readonly string[];
  onAdd: (ids: string[]) => void;
  onRemoveLast: () => void;
  onAsk: () => void;
  pinyin: boolean; // the Pinyin toggle: options show their pinyin when it is on
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  // An IME is composing: its keys and its half-typed text are its own.
  const composing = useRef(false);

  const typed = query.trim();
  const full = tray.length >= maxTray;
  const options = findTiles(query, builderTiles).slice(0, maxOptions);
  const at = Math.min(selected, Math.max(options.length - 1, 0));
  const showList = open && typed !== "";
  // A committed run of tiles that would not fit (ZD16) is a full question too.
  const run = splitTiles(typed, builderTiles);
  const overfull = !!run && run.length > 1 && tray.length + run.length > maxTray;
  const message = !showList
    ? ""
    : full || overfull
      ? fullMessage
      : options.length === 0
        ? `No word matches “${typed}”.`
        : "";

  const clear = () => {
    setQuery("");
    setSelected(0);
    setOpen(false);
  };
  const add = (tiles: Tile[]) => {
    onAdd(tiles.map((t) => t.id));
    clear();
  };

  // ZD16: an IME commits a phrase. If it is exactly a run of tiles, add them all;
  // if they would not fit, add none and say the question is full.
  const onText = (text: string) => {
    setQuery(text);
    setSelected(0);
    setOpen(true);
    if (composing.current) return;
    const committed = splitTiles(text, builderTiles);
    if (committed && committed.length > 1 && tray.length + committed.length <= maxTray)
      add(committed);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Keys during composition belong to the IME (MDN: keydown, isComposing, 229).
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!showList) return setOpen(true);
        const n = options.length;
        if (n) setSelected((at + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
        return;
      }
      case "Enter": {
        e.preventDefault();
        // A held Enter acts once: it must not add a tile and then ask (ZS 2.2).
        if (e.repeat) return;
        const option = options[at];
        if (typed === "") {
          if (tray.length > 0) onAsk();
        } else if (showList && option && !full) add([option]);
        return;
      }
      case "Backspace":
        if (query === "" && tray.length > 0) {
          e.preventDefault();
          onRemoveLast();
        }
        return;
      case "Escape":
        e.preventDefault();
        // Esc belongs to the field while it has text; then it leaves the field.
        e.stopPropagation();
        if (query !== "") clear();
        else {
          // The first tile row; with a full tray its tiles are disabled, so the tray.
          (
            document.querySelector<HTMLElement>(
              '[role="group"][aria-label="Who, verbs and 吗"] button:enabled',
            ) ??
            document.querySelector<HTMLElement>('[role="group"][aria-label="Your question"] button')
          )?.focus();
        }
        return;
    }
  };

  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex items-center gap-2 rounded-lg bg-white px-2 ring-1 ring-stone-300 focus-within:ring-2 focus-within:ring-stone-900">
        <input
          type="text"
          role="combobox"
          aria-label="Find a word by its pinyin"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[at] ? `${id}-${options[at].id}` : undefined}
          aria-keyshortcuts="/"
          data-find-field
          lang="zh-Latn-pinyin"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Type pinyin, e.g. gou"
          value={query}
          onChange={(e) => onText(e.target.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(e) => {
            composing.current = false;
            onText(e.currentTarget.value);
          }}
          onKeyDown={onKeyDown}
          // Tab or a click elsewhere closes the list; the text stays.
          onBlur={() => setOpen(false)}
          className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-stone-400"
        />
        <Kbd>/</Kbd>
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label="Words"
        hidden={!showList || options.length === 0 || full}
        className="absolute inset-x-0 top-full z-20 mt-1 flex flex-col rounded-lg bg-white p-1 shadow-lg ring-1 ring-stone-300"
      >
        {options.map((t, i) => (
          <div
            key={t.id}
            id={`${id}-${t.id}`}
            role="option"
            aria-selected={i === at}
            // Keep focus in the field: pick on mouse down, before the blur.
            onMouseDown={(e) => {
              e.preventDefault();
              add([t]);
            }}
            className={`flex min-h-9 cursor-pointer items-center rounded px-2 text-lg ${
              i === at ? "bg-stone-900 text-white" : "hover:bg-stone-100"
            }`}
          >
            <Word hanzi={t.hanzi} pinyin={t.pinyin} showPinyin={pinyin} />
          </div>
        ))}
      </div>
      <p
        aria-live="polite"
        className={
          message
            ? "absolute inset-x-0 top-full z-20 mt-1 rounded-lg bg-white px-3 py-2 text-sm text-stone-700 shadow-lg ring-1 ring-stone-300"
            : "sr-only"
        }
      >
        {message}
      </p>
    </div>
  );
}
