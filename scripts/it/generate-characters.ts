// Spec 3.2, D20: picks 24 attribute combinations that pass every content invariant,
// retrying until they do. Run once by hand, review, name, then commit the result
// as src/languages/it/content/characters.json:
//
//   node scripts/generate-characters.ts --seed 2026 > characters.draft.json
import { checkInvariants } from "../../src/languages/it/content/invariants.ts";
import type { Attrs } from "../../src/languages/it/content/schemas.ts";

export type Draft = { id: string; name: string; attrs: Attrs; skin: string };

export const skins = ["s1", "s2", "s3", "s4", "s5"] as const;
const maxAttempts = 10_000;

// mulberry32: small, fast, and the same on every machine.
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)] as T;
}

function randomAttrs(random: () => number, gender: Attrs["gender"]): Attrs {
  const man = gender === "n.uomo";
  return {
    gender,
    hairColor: pick(random, [
      "adj.biondo",
      "adj.castano",
      "adj.nero",
      "adj.rosso",
      "adj.bianco",
    ] as const),
    hairLength: pick(random, ["adj.corto", "adj.lungo"] as const),
    eyeColor: pick(random, ["adj.azzurro", "adj.marrone", "adj.verde"] as const),
    glasses: random() < 0.5,
    hat: random() < 0.5,
    beard: man && random() < 0.5,
    mustache: man && random() < 0.5,
  };
}

export function generateCharacters(seed: number): { characters: Draft[]; attempts: number } {
  const random = rng(seed);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const genders = [
      ...Array<Attrs["gender"]>(12).fill("n.uomo"),
      ...Array<Attrs["gender"]>(12).fill("n.donna"),
    ];
    const characters = genders.map((gender, i) => ({
      id: `c.todo${i + 1}`,
      name: "TODO",
      attrs: randomAttrs(random, gender),
      skin: pick(random, skins),
    }));
    if (checkInvariants(characters).length === 0) return { characters, attempts: attempt };
  }
  throw new Error(`No valid set after ${maxAttempts} attempts with seed ${seed}`);
}

if (import.meta.main) {
  const flag = process.argv.indexOf("--seed");
  const seed = Number(process.argv[flag + 1]);
  if (flag === -1 || !Number.isInteger(seed)) {
    console.error("Usage: node scripts/generate-characters.ts --seed <integer>");
    process.exit(1);
  }
  const { characters, attempts } = generateCharacters(seed);
  console.error(`Seed ${seed}: valid set after ${attempts} attempt(s). Men first, then women.`);
  console.log(JSON.stringify(characters, null, 2));
}
