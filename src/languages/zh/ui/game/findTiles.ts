// zh-desktop.md ZS 3 and 7.2: finding builder tiles by what the learner types.
// Pure: no imports, and nothing read but the arguments.

export type Tile = { id: string; hanzi: string; pinyin: string }; // one of the 21 builder tiles

// Pinyin as typed without tones: lowercase, tone marks and tone numbers dropped,
// spaces and apostrophes dropped, and v for ü. "nǚ de", "nu de", "nv3de" and
// "NUDE" all give "nude".
export function pinyinKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\d\s']/g, "")
    .replaceAll("v", "u");
}

const cjk = /[㐀-鿿]/;

// The tiles a query finds, in builder order: by characters when the query holds
// any (typed with an IME), else by the start of their pinyin. Empty for an empty
// query.
export function findTiles(query: string, tiles: readonly Tile[]): Tile[] {
  const typed = query.trim();
  if (cjk.test(typed)) return tiles.filter((t) => t.hanzi.startsWith(typed));
  const key = pinyinKey(typed);
  return key ? tiles.filter((t) => pinyinKey(t.pinyin).startsWith(key)) : [];
}

// ZD16: an IME commits a phrase, not a word. If the text is exactly a run of
// tiles (longest tile first at each place, ignoring ？ and spaces), the tiles in
// order; otherwise null. Nothing is parsed: it is the tray the learner could have
// clicked, and the engine checks it as usual.
export function splitTiles(text: string, tiles: readonly Tile[]): Tile[] | null {
  const rest = text.replace(/[\s？?]/g, "");
  if (!rest) return null;
  const byLength = [...tiles].sort((a, b) => b.hanzi.length - a.hanzi.length);
  const run: Tile[] = [];
  for (let at = 0; at < rest.length;) {
    const tile = byLength.find((t) => rest.startsWith(t.hanzi, at));
    if (!tile) return null;
    run.push(tile);
    at += tile.hanzi.length;
  }
  return run;
}
