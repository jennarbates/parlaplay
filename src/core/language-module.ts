// Platform spec 3.2: what each language exports, and all the shell knows about it.
import type { ComponentType } from "react";
import type { RouteObject } from "react-router";
import type { ZodType } from "zod";
import type { GameId, LanguageCode } from "./languages.ts";

// How a review-log id shows outside the language's own screens.
export type Label =
  | { kind: "word"; text: string; reading?: string; gloss: string; lang: string }
  | { kind: "grammar"; title: string; explain: string };

// One of a language's games, as Home and the shell list it (Chi è stato? GS 8).
export type GameEntry = {
  id: GameId;
  title: string; // "Chi è stato?"
  titleLang: string; // lang attribute for the title
  blurb: string; // one English line on its card
  path: string; // its Home: "/it" or "/it/giallo"; its game screen is path + "/play"
};

export type LanguageModule = {
  code: LanguageCode;
  games: GameEntry[]; // in the registry's order, so the first is the language's first game
  contentVersions: Partial<Record<GameId, number>>; // from each game's version.json
  routes: RouteObject[]; // under /{code}: the index (Home), "play" and "progress"
  cardIds: () => readonly string[]; // lexicon ids that have FSRS cards (game spec 6)
  // undefined for an id the content no longer has (a removed word)
  labelFor: (id: string) => Label | undefined;
  // a saved round of this game for its content version
  isResumable: (saved: unknown, game: GameId) => boolean;
  deviceSettings: ZodType; // the game spec's device-only settings, with defaults
};

// What a route tells the shared layout, through React Router's handle.
export type RouteHandle = {
  width?: string; // the page's width class at lg (desktop spec DS 5)
  game?: boolean; // the game screen: full height, no desktop nav
};

// Platform spec 8.1: a language's device settings as its section of Settings shows
// them. A language that has any exports this from src/languages/{code}/settings.tsx,
// apart from its module, and draws each setting with the Toggle Settings gives it.
export type SettingToggleProps = {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
};
export type DeviceSettingsSection = ComponentType<{ Toggle: ComponentType<SettingToggleProps> }>;
