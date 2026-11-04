// Chi è stato? GS 2: a saved case this content version can resume. On its own, with
// no content, so the Italian module can answer without loading the giallo's chunk.
import version from "../content/version.json" with { type: "json" };
import type { CaseState } from "../engine/types.ts";

export type SavedCase = { contentVersion: number; gameId: string; state: CaseState };

export function isResumable(value: unknown): value is SavedCase {
  if (typeof value !== "object" || value === null) return false;
  const saved = value as Partial<SavedCase>;
  if (saved.contentVersion !== version.contentVersion || typeof saved.gameId !== "string")
    return false;
  const s = saved.state as Partial<CaseState> | undefined;
  return (
    !!s &&
    typeof s.caseId === "string" &&
    (s.phase === "asking" || s.phase === "inspector") &&
    typeof s.budget === "number" &&
    typeof s.cast === "object" &&
    Array.isArray(s.notebook) &&
    Array.isArray(s.cleared) &&
    Array.isArray(s.ratedThisTurn)
  );
}
