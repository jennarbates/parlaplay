// The game's content, typed. Every file is checked against its schema when the app
// builds (scripts/content-check.ts), so the casts here are safe.
import charactersJson from "./characters.json" with { type: "json" };
import grammarJson from "./grammar.json" with { type: "json" };
import lexiconJson from "./lexicon.json" with { type: "json" };
import messagesJson from "./messages.json" with { type: "json" };
import releasedIdsJson from "./released-ids.json" with { type: "json" };
import type { Character, GrammarPoint, LexiconEntry, Messages } from "./schemas.ts";
import versionJson from "./version.json" with { type: "json" };

export type Content = {
  characters: Character[];
  lexicon: LexiconEntry[];
  grammar: GrammarPoint[];
  messages: Messages;
};

export const content: Content = {
  characters: charactersJson as Character[],
  lexicon: lexiconJson as LexiconEntry[],
  grammar: grammarJson as GrammarPoint[],
  messages: messagesJson as Messages,
};

export const contentVersion: number = versionJson.contentVersion;
export const releasedIds: string[] = releasedIdsJson;

// Spec 3.7: the permanent ids that history refers to.
export function allIds(c: Content): string[] {
  return [
    ...c.characters.map((x) => x.id),
    ...c.lexicon.map((x) => x.id),
    ...c.grammar.map((x) => x.id),
  ];
}

export function missingReleasedIds(released: string[], c: Content): string[] {
  const current = new Set(allIds(c));
  return released.filter((id) => !current.has(id));
}
