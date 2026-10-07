// Spec 6: which lexicon ids get FSRS cards. One card per noun and adjective per
// direction: 18 lemmas × 2 = 36 in the MVP. Platform spec 3.2 calls this the
// module's cardIds.
import { content } from "./content/index.ts";

const ids = content.lexicon.filter((e) => e.pos === "noun" || e.pos === "adj").map((e) => e.id);

export const cardIds = (): readonly string[] => ids;
