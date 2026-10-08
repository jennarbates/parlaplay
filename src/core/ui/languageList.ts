import type { LanguageCode } from "../languages.ts";
import { languageOf } from "../registry.ts";

// English names in the order given: "Italian", "Italian and Chinese",
// "Italian, Chinese and Spanish".
export function languageList(codes: readonly LanguageCode[]): string {
  const names = codes.map((code) => languageOf(code).englishName);
  const last = names.pop() ?? "";
  return names.length ? `${names.join(", ")} and ${last}` : last;
}

// Platform spec 2: the save-guest prompt names every language with guest data.
export const savePromptTitle = (codes: readonly LanguageCode[]) =>
  `Save your ${languageList(codes)} progress to this account?`;
