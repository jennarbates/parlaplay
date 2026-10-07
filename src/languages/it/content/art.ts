import type { Character } from "./schemas.ts";

// Spec 3.5: the art manifest. Every card is these layers stacked in z order, all
// drawn on the same canvas, so the picture can never disagree with the data.
// Files live in public/art/ and can be replaced by final art with the same names.

export const artViewBox = { width: 100, height: 120 } as const;

export const hairColors = ["biondo", "castano", "nero", "rosso", "bianco"] as const;
export const hairLengths = ["corto", "lungo"] as const;
export const eyeColors = ["azzurro", "marrone", "verde"] as const;
export const skins = ["s1", "s2", "s3", "s4", "s5"] as const;

// Every file the manifest names, in z order of their layer.
export const artFiles: string[] = [
  "bg.svg",
  "body-m.svg",
  "body-f.svg",
  ...skins.map((s) => `face-${s}.svg`),
  ...eyeColors.map((c) => `eyes-${c}.svg`),
  ...hairColors.map((c) => `beard-${c}.svg`),
  ...hairColors.map((c) => `mustache-${c}.svg`),
  ...hairColors.flatMap((c) => hairLengths.map((l) => `hair-${c}-${l}.svg`)),
  "glasses.svg",
  "hat.svg",
];

type FaceInput = Pick<Character, "attrs" | "skin">;

const word = (id: string) => id.slice(id.indexOf(".") + 1); // "adj.castano" → "castano"

// The layer files for one character, bottom to top (spec 3.5 z order). Only
// names from the manifest, so new art dropped in with the same names just works.
export function layersFor({ attrs, skin }: FaceInput): string[] {
  const color = word(attrs.hairColor);
  return [
    "bg.svg",
    attrs.gender === "n.uomo" ? "body-m.svg" : "body-f.svg",
    `face-${skin}.svg`,
    `eyes-${word(attrs.eyeColor)}.svg`,
    ...(attrs.beard ? [`beard-${color}.svg`] : []),
    ...(attrs.mustache ? [`mustache-${color}.svg`] : []),
    `hair-${color}-${word(attrs.hairLength)}.svg`,
    ...(attrs.glasses ? ["glasses.svg"] : []),
    ...(attrs.hat ? ["hat.svg"] : []),
  ];
}
