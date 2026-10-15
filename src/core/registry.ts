// Platform spec 3.1: the registry the app uses. Each entry of languages.json plus
// each of its games' contentVersion, read from that game's version.json when the
// app builds, so the picker and nav can check a saved round without loading the
// language (8.1). languages.json is checked against RegistryFile when the app
// builds (scripts/content-check.ts), so it is not parsed again here: that would put
// Zod in every page (9).
import entries from "./languages.json";
import type { GameId, Language, LanguageCode, LanguageEntry } from "./languages.ts";

type VersionFiles = Record<string, { contentVersion: number }>;

const versionFiles: VersionFiles = import.meta.glob(
  ["../languages/*/content/version.json", "../languages/*/*/content/version.json"],
  { eager: true, import: "default" },
);

// Where a game's version.json is: the language's first game uses the language's
// own content folder (3.1, Chi è stato? GS 8).
export function versionPath(code: LanguageCode, game: GameId, first: boolean): string {
  return first
    ? `../languages/${code}/content/version.json`
    : `../languages/${code}/${game}/content/version.json`;
}

export function buildRegistry(
  fileEntries: readonly LanguageEntry[],
  versions: VersionFiles,
): Language[] {
  return fileEntries.map((entry) => {
    const contentVersions: Language["contentVersions"] = {};
    entry.games.forEach((game, i) => {
      const version = versions[versionPath(entry.code, game, i === 0)];
      if (!version)
        throw new Error(`No content/version.json for game "${game}" of language "${entry.code}"`);
      contentVersions[game] = version.contentVersion;
    });
    return { ...entry, contentVersions };
  });
}

export const registry: readonly Language[] = buildRegistry(
  entries as LanguageEntry[],
  versionFiles,
);

// The first language in registry order: the fallback where some language is needed
// and none is chosen yet. RegistryFile requires at least one.
const first = registry[0];
if (!first) throw new Error("languages.json has no languages");
export const firstCode: LanguageCode = first.code;

// A registry code, or null for anything else (an unknown code, a damaged value).
export function knownCode(value: unknown): LanguageCode | null {
  return registry.find((l) => l.code === value)?.code ?? null;
}

export function languageOf(code: LanguageCode): Language {
  const language = registry.find((l) => l.code === code);
  if (!language) throw new Error(`Unknown language "${code}"`);
  return language;
}

// The language a path is in: its first segment, if that is a registry code.
export function codeOf(path: string): LanguageCode | null {
  return knownCode(path.split("/").find(Boolean));
}

// A language's first game: the one a row without a game belongs to (Chi è stato?
// GS 8), and the one the picker and nav offer. RegistryFile requires one.
export function firstGameOf(code: LanguageCode): GameId {
  const [game] = languageOf(code).games;
  if (!game) throw new Error(`Language "${code}" has no games`);
  return game;
}

// A game of this language, or its first game for anything else: how a row saved
// before games had ids (or a damaged one) reads.
export function gameOf(code: LanguageCode, value: unknown): GameId {
  return languageOf(code).games.find((g) => g === value) ?? firstGameOf(code);
}

export function contentVersionOf(code: LanguageCode, game: GameId): number | undefined {
  return languageOf(code).contentVersions[game];
}
