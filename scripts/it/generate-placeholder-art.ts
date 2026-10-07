// Spec 3.5, D9, D26: placeholder art as flat shapes, one SVG per manifest file.
// Each layer must make its attribute obvious at about 80 px wide. Run it to
// rewrite public/art/:
//
//   node scripts/generate-placeholder-art.ts
//
// Final art replaces these files by name; nothing reads this script at runtime.
import { mkdirSync, writeFileSync } from "node:fs";
import { artViewBox, eyeColors, hairColors, skins } from "../../src/languages/it/content/art.ts";

type HairColor = (typeof hairColors)[number];

// Head geometry shared by every layer.
const head = { cx: 50, cy: 54, rx: 23, ry: 28 }; // top y 26, chin y 82
const eyeY = 52;
const eyeX = [40, 60] as const;

const hairFill: Record<HairColor, string> = {
  biondo: "#f2c94c",
  castano: "#8b5a2b",
  nero: "#1f1f1f",
  rosso: "#d9481c",
  bianco: "#f4f4f4",
};
// White hair needs an outline to show on light skin and the background.
const hairStroke = (c: HairColor) => (c === "bianco" ? ` stroke="#9a9a9a" stroke-width="1.2"` : "");
// Facial hair sits on skin, so every color gets an outline to read on every skin tone.
const facialStroke = (c: HairColor) =>
  ` stroke="${c === "bianco" ? "#8a8a8a" : "#00000080"}" stroke-width="1.2" stroke-linejoin="round"`;

const skinFill: Record<(typeof skins)[number], string> = {
  s1: "#fde3cf",
  s2: "#f1c27d",
  s3: "#d9a066",
  s4: "#a8693f",
  s5: "#6b4226",
};

const irisFill: Record<(typeof eyeColors)[number], string> = {
  azzurro: "#2f8fe0",
  marrone: "#6b3e1a",
  verde: "#2e9e45",
};

function svg(body: string): string {
  const { width, height } = artViewBox;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n${body}\n</svg>\n`;
}

const bg = svg(`  <rect width="100" height="120" rx="8" fill="#e8eef5"/>`);

// Men: square shoulders, collar and tie. Women: rounded shoulders, scoop neck, necklace.
const bodyM = svg(
  [
    `  <path d="M8 120 L12 98 Q16 90 30 88 L70 88 Q84 90 88 98 L92 120 Z" fill="#3d5a80"/>`,
    `  <path d="M40 88 L50 100 L60 88 Z" fill="#ffffff"/>`,
    `  <path d="M47 92 L53 92 L55 112 L50 117 L45 112 Z" fill="#b23a48"/>`,
  ].join("\n"),
);
const bodyF = svg(
  [
    `  <path d="M10 120 Q12 94 34 89 Q50 104 66 89 Q88 94 90 120 Z" fill="#c2577a"/>`,
    `  <path d="M38 92 Q50 104 62 92" fill="none" stroke="#f7d774" stroke-width="2"/>`,
    `  <circle cx="50" cy="100" r="2.4" fill="#f7d774"/>`,
  ].join("\n"),
);

function face(fill: string): string {
  const { cx, cy, rx, ry } = head;
  return svg(
    [
      `  <rect x="43" y="74" width="14" height="18" fill="${fill}"/>`,
      `  <ellipse cx="${cx - rx}" cy="56" rx="4" ry="6" fill="${fill}"/>`,
      `  <ellipse cx="${cx + rx}" cy="56" rx="4" ry="6" fill="${fill}"/>`,
      `  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`,
      `  <path d="M50 57 L47 65 L52 65" fill="none" stroke="#00000055" stroke-width="1.4" stroke-linecap="round"/>`,
      `  <path d="M43 72 Q50 76 57 72" fill="none" stroke="#8a2f2f" stroke-width="2" stroke-linecap="round"/>`,
    ].join("\n"),
  );
}

// Larger than life so the iris color reads at card size.
function eyes(iris: string): string {
  return svg(
    eyeX
      .map((x) =>
        [
          `  <ellipse cx="${x}" cy="${eyeY}" rx="7.5" ry="6" fill="#ffffff" stroke="#00000040" stroke-width="0.8"/>`,
          `  <circle cx="${x}" cy="${eyeY}" r="4.6" fill="${iris}"/>`,
          `  <circle cx="${x}" cy="${eyeY}" r="1.8" fill="#111111"/>`,
          `  <circle cx="${x + 1.5}" cy="${eyeY - 1.5}" r="0.9" fill="#ffffff"/>`,
        ].join("\n"),
      )
      .join("\n"),
  );
}

// Covers the jaw and chin but stops below the mouth, so a beard without a
// mustache leaves a clear gap under the nose.
function beard(c: HairColor): string {
  return svg(
    `  <path d="M27 58 Q28 76 38 85 Q50 94 62 85 Q72 76 73 58 Q70 70 62 76 Q50 81 38 76 Q30 70 27 58 Z" fill="${hairFill[c]}"${facialStroke(c)}/>`,
  );
}

function mustache(c: HairColor): string {
  return svg(
    `  <path d="M35 71 Q39 62 50 65.5 Q61 62 65 71 Q58 70.5 50 72 Q42 70.5 35 71 Z" fill="${hairFill[c]}"${facialStroke(c)}/>`,
  );
}

// Short hair: a cap over the top of the head. Long hair: the same cap plus
// panels down past the shoulders on both sides.
function hair(c: HairColor, length: "corto" | "lungo"): string {
  const top = `M26 52 Q24 26 50 24 Q76 26 74 52 Q72 40 64 36 Q50 32 36 36 Q28 40 26 52 Z`;
  const sides = `M26 44 Q20 70 18 104 L30 104 Q28 76 31 52 Z M74 44 Q80 70 82 104 L70 104 Q72 76 69 52 Z`;
  const d = length === "corto" ? top : `${top} ${sides}`;
  return svg(`  <path d="${d}" fill="${hairFill[c]}"${hairStroke(c)}/>`);
}

const glasses = svg(
  [
    ...eyeX.map(
      (x) =>
        `  <circle cx="${x}" cy="${eyeY}" r="9" fill="none" stroke="#1a1a1a" stroke-width="2.6"/>`,
    ),
    `  <path d="M49 51 Q50 49 51 51" fill="none" stroke="#1a1a1a" stroke-width="2.6"/>`,
    `  <path d="M31 51 L26 49 M69 51 L74 49" stroke="#1a1a1a" stroke-width="2.6" stroke-linecap="round"/>`,
  ].join("\n"),
);

// Drawn high: the brim sits above the hairline, so short hair always shows a
// band of color below it.
const hat = svg(
  [
    `  <rect x="33" y="5" width="34" height="17" rx="3" fill="#2b2d42"/>`,
    `  <rect x="33" y="16" width="34" height="4" fill="#ef233c"/>`,
    `  <rect x="22" y="20" width="56" height="5" rx="2.5" fill="#2b2d42"/>`,
  ].join("\n"),
);

export function placeholderArt(): Record<string, string> {
  return {
    "bg.svg": bg,
    "body-m.svg": bodyM,
    "body-f.svg": bodyF,
    ...Object.fromEntries(skins.map((s) => [`face-${s}.svg`, face(skinFill[s])])),
    ...Object.fromEntries(eyeColors.map((c) => [`eyes-${c}.svg`, eyes(irisFill[c])])),
    ...Object.fromEntries(hairColors.map((c) => [`beard-${c}.svg`, beard(c)])),
    ...Object.fromEntries(hairColors.map((c) => [`mustache-${c}.svg`, mustache(c)])),
    ...Object.fromEntries(
      hairColors.flatMap((c) =>
        (["corto", "lungo"] as const).map((l) => [`hair-${c}-${l}.svg`, hair(c, l)]),
      ),
    ),
    "glasses.svg": glasses,
    "hat.svg": hat,
  };
}

export const artDir = new URL("../../public/art/it/", import.meta.url).pathname;

if (import.meta.main) {
  mkdirSync(artDir, { recursive: true });
  const files = placeholderArt();
  for (const [name, text] of Object.entries(files)) writeFileSync(`${artDir}${name}`, text);
  console.log(`Wrote ${Object.keys(files).length} files to public/art/it/`);
}
