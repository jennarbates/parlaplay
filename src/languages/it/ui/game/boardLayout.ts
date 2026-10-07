import type { CSSProperties } from "react";

// The board's shape: 4 × 6 on the phone, 6 × 4 on desktop (desktop spec DD4).
// Cards keep their row-major order, so card n keeps its reading position.
export const boardShape = (desktop: boolean) =>
  desktop ? { cols: 6, rows: 4, gap: "0.5rem" } : { cols: 4, rows: 6, gap: "0.25rem" };

// The grid's custom properties and card width, shared with the skeleton board.
// Card width: a column's share of the width, or a row's share of the height
// turned into a width with the 5:6 card shape, whichever is smaller.
export function boardVars(desktop: boolean) {
  const { cols, rows, gap } = boardShape(desktop);
  return {
    "--cols": cols,
    "--rows": rows,
    "--gap": gap,
    "--card-w":
      "min(calc((100cqw - (var(--cols) - 1) * var(--gap)) / var(--cols)), calc((100cqh - (var(--rows) - 1) * var(--gap)) / var(--rows) * 5 / 6))",
  } as CSSProperties;
}

type Box = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

export type PreviewSpot = { left: number; top: number; width: number };

const gap = 8; // between the card and the preview, px
const nameLine = 32; // the name under the face, px

// Desktop spec DS 7.2: where the preview goes, worked out once when it shows.
// Twice the card's width, capped at 16rem; beside the card on the side with more
// room, so it never covers it; centred on the card and kept inside the board.
export function previewSpot(card: Box, area: Box, rem = 16): PreviewSpot {
  const width = Math.min(card.width * 2, 16 * rem);
  const height = (width * 6) / 5 + nameLine;
  const right = area.right - card.right >= card.left - area.left;
  const left = right ? card.right + gap : card.left - gap - width;
  const centred = card.top + card.height / 2 - height / 2;
  const top = Math.max(area.top, Math.min(centred, area.bottom - height));
  return { left, top, width };
}
