import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { artFiles } from "../../src/languages/zh/content/art.ts";
import { artDir, placeholderArt } from "./generate-placeholder-art.ts";

const generated = placeholderArt();
const committed = readdirSync(artDir).filter((f) => f.endsWith(".svg"));

test("the manifest has the 26 files from spec 3.5", () => {
  expect(artFiles).toHaveLength(26);
  expect(new Set(artFiles).size).toBe(26);
});

test("public/art/zh/ has exactly the manifest files", () => {
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
  for (const g of ["bg-", "body-", "face-", "hair-"]) {
    const texts = artFiles.filter((f) => f.startsWith(g)).map((f) => generated[f]);
    expect(new Set(texts).size, g).toBe(texts.length);
  }
});
