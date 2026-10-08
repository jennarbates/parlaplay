// Spec 4: the only randomness in the engine, all of it from the seed.

export type Random = () => number;

// mulberry32: small, fast, and the same on every device.
export function seeded(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickOne<T>(random: Random, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pickOne from an empty list");
  return items[Math.floor(random() * items.length)] as T;
}

// Fisher–Yates, returning a new array.
export function shuffled<T>(random: Random, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
