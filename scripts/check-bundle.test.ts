import { expect, test } from "vitest";
import { closure, gzippedKb, pages, strayModules, type Manifest } from "./check-bundle.ts";

// A build where the shell imports a vendor chunk, and each language module imports
// its own content and the vendor chunk.
const manifest: Manifest = {
  "index.html": { file: "assets/index.js", isEntry: true, imports: ["_vendor.js"] },
  "_vendor.js": { file: "assets/vendor.js" },
  "src/languages/it/index.ts": { file: "assets/it.js", imports: ["_vendor.js", "_it-content.js"] },
  "_it-content.js": { file: "assets/it-content.js" },
  "src/languages/zh/index.ts": { file: "assets/zh.js", imports: ["_vendor.js"] },
};

test("closure follows static imports once each", () => {
  expect([...closure(manifest, "src/languages/it/index.ts")].sort()).toEqual([
    "_it-content.js",
    "_vendor.js",
    "src/languages/it/index.ts",
  ]);
});

test("the picker loads the shell; each language page adds only its own module", () => {
  const [picker, it, zh] = pages(manifest, ["it", "zh"]);
  expect(picker?.keys).toEqual(new Set(["index.html", "_vendor.js"]));
  expect(it?.keys.has("src/languages/it/index.ts")).toBe(true);
  expect(it?.keys.has("src/languages/zh/index.ts")).toBe(false);
  expect(zh?.keys.has("_it-content.js")).toBe(false);
  expect(strayModules(manifest, ["it", "zh"])).toEqual([]);
});

test("a module the shell loads up front, or one language loading another, fails", () => {
  const bad: Manifest = {
    ...manifest,
    "index.html": {
      file: "assets/index.js",
      isEntry: true,
      imports: ["_vendor.js", "src/languages/it/index.ts"],
    },
    "src/languages/zh/index.ts": { file: "assets/zh.js", imports: ["src/languages/it/index.ts"] },
  };
  expect(strayModules(bad, ["it", "zh"])).toEqual([
    "/languages loads the it module",
    "/zh loads the it module",
  ]);
});

test("a chunk missing from the manifest is an error", () => {
  expect(() => closure({}, "index.html")).toThrow(/not in the build manifest/);
});

test("gzippedKb compresses", () => {
  expect(gzippedKb("a".repeat(100_000))).toBeLessThan(1);
});
