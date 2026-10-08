import { expect, test } from "vitest";
import { previewSpot } from "./boardLayout.ts";

const box = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

// Desktop spec DS 7.2: a 1024 × 640 board area, cards about 87 × 104 px.
const area = box(24, 80, 560, 536);

test("the preview is twice the card's width, capped at 16rem", () => {
  expect(previewSpot(box(24, 80, 87, 104), area).width).toBe(174);
  expect(previewSpot(box(24, 80, 170, 204), box(0, 0, 2000, 2000)).width).toBe(256);
});

test("it is centred over the card, kept inside the board area left and right", () => {
  const middle = box(250, 300, 87, 104);
  const spot = previewSpot(middle, area);
  expect(spot.left + spot.width / 2).toBeCloseTo(middle.left + middle.width / 2);

  expect(previewSpot(box(24, 80, 87, 104), area).left).toBe(area.left);
  const right = previewSpot(box(497, 80, 87, 104), area);
  expect(right.left + right.width).toBeLessThanOrEqual(area.right + 0.001);
});

test("it is centred on the card, but kept inside the board area", () => {
  const middle = box(24, 300, 87, 104);
  const spot = previewSpot(middle, area);
  const height = (spot.width * 6) / 5 + 32;
  expect(spot.top + height / 2).toBeCloseTo(middle.top + middle.height / 2);

  expect(previewSpot(box(24, 80, 87, 104), area).top).toBe(area.top);
  const bottom = previewSpot(box(24, 512, 87, 104), area);
  expect(bottom.top + height).toBeLessThanOrEqual(area.bottom + 0.001);
});
