// Platform spec 3.2: what each language exports, and all the shell knows about it.
import type { RouteObject } from "react-router";
import type { ZodType } from "zod";
import type { LanguageCode } from "./languages.ts";

// How a review-log id shows outside the language's own screens.
export type Label =
  | { kind: "word"; text: string; reading?: string; gloss: string; lang: string }
  | { kind: "grammar"; title: string; explain: string };

export type LanguageModule = {
  code: LanguageCode;
  contentVersion: number; // from the language's version.json
  routes: RouteObject[]; // under /{code}: the index (Home), "play" and "progress"
  cardIds: () => readonly string[]; // lexicon ids that have FSRS cards (game spec 6)
  // undefined for an id the content no longer has (a removed word)
  labelFor: (id: string) => Label | undefined;
  isResumable: (saved: unknown) => boolean; // a saved round for this content version
  deviceSettings: ZodType; // the game spec's device-only settings, with defaults
};

// What a route tells the shared layout, through React Router's handle.
export type RouteHandle = {
  width?: string; // the page's width class at lg (desktop spec DS 5)
  game?: boolean; // the game screen: full height, no desktop nav
};
