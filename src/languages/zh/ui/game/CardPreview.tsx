import type { Character } from "../../content/schemas.ts";
import type { PreviewSpot } from "../../../../core/ui/boardLayout.ts";
import { Face } from "../Face.tsx";

// A larger, read-only look at a hovered card: the face, the name and its pinyin,
// no attributes (that is CardDetail). It never takes focus or the pointer.
export function CardPreview({
  id,
  character,
  spot,
}: {
  id: string;
  character: Character;
  spot: PreviewSpot;
}) {
  return (
    <div
      id={id}
      role="tooltip"
      className="pointer-events-none fixed z-40 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-stone-300 motion-safe:animate-[preview-in_120ms_ease-out]"
      style={{ left: spot.left, top: spot.top, width: spot.width }}
    >
      <Face character={character} className="w-full rounded-xl" />
      <p className="flex flex-col items-center leading-tight">
        <span lang="zh-Hans" className="text-xl font-semibold">
          {character.name}
        </span>
        <span lang="zh-Latn-pinyin" className="text-sm text-stone-600">
          {character.namePinyin}
        </span>
      </p>
    </div>
  );
}
