import { expect, test } from "vitest";
import { languageList, savePromptTitle } from "./languageList.ts";

test("names one or two languages as the prompt says them (platform spec 2)", () => {
  expect(languageList(["it"])).toBe("Italian");
  expect(languageList(["it", "zh"])).toBe("Italian and Chinese");
  expect(languageList([])).toBe("");
  expect(savePromptTitle(["it", "zh"])).toBe(
    "Save your Italian and Chinese progress to this account?",
  );
});
