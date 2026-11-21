import type { CSSProperties } from "react";

// The board's shape: 4 × 6 on the phone, 6 × 4 on desktop (desktop spec DD4).
// Cards keep their row-major order, so card n keeps its reading position.
export const boardShape = (desktop: boolean) =>
  desktop ? { cols: 6, rows: 4, gap: "0.5rem" } : { cols: 4, rows: 6, gap: "0.25rem" };

export type BoardShape = { cols: number; rows: number; gap: string };

// What differs by game. Chi è? gives neither: its shape above, and names inside
// the cards. Shéi's board is 6 × 4 at every size, with a caption strip under each
// card whose height comes out of the row before the card is sized (ZS 5.2).
export type BoardLayout = { shape?: BoardShape; cardCap?: string };

// The grid's custom properties and card width, shared with the skeleton board.
// Card width: a column's share of the width, or a row's share of the height
// turned into a width with the 5:6 card shape, whichever is smaller.
export function boardVars(desktop: boolean, { shape, cardCap }: BoardLayout = {}) {
  const { cols, rows, gap } = shape ?? boardShape(desktop);
  const captions = cardCap === undefined ? "" : " - var(--rows) * var(--card-cap)";
  return {
    "--cols": cols,
    "--rows": rows,
    "--gap": gap,
    ...(cardCap !== undefined && { "--card-cap": cardCap }),
    "--card-w": `min(calc((100cqw - (var(--cols) - 1) * var(--gap)) / var(--cols)), calc((100cqh - (var(--rows) - 1) * var(--gap)${captions}) / var(--rows) * 5 / 6))`,
  } as CSSProperties;
}
