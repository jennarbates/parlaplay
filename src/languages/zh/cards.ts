// Spec 6: which lexicon ids get FSRS cards. One card per noun per direction:
// 14 nouns × 2 = 28 in the MVP. Platform spec 3.2 calls this the module's cardIds.
import { content } from "./content/index.ts";

const ids = content.lexicon.filter((e) => e.pos === "noun").map((e) => e.id);

export const cardIds = (): readonly string[] => ids;
