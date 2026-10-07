// Spec 9: every card's accessible name lists the name and attributes in Italian,
// e.g. "Giulia: capelli castani lunghi, occhi verdi, occhiali". It gives screen
// reader users what the picture gives everyone else, and doubles as reading
// practice. Built from the lexicon and the default wording, like the questions.
import type { Adjective, Character, LexiconEntry, Noun } from "../content/schemas.ts";

export function describeCharacter(c: Character, lexicon: LexiconEntry[]): string {
  const adj = (id: string) =>
    (lexicon.find((e) => e.id === id) as Adjective | undefined)?.forms.mp ?? id;
  const noun = (attr: string) =>
    (lexicon.find((e) => e.pos === "noun" && e.attr === attr) as Noun | undefined)?.text;
  const { attrs } = c;
  const parts = [
    `capelli ${adj(attrs.hairColor)} ${adj(attrs.hairLength)}`,
    `occhi ${adj(attrs.eyeColor)}`,
    ...(["glasses", "hat", "beard", "mustache"] as const)
      .filter((a) => attrs[a])
      .map((a) => noun(a) ?? a),
  ];
  return `${c.name}: ${parts.join(", ")}`;
}
