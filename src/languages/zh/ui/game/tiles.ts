import { content } from "../../content/index.ts";
import type { LexiconEntry } from "../../content/schemas.ts";
import type { Tile } from "./findTiles.ts";

const entry = new Map(content.lexicon.map((e) => [e.id, e]));
const pick = (ids: string[]) => ids.flatMap((id) => entry.get(id) ?? []);

// Spec 8.1, Level 2: pronouns, verbs and 吗 in one row (7 tiles), then the 14
// nouns in three rows. Order is free (D9): the tray holds tiles as tapped.
export const tileRows: { label: string; tiles: LexiconEntry[] }[] = [
  {
    label: "Who, verbs and 吗",
    tiles: pick(["pr.ta.m", "pr.ta.f", "pr.ni", "v.shi", "v.you", "v.zai", "pt.ma"]),
  },
  { label: "People", tiles: pick(["n.nande", "n.nvde", "n.laoshi", "n.xuesheng", "n.yisheng"]) },
  { label: "Pets and things", tiles: pick(["n.gou", "n.mao", "n.shouji", "n.shu", "n.diannao"]) },
  { label: "Places", tiles: pick(["n.jia", "n.xuexiao", "n.yiyuan", "n.fandian"]) },
];

export const maxTray = 6;
export const tileEntry = (id: string) => entry.get(id);

// The 21 tiles in builder order, as the find field searches them (zh-desktop.md ZS 7.2).
export const builderTiles: Tile[] = tileRows.flatMap((row) =>
  row.tiles.map(({ id, hanzi, pinyin }) => ({ id, hanzi, pinyin })),
);
