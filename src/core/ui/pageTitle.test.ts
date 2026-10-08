import { expect, test } from "vitest";
import { pageTitle } from "./pageTitle.ts";

test.each([
  ["/zh", "谁？"],
  ["/zh/play", "谁？"],
  ["/it/progress", "Chi è?"],
  ["/languages", "parlaplay"],
  ["/settings", "parlaplay"],
  ["/", "parlaplay"],
  ["/fr", "parlaplay"],
])("%s is titled %s", (path, title) => {
  expect(pageTitle(path)).toBe(title);
});
