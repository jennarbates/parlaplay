// Spec 3.2 content invariants. Shared by the character generator and the content
// tests, so a generated set and the committed file are held to the same rules.
import { genders, jobs, places, things, type Attrs } from "./schemas.ts";

type Question = { attr: keyof Attrs; value: Attrs[keyof Attrs]; label: string };

// The 14 questions of spec 3.1, as the attribute value each one tests.
export const questions: Question[] = [
  ...genders.map((value) => ({ attr: "gender" as const, value, label: `gender=${value}` })),
  ...jobs.map((value) => ({ attr: "job" as const, value, label: `job=${value}` })),
  ...places.map((value) => ({ attr: "place" as const, value, label: `place=${value}` })),
  ...things.map((attr) => ({ attr, value: true, label: attr })),
];

export const jobRange = { min: 7, max: 9 };
export const perPlace = 6;
export const thingRange = { min: 5, max: 14 }; // yeses per pet or thing question
export const thingsPerCharacter = { min: 1, max: 3 };

export function yesCount(characters: { attrs: Attrs }[], q: Question): number {
  return characters.filter((c) => c.attrs[q.attr] === q.value).length;
}

export function attrsKey(attrs: Attrs): string {
  return (["gender", "job", "place", ...things] as const).map((k) => String(attrs[k])).join("|");
}

export function thingCount(attrs: Attrs): number {
  return things.filter((t) => attrs[t]).length;
}

// "Lǐ Lì" → "lili". Tone marks dropped, ü written v (spec 3.1).
export function tonelessId(namePinyin: string): string {
  return `c.${namePinyin
    .replace(/[ǖǘǚǜü]/g, "v")
    .normalize("NFD")
    .replace(/[̀-ͯ\s]/g, "")
    .toLowerCase()}`;
}

export function checkInvariants(characters: { attrs: Attrs }[]): string[] {
  const problems: string[] = [];
  if (characters.length !== 24) problems.push(`${characters.length} characters, expected 24`);

  // 1. No two characters alike, so the CPU can always find a splitting question.
  const seen = new Map<string, number>();
  characters.forEach((c, i) => {
    const key = attrsKey(c.attrs);
    const first = seen.get(key);
    if (first !== undefined)
      problems.push(`characters ${first} and ${i} have the same 8 attributes`);
    else seen.set(key, i);
  });

  // 2. 12 men and 12 women.
  const men = characters.filter((c) => c.attrs.gender === "n.nande").length;
  if (men !== 12 || characters.length - men !== 12)
    problems.push(`${men} men and ${characters.length - men} women, expected 12 and 12`);

  // 3. Jobs 7 to 9 each, places exactly 6 each. 4. Pets and things 5 to 14 each.
  for (const q of questions) {
    const n = yesCount(characters, q);
    if (q.attr === "job" && (n < jobRange.min || n > jobRange.max))
      problems.push(`${q.label} is yes for ${n}, expected ${jobRange.min} to ${jobRange.max}`);
    if (q.attr === "place" && n !== perPlace)
      problems.push(`${q.label} is yes for ${n}, expected ${perPlace}`);
    if (q.value === true && (n < thingRange.min || n > thingRange.max))
      problems.push(`${q.label} is yes for ${n}, expected ${thingRange.min} to ${thingRange.max}`);
  }

  // 5. One to three pets and things each, so a card is never empty or crowded.
  characters.forEach((c, i) => {
    const n = thingCount(c.attrs);
    if (n < thingsPerCharacter.min || n > thingsPerCharacter.max)
      problems.push(`character ${i} has ${n} pets and things, expected 1 to 3`);
  });
  return problems;
}
