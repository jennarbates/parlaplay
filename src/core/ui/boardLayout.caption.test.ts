import { expect, test } from "vitest";
import { boardShape, boardVars, previewSpot } from "./boardLayout.ts";

// What a game with a caption under each card (Shéi, zh-desktop.md ZS 5.2) asks of
// the shared layout. Chi è?'s own cases are in boardLayout.test.ts, unchanged.

const box = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

test("without a layout, the variables are Chi è?'s: its shape and no caption term", () => {
  const vars = boardVars(true) as Record<string, unknown>;
  expect(vars["--cols"]).toBe(boardShape(true).cols);
  expect(vars["--card-cap"]).toBeUndefined();
  expect(String(vars["--card-w"])).not.toContain("--card-cap");
  expect((boardVars(false) as Record<string, unknown>)["--cols"]).toBe(4);
});

test("a caption comes out of each row's height before the card is sized", () => {
  const shape = { cols: 6, rows: 4, gap: "0.5rem" };
  const vars = boardVars(true, { shape, cardCap: "2.25rem" }) as Record<string, unknown>;
  expect(vars).toMatchObject({
    "--cols": 6,
    "--rows": 4,
    "--gap": "0.5rem",
    "--card-cap": "2.25rem",
  });
  expect(String(vars["--card-w"])).toContain(
    "(100cqh - (var(--rows) - 1) * var(--gap) - var(--rows) * var(--card-cap)) / var(--rows) * 5 / 6",
  );
});

test("a game's own shape is used at every size", () => {
  const shape = { cols: 6, rows: 4, gap: "0.25rem" };
  expect(boardVars(false, { shape, cardCap: "1.75rem" })).toMatchObject({
    "--cols": 6,
    "--rows": 4,
  });
});

// ZS 5.2's worked sizes: the card width the formula gives, in px.
test.each([
  [1024, 640, 77],
  [1280, 720, 93],
  [1440, 900, 131],
  [1920, 1080, 168],
])("at %i × %i a card is %i px wide", (w, h, card) => {
  const panel = 448,
    topBar = 56,
    padding = 48,
    gap = 8,
    caption = 36;
  const byWidth = (w - panel - padding - 5 * gap) / 6;
  const byHeight = (((h - topBar - padding - 3 * gap - 4 * caption) / 4) * 5) / 6;
  expect(Math.round(Math.min(byWidth, byHeight))).toBe(card);
  expect(byHeight).toBeLessThan(byWidth); // height-bound at every one
});

test("a taller caption makes the preview taller, so it is clamped sooner", () => {
  const area = box(0, 0, 1000, 600);
  const card = box(400, 500, 100, 120); // near the bottom edge
  const short = previewSpot(card, area, 16, 32);
  const tall = previewSpot(card, area, 16, 44);
  expect(tall.width).toBe(short.width);
  expect(short.top - tall.top).toBe(12);
  expect(tall.top + (tall.width * 6) / 5 + 44).toBe(area.bottom);
});
