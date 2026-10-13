// Platform spec 5.3: what the chie.parlaplay.games handoff page sends to /import,
// in Chi è?'s own shapes as its chie-launch build saved them in IndexedDB "chi-e".
// Rows have no language yet; /import adds "it". Loaded only by /import and the
// handoff page, so Zod stays out of every other page (9).
import { z } from "zod";

const Level = z.union([z.literal(1), z.literal(2)]);
// Longer than any real id or word, short enough that a crafted link cannot plant
// megabytes in one row, to be saved again on every write and uploaded at sign-in.
const maxId = 64;
const text = z.string().max(200);

export const ChieGameRow = z.strictObject({
  id: z.uuid(),
  seed: z.int(),
  level: Level,
  contentVersion: z.int().positive(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().optional(),
  result: z.enum(["won", "lost", "abandoned"]).optional(),
});
export type ChieGameRow = z.infer<typeof ChieGameRow>;

export const ChieReviewLogRow = z.strictObject({
  id: z.uuid(),
  gameId: z.uuid(),
  lexiconId: z.string().min(1).max(maxId),
  direction: z.enum(["recognize", "produce"]),
  rating: z.enum(["again", "hard", "good", "slip"]),
  detail: z.strictObject({ slot: text, given: text, expected: text, rule: text }).optional(),
  localDay: z.iso.date(),
  createdAt: z.iso.datetime(),
});
export type ChieReviewLogRow = z.infer<typeof ChieReviewLogRow>;

// The round in progress. Its state is the Italian engine's and is checked by the
// Italian module when it resumes the round (3.2 isResumable), not here.
export const ChieRound = z.strictObject({
  contentVersion: z.int().positive(),
  gameId: z.uuid(),
  state: z.record(z.string(), z.unknown()),
});
export type ChieRound = z.infer<typeof ChieRound>;

export const ChieOp = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("game"), row: ChieGameRow }),
  z.strictObject({ kind: z.literal("review"), row: ChieReviewLogRow }),
]);
export type ChieOp = z.infer<typeof ChieOp>;

// The decoded fragment. guest is the "guest" key, round the "round" key, and
// outboxes one entry per "outbox:{userId}" key that held rows.
export const Handoff = z.strictObject({
  v: z.literal(1),
  guest: z
    .strictObject({ games: z.array(ChieGameRow), reviewLog: z.array(ChieReviewLogRow) })
    .optional(),
  round: ChieRound.optional(),
  outboxes: z.array(z.strictObject({ userId: z.uuid(), ops: z.array(ChieOp) })).optional(),
});
export type Handoff = z.infer<typeof Handoff>;
