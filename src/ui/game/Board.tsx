import type { Character } from "../../content/schemas.ts";
import { Card } from "./Card.tsx";

type Props = {
  characters: Character[];
  flipped: string[];
  guessing: boolean;
  onTap: (id: string) => void;
  onZoom: (id: string) => void;
  onUnflipAll: () => void;
};

// Spec 8: all 24 cards at once, 6 columns by 4 rows, sized from whichever runs out
// first, the width or the height of the space left, so the board never scrolls.
// Each card has a caption under the picture (name and pinyin), because a caption
// over it would hide the pets in the bottom corners (spec 3.5). 6 × 4 leaves
// bigger cards than 4 × 6 once the caption takes its share of the height.
export function Board({ characters, flipped, guessing, onTap, onZoom, onUnflipAll }: Props) {
  const allDown = characters.length > 0 && characters.every((c) => flipped.includes(c.id));
  return (
    <div className="relative min-h-0 flex-1 px-2 py-1 [container-type:size]">
      <ul
        aria-label="Board"
        className="mx-auto grid h-full w-fit grid-cols-6 content-center justify-center gap-1"
        style={{
          ["--card-cap" as string]: "1.75rem",
          // Card width: a sixth of the width, or a quarter of the height less the
          // captions, turned into a width with the 5:6 picture shape.
          ["--card-w" as string]:
            "min(calc((100cqw - 1.25rem) / 6), calc((100cqh - 0.75rem - 4 * var(--card-cap)) / 4 * 5 / 6))",
        }}
      >
        {characters.map((c) => (
          <li key={c.id}>
            <Card
              character={c}
              flipped={flipped.includes(c.id)}
              guessing={guessing}
              onTap={() => onTap(c.id)}
              onZoom={() => onZoom(c.id)}
            />
          </li>
        ))}
      </ul>
      {allDown && !guessing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={onUnflipAll}
            className="min-h-11 rounded-full bg-stone-800 px-5 text-white shadow-lg"
          >
            Unflip all
          </button>
        </div>
      )}
    </div>
  );
}
