import { layersFor } from "../content/art.ts";
import type { Character } from "../content/schemas.ts";

type Props = {
  character: Character;
  // Faces have no text (spec 3.5), so the caller says what a screen reader hears.
  label?: string;
  className?: string;
};

// Spec 3.5: a card face is the manifest layers stacked in z order, picked from the
// character's data, so the picture can never disagree with it.
export function Face({ character, label, className = "" }: Props) {
  return (
    <div
      className={`relative aspect-[5/6] overflow-hidden ${className}`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {layersFor(character).map((file) => (
        <img
          key={file}
          src={`${import.meta.env.BASE_URL}art/${file}`}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full select-none"
        />
      ))}
    </div>
  );
}
