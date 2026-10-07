// Spec 3.5: placeholder art as flat shapes, one SVG per manifest file. Each layer
// must make its attribute obvious at about 80 px wide. Run it to rewrite public/art/:
//
//   node scripts/generate-placeholder-art.ts
//
// Final art replaces these files by name; nothing reads this script at runtime.
import { mkdirSync, writeFileSync } from "node:fs";
import { artViewBox } from "../src/content/art.ts";
import { hairStyles, skins } from "../src/content/schemas.ts";

type Sex = "m" | "f";
type Job = "laoshi" | "xuesheng" | "yisheng";
type Place = "jia" | "xuexiao" | "yiyuan" | "fandian";

function svg(body: string): string {
  const { width, height } = artViewBox;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n${body}\n</svg>\n`;
}
const lines = (...parts: string[]) => parts.map((p) => `  ${p}`).join("\n");

// Places: a flat backdrop plus one large icon in the top right corner.
const backdrop: Record<Place, string> = {
  jia: "#f6e7c8",
  xuexiao: "#d9ecd9",
  yiyuan: "#e2edf8",
  fandian: "#fbe1d5",
};
const placeIcon: Record<Place, string> = {
  // A house: walls, roof, door.
  jia: lines(
    `<path d="M74 16 L85 6 L96 16 Z" fill="#b5462f"/>`,
    `<rect x="76" y="16" width="18" height="13" fill="#fffaf0" stroke="#7a5230" stroke-width="1"/>`,
    `<rect x="83" y="21" width="5" height="8" fill="#7a5230"/>`,
  ),
  // A blackboard with chalk writing.
  xuexiao: lines(
    `<rect x="72" y="5" width="25" height="19" rx="1.5" fill="#2f5a3a" stroke="#8b5a2b" stroke-width="2"/>`,
    `<path d="M76 11 H90 M76 15 H86 M76 19 H92" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>`,
  ),
  // A red cross on a white disc.
  yiyuan: lines(
    `<circle cx="85" cy="15" r="11" fill="#ffffff" stroke="#d62828" stroke-width="1"/>`,
    `<path d="M82 7 H88 V12 H93 V18 H88 V23 H82 V18 H77 V12 H82 Z" fill="#d62828"/>`,
  ),
  // A bowl with chopsticks.
  fandian: lines(
    `<path d="M80 2 L92 14 M85 1 L95 13" stroke="#8b5a2b" stroke-width="1.8" stroke-linecap="round"/>`,
    `<path d="M73 14 H97 Q96 27 85 27 Q74 27 73 14 Z" fill="#2a6f97"/>`,
    `<path d="M75 17 H95" stroke="#ffffff" stroke-width="1.2"/>`,
  ),
};
const bg = (p: Place) =>
  svg(lines(`<rect width="100" height="120" rx="8" fill="${backdrop[p]}"/>`) + "\n" + placeIcon[p]);

// Bodies: men have square shoulders, women rounded ones. The outfit shows the job.
const shoulders: Record<Sex, string> = {
  m: "M8 120 L12 98 Q16 90 30 88 L70 88 Q84 90 88 98 L92 120 Z",
  f: "M10 120 Q12 94 34 89 Q50 104 66 89 Q88 94 90 120 Z",
};
const outfit: Record<Job, (s: Sex) => string> = {
  // Doctor: a white coat with lapels and a red cross badge.
  yisheng: (s) =>
    lines(
      `<path d="${shoulders[s]}" fill="#ffffff" stroke="#9aa5b1" stroke-width="1.2"/>`,
      `<path d="M42 89 L50 112 L58 89" fill="none" stroke="#9aa5b1" stroke-width="1.4"/>`,
      `<rect x="62" y="98" width="12" height="12" rx="1.5" fill="#ffffff" stroke="#9aa5b1" stroke-width="0.8"/>`,
      `<path d="M66.5 100 H69.5 V102.5 H72 V105.5 H69.5 V108 H66.5 V105.5 H64 V102.5 H66.5 Z" fill="#d62828"/>`,
    ),
  // Student: a blue school tracksuit with white stripes and backpack straps.
  xuesheng: (s) =>
    lines(
      `<path d="${shoulders[s]}" fill="#2a6fdb"/>`,
      `<path d="M50 90 V120" stroke="#ffffff" stroke-width="2"/>`,
      `<path d="M28 90 L24 120 M72 90 L76 120" stroke="#f2c94c" stroke-width="5"/>`,
    ),
  // Teacher: a dark jacket with a lanyard and badge.
  laoshi: (s) =>
    lines(
      `<path d="${shoulders[s]}" fill="#2b2d42"/>`,
      `<path d="M40 88 L50 100 L60 88 Z" fill="#e9ecef"/>`,
      `<path d="M41 89 L50 106 L59 89" fill="none" stroke="#e63946" stroke-width="1.6"/>`,
      `<rect x="45" y="105" width="10" height="12" rx="1" fill="#ffffff" stroke="#e63946" stroke-width="1"/>`,
    ),
};

// Face: head, ears, eyes, nose, mouth. Skin is variety only, never asked.
const skinFill: Record<(typeof skins)[number], string> = {
  s1: "#fde3cf",
  s2: "#f1c27d",
  s3: "#d9a066",
  s4: "#a8693f",
  s5: "#6b4226",
};
const face = (fill: string) =>
  svg(
    lines(
      `<rect x="43" y="74" width="14" height="16" fill="${fill}"/>`,
      `<ellipse cx="27" cy="56" rx="4" ry="6" fill="${fill}"/>`,
      `<ellipse cx="73" cy="56" rx="4" ry="6" fill="${fill}"/>`,
      `<ellipse cx="50" cy="54" rx="23" ry="28" fill="${fill}"/>`,
      `<ellipse cx="40" cy="53" rx="2.6" ry="3.2" fill="#1a1a1a"/>`,
      `<ellipse cx="60" cy="53" rx="2.6" ry="3.2" fill="#1a1a1a"/>`,
      `<path d="M50 57 L47 65 L52 65" fill="none" stroke="#00000055" stroke-width="1.4" stroke-linecap="round"/>`,
      `<path d="M43 72 Q50 76 57 72" fill="none" stroke="#8a2f2f" stroke-width="2" stroke-linecap="round"/>`,
    ),
  );

// Hair: dark, with three styles per sex. Variety only, never asked.
const hairFill = "#1f1a17";
const cap = "M26 52 Q24 26 50 24 Q76 26 74 52 Q72 40 64 36 Q50 32 36 36 Q28 40 26 52 Z";
const hairPaths: Record<Sex, Record<(typeof hairStyles)[number], string>> = {
  m: {
    h1: cap, // short crop
    h2: `${cap} M30 36 Q44 22 70 34 Q56 30 42 40 Z`, // side part with a sweep
    h3: "M27 46 L28 30 L34 34 L38 22 L44 30 L50 20 L56 30 L62 22 L66 34 L72 30 L73 46 Q66 36 50 34 Q34 36 27 46 Z", // spiky
  },
  f: {
    h1: `${cap} M26 44 Q20 70 18 104 L30 104 Q28 76 31 52 Z M74 44 Q80 70 82 104 L70 104 Q72 76 69 52 Z`, // long
    h2: `${cap} M26 44 Q22 62 24 78 L33 78 Q29 64 31 52 Z M74 44 Q78 62 76 78 L67 78 Q71 64 69 52 Z`, // bob
    h3: `${cap} M38 8 A12 10 0 1 1 62 8 A12 10 0 1 1 38 8 Z`, // bun on top
  },
};
const hair = (s: Sex, h: (typeof hairStyles)[number]) =>
  svg(lines(`<path d="${hairPaths[s][h]}" fill="${hairFill}"/>`));

// Pets and things always sit in the same place, so an empty spot is visibly empty.
const book = svg(
  lines(
    `<rect x="6" y="80" width="18" height="16" rx="1" fill="#c0392b" stroke="#6d1f17" stroke-width="1"/>`,
    `<rect x="9" y="83" width="12" height="4" fill="#f9e79f"/>`,
    `<path d="M6 94 H24" stroke="#ffffff" stroke-width="1.4"/>`,
  ),
);
const phone = svg(
  lines(
    `<rect x="79" y="78" width="12" height="20" rx="2.5" fill="#111111"/>`,
    `<rect x="81" y="81" width="8" height="13" rx="1" fill="#4cc9f0"/>`,
    `<circle cx="85" cy="96" r="0.9" fill="#888888"/>`,
  ),
);
const computer = svg(
  lines(
    `<rect x="30" y="112" width="40" height="8" fill="#8b5a2b"/>`,
    `<rect x="37" y="96" width="26" height="16" rx="1.5" fill="#3a3a3a"/>`,
    `<rect x="39.5" y="98" width="21" height="11" fill="#90e0ef"/>`,
  ),
);
const dog = svg(
  lines(
    `<ellipse cx="14" cy="111" rx="11" ry="6" fill="#c68642"/>`,
    `<circle cx="22" cy="102" r="6" fill="#c68642"/>`,
    `<ellipse cx="18" cy="100" rx="2.2" ry="5" fill="#7a4a1d"/>`,
    `<circle cx="24" cy="101" r="1" fill="#111111"/>`,
    `<circle cx="27.5" cy="103.5" r="1.3" fill="#111111"/>`,
    `<path d="M4 108 Q0 102 3 100" fill="none" stroke="#c68642" stroke-width="2.4" stroke-linecap="round"/>`,
  ),
);
const cat = svg(
  lines(
    `<ellipse cx="86" cy="112" rx="10" ry="6" fill="#6c757d"/>`,
    `<circle cx="78" cy="103" r="6" fill="#6c757d"/>`,
    `<path d="M73 100 L74 93 L78 97 Z M83 100 L82 93 L78 97 Z" fill="#6c757d"/>`,
    `<circle cx="76" cy="102" r="1" fill="#f2c94c"/>`,
    `<circle cx="80" cy="102" r="1" fill="#f2c94c"/>`,
    `<path d="M96 110 Q100 102 96 98" fill="none" stroke="#6c757d" stroke-width="2.4" stroke-linecap="round"/>`,
  ),
);

export function placeholderArt(): Record<string, string> {
  const places: Place[] = ["jia", "xuexiao", "yiyuan", "fandian"];
  const jobs: Job[] = ["laoshi", "xuesheng", "yisheng"];
  const sexes: Sex[] = ["m", "f"];
  return {
    ...Object.fromEntries(places.map((p) => [`bg-${p}.svg`, bg(p)])),
    ...Object.fromEntries(
      sexes.flatMap((s) => jobs.map((j) => [`body-${s}-${j}.svg`, svg(outfit[j](s))])),
    ),
    ...Object.fromEntries(skins.map((s) => [`face-${s}.svg`, face(skinFill[s])])),
    ...Object.fromEntries(
      sexes.flatMap((s) => hairStyles.map((h) => [`hair-${s}-${h}.svg`, hair(s, h)])),
    ),
    "book.svg": book,
    "phone.svg": phone,
    "computer.svg": computer,
    "dog.svg": dog,
    "cat.svg": cat,
  };
}

export const artDir = new URL("../public/art/", import.meta.url).pathname;

if (import.meta.main) {
  mkdirSync(artDir, { recursive: true });
  const files = placeholderArt();
  for (const [name, text] of Object.entries(files)) writeFileSync(`${artDir}${name}`, text);
  console.log(`Wrote ${Object.keys(files).length} files to public/art/`);
}
