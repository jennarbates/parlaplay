// The browser tab's title: the game's own title inside a language (谁？, Chi è?),
// parlaplay on the picker and the shared screens.
import { codeOf, languageOf } from "../registry.ts";

export function pageTitle(path: string): string {
  const code = codeOf(path);
  return code ? languageOf(code).gameTitle : "parlaplay";
}
