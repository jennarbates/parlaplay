// Platform spec 3.1: the registry the app uses. Each entry of languages.json plus
// its contentVersion, read from src/languages/{code}/content/version.json when the
// app builds, so the picker and nav can check a saved round without loading the
// language (8.1). languages.json is checked against RegistryFile when the app
// builds (scripts/content-check.ts), so it is not parsed again here: that would put
// Zod in every page (9).
import entries from "./languages.json";
import type { Language, LanguageCode, LanguageEntry } from "./languages.ts";

type VersionFiles = Record<string, { contentVersion: number }>;

const versionFiles: VersionFiles = import.meta.glob("../languages/*/content/version.json", {
  eager: true,
  import: "default",
});

export function buildRegistry(
  fileEntries: readonly LanguageEntry[],
  versions: VersionFiles,
): Language[] {
  return fileEntries.map((entry) => {
    const version = versions[`../languages/${entry.code}/content/version.json`];
    if (!version) throw new Error(`No content/version.json for language "${entry.code}"`);
    return { ...entry, contentVersion: version.contentVersion };
  });
}

export const registry: readonly Language[] = buildRegistry(
  entries as LanguageEntry[],
  versionFiles,
);

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
