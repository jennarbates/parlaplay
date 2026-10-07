import type { Character } from "../../content/schemas.ts";
import { Face } from "../Face.tsx";
import type { PreviewSpot } from "./boardLayout.ts";

// A larger, read-only look at a hovered card: the face and the name, no
// attributes (that is CardDetail). It never takes focus or the pointer.
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
      <p className="pt-1 text-center font-semibold">{character.name}</p>
    </div>
  );
}
