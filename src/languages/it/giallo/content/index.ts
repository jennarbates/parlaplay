// Chi è stato?'s content, typed. Every file is checked against its schema when the
// app builds (scripts/content-check.ts), so the casts here are safe.
import casesJson from "./cases.json" with { type: "json" };
import framesJson from "./frames.json" with { type: "json" };
import lexiconJson from "./lexicon.json" with { type: "json" };
import messagesJson from "./messages.json" with { type: "json" };
import releasedIdsJson from "./released-ids.json" with { type: "json" };
import type { Case, Frame, LexiconEntry, Messages } from "./schemas.ts";
import versionJson from "./version.json" with { type: "json" };

export type GialloContent = {
  lexicon: LexiconEntry[];
  frames: Frame[];
  cases: Case[];
  messages: Messages;
};

export const content: GialloContent = {
  lexicon: lexiconJson as LexiconEntry[],
  frames: framesJson as Frame[],
  cases: casesJson as Case[],
  messages: messagesJson as Messages,
};

export const contentVersion: number = versionJson.contentVersion;
export const releasedIds: string[] = releasedIdsJson;

// GS 4.4: the permanent ids that history refers to.
export function allIds(c: GialloContent): string[] {
  return [...c.lexicon.map((x) => x.id), ...c.frames.map((x) => x.id), ...c.cases.map((x) => x.id)];
}

export function missingReleasedIds(released: string[], c: GialloContent): string[] {
  const current = new Set(allIds(c));
  return released.filter((id) => !current.has(id));
}
