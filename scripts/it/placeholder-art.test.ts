import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { artFiles } from "../../src/languages/it/content/art.ts";
import { artDir, placeholderArt } from "./generate-placeholder-art.ts";

const generated = placeholderArt();
const committed = readdirSync(artDir).filter((f) => f.endsWith(".svg"));

test("the manifest has the 33 files from spec 3.5", () => {
  expect(artFiles).toHaveLength(33);
  expect(new Set(artFiles).size).toBe(33);
});

test("public/art/it/ has exactly the manifest files", () => {
  expect(committed.sort()).toEqual([...artFiles].sort());
});

test("the generator makes exactly the manifest files", () => {
  expect(Object.keys(generated).sort()).toEqual([...artFiles].sort());
});

describe.each(artFiles.map((f) => [f] as const))("%s", (file) => {
  const text = readFileSync(`${artDir}${file}`, "utf8");

  test("matches the generator, so the two never drift", () => {
    expect(text).toBe(generated[file]);
  });

  test("is an SVG on the shared 100 × 120 canvas", () => {
    expect(text).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 120"/);
    expect(text.trimEnd().endsWith("</svg>")).toBe(true);
  });

  test("has no scripts, links or external references", () => {
    expect(text).not.toMatch(/<script|href=|url\(|<image|<foreignObject/i);
  });
});

test("every variant of a layer looks different", () => {
  const groups = ["face-", "eyes-", "beard-", "mustache-", "hair-", "body-"];
  for (const g of groups) {
    const texts = artFiles.filter((f) => f.startsWith(g)).map((f) => generated[f]);
    expect(new Set(texts).size, g).toBe(texts.length);
  }
});

test("the hat sits above the hairline, so short hair shows below it (spec 3.5)", () => {
  const brimBottom = Math.max(
    ...[
      ...(generated["hat.svg"] ?? "").matchAll(/y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g),
    ].map((m) => Number(m[1]) + Number(m[2])),
  );
  // The short-hair cap starts at y 24 and runs down to about y 36 at the forehead.
  expect(brimBottom).toBeLessThanOrEqual(26);
});
