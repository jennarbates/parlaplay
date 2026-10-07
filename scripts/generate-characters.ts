// Spec 3.2: picks 24 attribute sets that pass every content invariant, retrying
// until they do, and names them from the draft list (men first, then women).
// Run once by hand, review, then commit the result as src/content/characters.json:
//
//   node scripts/generate-characters.ts --seed 2026 > src/content/characters.json
//
// scripts/seed-search.ts picks the seed (spec 3.2: lowest CPU maximum).
import { checkInvariants, jobRange, perPlace, tonelessId } from "../src/content/invariants.ts";
import {
  hairStyles,
  jobs,
  places,
  skins,
  things,
  type Attrs,
  type Character,
} from "../src/content/schemas.ts";

// Spec 3.2 draft names, [characters, pinyin]. TBD: the Mandarin reviewer checks each.
export const men = [
  ["王明", "Wáng Míng"],
  ["张伟", "Zhāng Wěi"],
  ["李强", "Lǐ Qiáng"],
  ["刘洋", "Liú Yáng"],
  ["陈杰", "Chén Jié"],
  ["杨军", "Yáng Jūn"],
  ["赵磊", "Zhào Lěi"],
  ["黄涛", "Huáng Tāo"],
  ["周斌", "Zhōu Bīn"],
  ["吴刚", "Wú Gāng"],
  ["徐亮", "Xú Liàng"],
  ["孙浩", "Sūn Hào"],
] as const;
export const women = [
  ["李丽", "Lǐ Lì"],
  ["王芳", "Wáng Fāng"],
  ["张静", "Zhāng Jìng"],
  ["刘娜", "Liú Nà"],
  ["陈红", "Chén Hóng"],
  ["杨雪", "Yáng Xuě"],
  ["赵敏", "Zhào Mǐn"],
  ["黄梅", "Huáng Méi"],
  ["周颖", "Zhōu Yǐng"],
  ["吴琳", "Wú Lín"],
  ["徐慧", "Xú Huì"],
  ["孙月", "Sūn Yuè"],
] as const;

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

function shuffle<T>(random: () => number, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

// Job counts between 7 and 9 that add up to 24, in job order.
function jobCounts(random: () => number): number[] {
  for (;;) {
    const a = jobRange.min + Math.floor(random() * (jobRange.max - jobRange.min + 1));
    const b = jobRange.min + Math.floor(random() * (jobRange.max - jobRange.min + 1));
    const c = 24 - a - b;
    if (c >= jobRange.min && c <= jobRange.max) return [a, b, c];
  }
}

function attempt(random: () => number): Attrs[] {
  const placeDeck = shuffle(
    random,
    places.flatMap((p) => Array<(typeof places)[number]>(perPlace).fill(p)),
  );
  const counts = jobCounts(random);
  const jobDeck = shuffle(
    random,
    jobs.flatMap((j, i) => Array<(typeof jobs)[number]>(counts[i] ?? 0).fill(j)),
  );
  return Array.from({ length: 24 }, (_, i) => {
    const owned = new Set(shuffle(random, things).slice(0, 1 + Math.floor(random() * 3)));
    return {
      gender: i < 12 ? "n.nande" : "n.nvde",
      job: jobDeck[i] ?? "n.laoshi",
      place: placeDeck[i] ?? "n.jia",
      dog: owned.has("dog"),
      cat: owned.has("cat"),
      phone: owned.has("phone"),
      book: owned.has("book"),
      computer: owned.has("computer"),
    };
  });
}

export function generateCharacters(seed: number): { characters: Character[]; attempts: number } {
  const random = rng(seed);
  for (let n = 1; n <= maxAttempts; n++) {
    const sets = attempt(random);
    if (checkInvariants(sets.map((attrs) => ({ attrs }))).length) continue;
    const characters = sets.map((attrs, i) => {
      const [name, namePinyin] = (i < 12 ? men[i] : women[i - 12]) ?? ["", ""];
      return {
        id: tonelessId(namePinyin),
        name,
        namePinyin,
        attrs,
        skin: pick(random, skins),
        hairStyle: pick(random, hairStyles),
      };
    });
    return { characters, attempts: n };
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
  console.error(`Seed ${seed}: valid set after ${attempts} attempt(s).`);
  console.log(JSON.stringify(characters, null, 2));
}
