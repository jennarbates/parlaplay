// Platform spec 5.3: the decisions of the chie.parlaplay.games handoff page, with
// no DOM or storage so they can be tested directly. It sends what Chi è? saved in
// IndexedDB "chi-e" to parlaplay.games/import, and never changes it.
import type { Handoff } from "../../src/core/handoff/schema.ts";

export const messages = {
  moving: "Chi è? has moved to parlaplay.games. Bringing your progress…",
  tooLarge:
    "Your progress is too large to move automatically. Email privacy@parlaplay.games and we'll move it for you.",
} as const;

// /play maps to /it/play, /progress to /it/progress, anything else to /it.
export function mappedPath(pathname: string): "/it" | "/it/play" | "/it/progress" {
  const path = pathname.replace(/\/+$/, "");
  return path === "/play" ? "/it/play" : path === "/progress" ? "/it/progress" : "/it";
}

const rows = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// The handoff for what the "kv" store holds, or null when there is nothing to
// bring: no guest rows, no round, no unsynced rows. Only "guest", "round" and
// "outbox:{userId}" are read. A signed-in player's own copy ("user:{userId}") is
// already on the server, so it stays behind. Values go as they are; /import
// validates them.
export function buildHandoff(kv: ReadonlyMap<string, unknown>): Handoff | null {
  const saved = kv.get("guest") as { games?: unknown; reviewLog?: unknown } | undefined;
  const guest = { games: rows(saved?.games), reviewLog: rows(saved?.reviewLog) };
  const hasGuest = guest.games.length > 0 || guest.reviewLog.length > 0;
  const round = kv.get("round") ?? undefined;
  const outboxes = [...kv]
    .filter(([key, ops]) => key.startsWith("outbox:") && rows(ops).length > 0)
    .map(([key, ops]) => ({ userId: key.slice("outbox:".length), ops: rows(ops) }));
  if (!hasGuest && round === undefined && outboxes.length === 0) return null;
  return {
    v: 1,
    ...(hasGuest && { guest }),
    ...(round !== undefined && { round }),
    ...(outboxes.length > 0 && { outboxes }),
  } as Handoff; // unchecked here by design
}

// Where the page goes. `site` is parlaplay.games' origin, with no trailing slash.
export const redirectUrl = (site: string, pathname: string) => `${site}${mappedPath(pathname)}`;
export const importUrl = (site: string, pathname: string, data: string) =>
  `${site}/import#data=${data}&next=${mappedPath(pathname)}`;
