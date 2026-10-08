// Spec 3.2 content invariants. Shared by the character generator and the content
// tests, so a generated set and the committed file are held to the same rules.
import type { Attrs } from "./schemas.ts";

type Question = { attr: keyof Attrs; value: Attrs[keyof Attrs]; label: string };

const enumValues = {
  gender: ["n.uomo", "n.donna"],
  hairColor: ["adj.biondo", "adj.castano", "adj.nero", "adj.rosso", "adj.bianco"],
  hairLength: ["adj.corto", "adj.lungo"],
  eyeColor: ["adj.azzurro", "adj.marrone", "adj.verde"],
} as const;

const booleanAttrs = ["glasses", "hat", "beard", "mustache"] as const;

// The 16 questions of spec 3.1, as the attribute value each one tests.
export const questions: Question[] = [
  ...Object.entries(enumValues).flatMap(([attr, values]) =>
    values.map((value) => ({ attr: attr as keyof Attrs, value, label: `${attr}=${value}` })),
  ),
  ...booleanAttrs.map((attr) => ({ attr, value: true, label: attr })),
];

export const minYes = 3;
export const maxYes = 15;

export function yesCount(characters: { attrs: Attrs }[], q: Question): number {
  return characters.filter((c) => c.attrs[q.attr] === q.value).length;
}

export function attrsKey(attrs: Attrs): string {
  return [...Object.keys(enumValues), ...booleanAttrs]
    .map((k) => String(attrs[k as keyof Attrs]))
    .join("|");
}

export function checkInvariants(characters: { attrs: Attrs }[]): string[] {
  const problems: string[] = [];

  if (characters.length !== 24) problems.push(`${characters.length} characters, expected 24`);

  const seen = new Map<string, number>();
  characters.forEach((c, i) => {
    const key = attrsKey(c.attrs);
    const first = seen.get(key);
    if (first !== undefined)
      problems.push(`characters ${first} and ${i} have the same 8 attributes`);
    else seen.set(key, i);
  });

  characters.forEach((c, i) => {
    if (c.attrs.gender === "n.donna" && (c.attrs.beard || c.attrs.mustache)) {
      problems.push(`character ${i} is a woman with a beard or mustache`);
    }
  });

  const men = characters.filter((c) => c.attrs.gender === "n.uomo").length;
  if (men !== 12 || characters.length - men !== 12) {
    problems.push(`${men} men and ${characters.length - men} women, expected 12 and 12`);
  }

  for (const q of questions) {
    const n = yesCount(characters, q);
    if (n < minYes || n > maxYes)
      problems.push(`${q.label} is yes for ${n}, expected ${minYes} to ${maxYes}`);
  }
  return problems;
}
