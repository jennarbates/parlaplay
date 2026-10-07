import type { Character } from "../../content/schemas.ts";
import { content } from "../../content/index.ts";
import { describeCharacter } from "../describe.ts";
import { Face } from "../Face.tsx";
import { useLongPress } from "../../../../core/ui/useLongPress.ts";

type Props = {
  character: Character;
  flipped: boolean;
  onTap: () => void;
  onZoom: () => void;
  guessing: boolean;
};

// One board card. Tap flips it (or picks it, while guessing); long-press or the
// Zoom control opens the detail view. Flipped cards hide the face and show a
// cross, so the state never depends on color alone.
export function Card({ character, flipped, onTap, onZoom, guessing }: Props) {
  const press = useLongPress(onZoom);
  // Spec 9: the name and attributes in Chinese; the flipped state is aria-pressed.
  const described = describeCharacter(character, content.lexicon);
  const label = guessing ? `Guess ${described}${flipped ? " (flipped down)" : ""}` : described;

  return (
    <div className="relative" style={{ width: "var(--card-w)" }}>
      <button
        type="button"
        aria-label={label}
        lang={guessing ? undefined : "zh-Hans"}
        aria-pressed={guessing ? undefined : flipped}
        data-flipped={flipped}
        className={`group relative block aspect-[5/6] w-full select-none rounded-md outline-offset-2 [-webkit-touch-callout:none] [perspective:600px] ${
          guessing ? "animate-pulse motion-reduce:animate-none" : ""
        }`}
        {...press}
        onClick={() => {
          if (press.consumeLongPress()) return;
          onTap();
        }}
      >
        <span
          className={`absolute inset-0 transition-transform duration-300 [transform-style:preserve-3d] motion-reduce:transition-none ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          <span className="absolute inset-0 overflow-hidden rounded-md shadow-sm ring-1 ring-stone-300 [backface-visibility:hidden]">
            <Face character={character} className="h-full w-full" />
          </span>
          <span
            aria-hidden="true"
            className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-md bg-stone-300 text-stone-600 ring-1 ring-stone-400 [backface-visibility:hidden] [transform:rotateY(180deg)]"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-1/3 w-1/3"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </span>
        </span>
      </button>
      {/* Spec 3.2, 8.1: names are outside HSK 1, so pinyin is always shown with them. */}
      <p
        aria-hidden="true"
        className="flex flex-col items-center overflow-hidden leading-none whitespace-nowrap"
        style={{ height: "var(--card-cap)" }}
      >
        <span lang="zh-Hans" className="pt-0.5 text-[12px] font-medium">
          {character.name}
        </span>
        <span lang="zh-Latn-pinyin" className="text-[9px] text-stone-600">
          {character.namePinyin}
        </span>
      </p>
      <button
        type="button"
        onClick={onZoom}
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:right-0 focus:z-10 focus:flex focus:min-h-11 focus:min-w-11 focus:items-center focus:rounded focus:bg-white focus:px-1 focus:text-xs focus:shadow"
      >
        Zoom {character.name}
      </button>
    </div>
  );
}
