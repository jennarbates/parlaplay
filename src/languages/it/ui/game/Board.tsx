import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { Character } from "../../content/schemas.ts";
import { boardShape, boardVars } from "./boardLayout.ts";
import { Card } from "./Card.tsx";
import { CardPreview } from "./CardPreview.tsx";
import { useHoverPreview } from "./useHoverPreview.ts";

type Props = {
  characters: Character[];
  flipped: string[];
  guessing: boolean;
  onTap: (id: string) => void;
  onZoom: (id: string) => void;
  onUnflipAll: () => void;
  desktop?: boolean;
  hoverPreview?: boolean; // desktop spec DS 7.2: lg, a fine pointer that hovers, not guessing
};

// Spec 8: all 24 faces at once, sized from whichever runs out first, the width or
// the height of the space left, so the board never scrolls.
export function Board({
  characters,
  flipped,
  guessing,
  onTap,
  onZoom,
  onUnflipAll,
  desktop = false,
  hoverPreview = false,
}: Props) {
  const allDown = characters.length > 0 && characters.every((c) => flipped.includes(c.id));
  const area = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const { preview, handlers } = useHoverPreview(hoverPreview, area);
  const previewed = preview && characters.find((c) => c.id === preview.id);
  const grid = useRef<HTMLDivElement>(null);
  // The card in the tab order: the last one focused, or the first (DS 8.2).
  const [active, setActive] = useState(0);
  const { cols } = boardShape(desktop);

  // Desktop spec DS 8.1 and 8.2: the WAI-ARIA grid keys, with no wrapping at the
  // edges, and i for the detail view. Enter and Space are the card's own button.
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = (e.target as HTMLElement).dataset.card;
    if (at === undefined || e.altKey || e.metaKey) return;
    const i = Number(at);
    const last = characters.length - 1;
    const row = Math.floor(i / cols);
    let to: number;
    switch (e.key) {
      case "ArrowLeft":
        to = i % cols > 0 ? i - 1 : i;
        break;
      case "ArrowRight":
        to = i % cols < cols - 1 && i < last ? i + 1 : i;
        break;
      case "ArrowUp":
        to = i - cols >= 0 ? i - cols : i;
        break;
      case "ArrowDown":
        to = i + cols <= last ? i + cols : i;
        break;
      case "Home":
        to = e.ctrlKey ? 0 : row * cols;
        break;
      case "End":
        to = e.ctrlKey ? last : Math.min(row * cols + cols - 1, last);
        break;
      case "i":
      case "I": {
        const c = characters[i];
        if (e.ctrlKey || !c) return;
        e.preventDefault();
        onZoom(c.id);
        return;
      }
      default:
        return;
    }
    e.preventDefault();
    setActive(to);
    grid.current?.querySelector<HTMLElement>(`[data-card="${to}"]`)?.focus();
  };

  const card = (c: Character, i: number) => (
    <Card
      describedBy={preview?.id === c.id ? tooltipId : undefined}
      character={c}
      flipped={flipped.includes(c.id)}
      guessing={guessing}
      onTap={() => onTap(c.id)}
      onZoom={() => onZoom(c.id)}
      index={i}
      tabIndex={desktop ? (i === active ? 0 : -1) : undefined}
      onFocus={desktop ? () => setActive(i) : undefined}
    />
  );

  return (
    <div
      ref={area}
      className={`relative min-h-0 flex-1 [container-type:size] ${desktop ? "p-6" : "px-2 py-1"}`}
    >
      {desktop ? (
        // Desktop spec DD14: a grid of rows, so the arrow keys follow the ARIA
        // grid pattern, with one tab stop for the whole board.
        <div
          ref={grid}
          role="grid"
          aria-label="Board"
          onKeyDown={onGridKey}
          className="mx-auto flex h-full w-fit flex-col justify-center gap-[var(--gap)]"
          style={boardVars(desktop)}
        >
          {Array.from({ length: Math.ceil(characters.length / cols) }, (_, r) => (
            <div key={r} role="row" className="flex gap-[var(--gap)]">
              {characters.slice(r * cols, r * cols + cols).map((c, j) => (
                <div key={c.id} role="gridcell" {...handlers(c.id)}>
                  {card(c, r * cols + j)}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <ul
          aria-label="Board"
          className="mx-auto grid h-full w-fit grid-cols-[repeat(var(--cols),auto)] content-center justify-center gap-[var(--gap)]"
          style={boardVars(desktop)}
        >
          {characters.map((c, i) => (
            <li key={c.id} {...handlers(c.id)}>
              {card(c, i)}
            </li>
          ))}
        </ul>
      )}
      {preview && previewed && (
        <CardPreview id={tooltipId} character={previewed} spot={preview.spot} />
      )}
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
