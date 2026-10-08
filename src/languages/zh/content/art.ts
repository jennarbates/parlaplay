import { hairStyles, jobs, places, skins, type Character } from "./schemas.ts";

// Spec 3.5: the art manifest. Every card is these layers stacked in z order, all
// drawn on the same canvas, so the picture can never disagree with the data.
// Files live in public/art/zh/ and can be replaced by final art with the same names.

export const artViewBox = { width: 100, height: 120 } as const;

const word = (id: string) => id.slice(id.indexOf(".") + 1); // "n.xuexiao" → "xuexiao"
const sexes = ["m", "f"] as const;

export const placeWords = places.map(word);
export const jobWords = jobs.map(word);

// Every file the manifest names, in z order of their layer.
export const artFiles: string[] = [
  ...placeWords.map((p) => `bg-${p}.svg`),
  ...sexes.flatMap((s) => jobWords.map((j) => `body-${s}-${j}.svg`)),
  ...skins.map((s) => `face-${s}.svg`),
  ...sexes.flatMap((s) => hairStyles.map((h) => `hair-${s}-${h}.svg`)),
  "book.svg",
  "phone.svg",
  "computer.svg",
  "dog.svg",
  "cat.svg",
];

type FaceInput = Pick<Character, "attrs" | "skin" | "hairStyle">;

// The layer files for one character, bottom to top (spec 3.5 z order). Only
// names from the manifest, so new art dropped in with the same names just works.
export function layersFor({ attrs, skin, hairStyle }: FaceInput): string[] {
  const sex = attrs.gender === "n.nande" ? "m" : "f";
  return [
    `bg-${word(attrs.place)}.svg`,
    `body-${sex}-${word(attrs.job)}.svg`,
    `face-${skin}.svg`,
    `hair-${sex}-${hairStyle}.svg`,
    ...(attrs.book ? ["book.svg"] : []),
    ...(attrs.phone ? ["phone.svg"] : []),
    ...(attrs.computer ? ["computer.svg"] : []),
    ...(attrs.dog ? ["dog.svg"] : []),
    ...(attrs.cat ? ["cat.svg"] : []),
  ];
}
