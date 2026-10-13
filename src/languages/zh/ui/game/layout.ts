// Shéi's board, for the shared layout code (core/ui/boardLayout.ts).
import type { BoardLayout } from "../../../../core/ui/boardLayout.ts";

export const cols = 6;

// 6 × 4 at every size (zh-desktop.md ZS 5.3), with a caption strip under each card.
// The phone keeps its sizes; at lg the gaps and captions grow (ZD4).
export const boardLayout = (desktop: boolean): BoardLayout =>
  desktop
    ? { shape: { cols, rows: 4, gap: "0.5rem" }, cardCap: "2.25rem" }
    : { shape: { cols, rows: 4, gap: "0.25rem" }, cardCap: "1.75rem" };

// The caption under a previewed face, px: the name at 20px and its pinyin at 14px
// (ZS 8). previewSpot needs it to keep the preview on the board.
export const previewCaption = 44;
