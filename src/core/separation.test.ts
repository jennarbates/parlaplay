// PLAY-026, platform spec 3.4.1, 3.4.2 and 10.2 (Separation): random mixes of it and
// zh rows go through storage, sync merge, replay and the Progress selectors, and
// each language sees only its own rows, each review pointing at a game of its own.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import fc from "fast-check";
import { describe, expect, test, vi } from "vitest";
import { cardIds as itCardIds } from "../languages/it/cards.ts";
import { content as itContent } from "../languages/it/content/index.ts";
import { groupMistakes as itMistakes } from "../languages/it/ui/mistakes.ts";
import { progressStats } from "../languages/it/ui/progressStats.ts";
import { cardIds as zhCardIds } from "../languages/zh/cards.ts";
import { content as zhContent } from "../languages/zh/content/index.ts";
import { groupMistakes as zhMistakes } from "../languages/zh/ui/mistakes.ts";
import { LanguageCode } from "./languages.ts";
import { localDay } from "./services/localDay.ts";
import { cardKey, replay } from "./services/srs.ts";
import type { GameRow, GuestData, ReviewLogRow } from "./store/progressStore.ts";

// A fake Supabase holding one account's rows of every language, recording uploads.
const db: { games: unknown[]; review_log: unknown[] } = { games: [], review_log: [] };
const upserts: { table: string; rows: unknown[] }[] = [];
vi.mock("./services/supabase.ts", () => ({
  supabase: {
    from: (table: string) => ({
      upsert: async (rows: unknown[]) => {
        upserts.push({ table, rows });
        return { error: null };
      },
      select: () => ({
        order: () => ({
          range: async (from: number, to: number) => ({
            data: (table === "games" ? db.games : db.review_log).slice(from, to + 1),
            error: null,
          }),
        }),
      }),
    }),
  },
}));
const { progressSaved, progressStore, storageKeyFor } = await import("./store/progressStore.ts");
const { gameToDb, reviewToDb, syncSaved, useSyncStore } = await import("./services/sync.ts");
const { syncNow } = await import("./store/account.ts");
const { read, resetForTests, write } = await import("./services/storage.ts");

const codes = LanguageCode.options;
const stores = Object.fromEntries(codes.map((c) => [c, progressStore(c)])) as Record<
  LanguageCode,
  ReturnType<typeof progressStore>
>;
const user = "00000000-0000-4000-8000-00000000000a";
const start = Date.parse("2026-10-01T08:00:00Z");
const now = new Date("2026-10-22T12:00:00Z");
const runs = { numRuns: 40 };

// Each language's ids as its rows carry them (lexicon ids, and Shéi's grammar ids on
// slips). They are disjoint (3.4.3), so a row that crossed over shows a foreign id.
const ids: Record<LanguageCode, readonly string[]> = {
  it: itContent.lexicon.map((e) => e.id),
  zh: [...zhContent.lexicon, ...zhContent.grammar].map((e) => e.id),
};
const cardIdsOf: Record<LanguageCode, readonly string[]> = { it: itCardIds(), zh: zhCardIds() };
const groupMistakes = { it: itMistakes, zh: zhMistakes };

// A language the app doesn't have, as a newer version of the app might write it.
const fr = "fr" as string as LanguageCode;

const minutes = (from: number, n: number) => new Date(from + n * 60_000);

const gameArb = (language: LanguageCode): fc.Arbitrary<GameRow> =>
  fc
    .record({
      id: fc.uuid(),
      seed: fc.integer(),
      level: fc.constantFrom(1 as const, 2 as const),
      contentVersion: fc.integer({ min: 1, max: 3 }),
      at: fc.integer({ min: 0, max: 60 * 24 * 20 }),
      result: fc.option(fc.constantFrom("won" as const, "lost" as const, "abandoned" as const), {
        nil: undefined,
      }),
    })
    .map(({ at, result, ...game }) => ({
      ...game,
      language,
      startedAt: minutes(start, at).toISOString(),
      ...(result && { endedAt: minutes(start, at + 15).toISOString(), result }),
    }));

// A review row of one of this language's games, with one of its ids.
const reviewArb = (language: LanguageCode, games: GameRow[]): fc.Arbitrary<ReviewLogRow> =>
  fc
    .record({
      id: fc.uuid(),
      game: fc.constantFrom(...games),
      lexiconId: fc.constantFrom(...ids[language]),
      direction: fc.constantFrom("recognize" as const, "produce" as const),
      rating: fc.constantFrom("again" as const, "hard" as const, "good" as const, "slip" as const),
      after: fc.integer({ min: 0, max: 60 * 24 * 5 }),
      detail: fc.option(
        fc.record({
          slot: fc.constantFrom("art", "pron"),
          given: fc.constantFrom("il", "la", "他", "她"),
          expected: fc.constantFrom("il", "la", "他", "她"),
          rule: fc.constantFrom("art.gender", "pron.gender"),
        }),
        { nil: undefined },
      ),
    })
    .map(({ game, after, detail, ...row }) => {
      const at = minutes(Date.parse(game.startedAt), after);
      return {
        ...row,
        language,
        gameId: game.id,
        ...(detail && { detail }),
        localDay: localDay(at),
        createdAt: at.toISOString(),
      };
    });

const languageArb = (language: LanguageCode): fc.Arbitrary<GuestData> =>
  fc
    .uniqueArray(gameArb(language), { selector: (g) => g.id, minLength: 1, maxLength: 4 })
    .chain((games) =>
      fc
        .uniqueArray(reviewArb(language, games), {
          selector: (r) => r.id,
          minLength: 1,
          maxLength: 12,
        })
        .map((reviewLog) => ({ games, reviewLog })),
    );

const shuffled = <T>(rows: T[]) => fc.shuffledSubarray(rows, { minLength: rows.length });

// Every language's rows, mixed together in a random order.
const worldArb: fc.Arbitrary<GuestData> = fc.tuple(...codes.map(languageArb)).chain((parts) =>
  fc.record({
    games: shuffled(parts.flatMap((p) => p.games)),
    reviewLog: shuffled(parts.flatMap((p) => p.reviewLog)),
  }),
);

const only = (world: GuestData, code: LanguageCode): GuestData => ({
  games: world.games.filter((g) => g.language === code),
  reviewLog: world.reviewLog.filter((r) => r.language === code),
});

// The world's first game and review, relabelled as a language the app doesn't have.
const foreign = (world: GuestData): GuestData => ({
  games: world.games.slice(0, 1).map((g) => ({ ...g, id: `fr-${g.id}`, language: fr })),
  reviewLog: world.reviewLog.slice(0, 1).map((r) => ({ ...r, id: `fr-${r.id}`, language: fr })),
});

const byId = <T extends { id: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.id.localeCompare(b.id));
const byKey = <T extends { key: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.key.localeCompare(b.key));

// What a language's Progress screen derives from its store: the Due list (FSRS
// replay), the Mistakes tab and, for Chi è?, the dashboard totals. Orders that
// depend only on arrival order are normalised.
function view(code: LanguageCode, data: GuestData) {
  const due = byKey(
    [...replay(cardIdsOf[code], data.reviewLog).values()]
      .filter((c) => c.reviews > 0)
      .map((c) => ({
        key: cardKey(c.lexiconId, c.direction),
        lexiconId: c.lexiconId,
        reviews: c.reviews,
        due: c.card.due.toISOString(),
      })),
  );
  const mistakes = groupMistakes[code](data.reviewLog)
    .map((g) => ({
      ...g,
      pairs: [...g.pairs].sort((a, b) =>
        `${a.given}|${a.expected}`.localeCompare(`${b.given}|${b.expected}`),
      ),
    }))
    .sort((a, b) => a.lexiconId.localeCompare(b.lexiconId));
  return { due, mistakes, stats: code === "it" ? progressStats(data, now) : null };
}

// 3.4.1 and 3.4.2 for one language's data, against the rows the world gave it.
function expectOnlyOwn(code: LanguageCode, data: GuestData, world: GuestData) {
  const own = only(world, code);
  expect(byId(data.games)).toEqual(byId(own.games));
  expect(byId(data.reviewLog)).toEqual(byId(own.reviewLog));

  const seen = view(code, data);
  expect(seen).toEqual(view(code, own));
  for (const id of [...seen.due.map((c) => c.lexiconId), ...seen.mistakes.map((g) => g.lexiconId)])
    expect(ids[code]).toContain(id);

  const games = new Map(data.games.map((g) => [g.id, g]));
  for (const r of data.reviewLog) expect(games.get(r.gameId)?.language).toBe(code);
}

async function fresh(owner: string) {
  await progressSaved(); // nothing from the last run lands in this run's database
  await syncSaved();
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  upserts.length = 0;
  db.games = [];
  db.review_log = [];
  for (const c of codes) stores[c].setState({ games: [], reviewLog: [], loaded: false, owner });
  await useSyncStore.getState().load(owner === "guest" ? null : user);
}

describe("the checks themselves", () => {
  test("each language's ids are its own (3.4.3), so a crossed row is visible", () => {
    const [it, zh] = [new Set(ids.it), new Set(ids.zh)];
    expect([...it].filter((id) => zh.has(id))).toEqual([]);
  });

  test("a store holding another language's row fails the check", () => {
    for (const world of fc.sample(worldArb, { numRuns: 3, seed: 26 }))
      for (const c of codes) {
        expect(() => expectOnlyOwn(c, world, world)).toThrow();
        expect(() => expectOnlyOwn(c, only(world, c), world)).not.toThrow();
      }
  });
});

describe("separation by language (3.4.1, 3.4.2)", () => {
  test("storage: whatever a key holds, each language loads only its own rows", async () => {
    await fc.assert(
      fc.asyncProperty(worldArb, async (world) => {
        await fresh("guest");
        // Every per-language key holds every language's rows, plus one the app
        // doesn't have: damaged data, or a bug elsewhere that wrote the wrong key.
        const extra = foreign(world);
        const mixed = {
          games: [...world.games, ...extra.games],
          reviewLog: [...world.reviewLog, ...extra.reviewLog],
        };
        for (const owner of ["guest", user])
          for (const c of codes) await write(storageKeyFor(owner, c), mixed);

        for (const c of codes) await stores[c].getState().hydrate();
        for (const c of codes) expectOnlyOwn(c, stores[c].getState(), world);

        for (const c of codes) await stores[c].getState().switchOwner(user);
        for (const c of codes) expectOnlyOwn(c, stores[c].getState(), world);
      }),
      runs,
    );
  });

  test("storage: rows recorded in both languages, interleaved, are saved under their own keys", async () => {
    await fc.assert(
      fc.asyncProperty(worldArb, fc.boolean(), async (world, signedIn) => {
        const owner = signedIn ? user : "guest";
        await fresh(owner);
        for (const c of codes) stores[c].setState({ loaded: true });

        // As each game does it: open the game, append its rows, close it. The
        // world's order switches between languages at random.
        for (const g of world.games)
          stores[g.language].getState().recordGameStart({
            id: g.id,
            seed: g.seed,
            level: g.level,
            contentVersion: g.contentVersion,
            startedAt: g.startedAt,
          });
        for (const r of world.reviewLog) stores[r.language].getState().appendRows([r]);
        for (const g of world.games)
          if (g.result && g.endedAt)
            stores[g.language].getState().recordGameEnd(g.id, g.result, new Date(g.endedAt));
        await progressSaved();
        await syncSaved();

        for (const c of codes) {
          expectOnlyOwn(c, stores[c].getState(), world);
          const saved = await read<GuestData>(storageKeyFor(owner, c));
          expectOnlyOwn(c, saved ?? { games: [], reviewLog: [] }, world);
        }

        // The outbox is shared: signed in, it holds every review row with its own
        // language, after a game row of that language (3.4.2). A guest has none.
        const outbox = useSyncStore.getState().outbox;
        if (!signedIn) {
          expect(outbox).toEqual([]);
          return;
        }
        const queued = new Map<string, LanguageCode>();
        const reviews: ReviewLogRow[] = [];
        for (const op of outbox) {
          if (op.kind === "game") queued.set(op.row.id, op.row.language);
          else {
            expect(queued.get(op.row.gameId)).toBe(op.row.language);
            reviews.push(op.row);
          }
        }
        expect(byId(reviews)).toEqual(byId(world.reviewLog));
      }),
      runs,
    );
  });

  test("sync merge and replay: a pull gives each language only its own rows and cards", async () => {
    await fc.assert(
      fc.asyncProperty(worldArb, async (world) => {
        await fresh(user);
        for (const c of codes) stores[c].setState({ loaded: true });
        const extra = foreign(world);
        db.games = [...world.games, ...extra.games].map((g) => gameToDb(user, g));
        db.review_log = [...world.reviewLog, ...extra.reviewLog].map((r) => reviewToDb(user, r));

        await syncNow();
        await progressSaved();

        for (const c of codes) {
          expectOnlyOwn(c, stores[c].getState(), world);
          const saved = await read<GuestData>(storageKeyFor(user, c));
          expectOnlyOwn(c, saved ?? { games: [], reviewLog: [] }, world);
        }

        // Each language's cards are replayed from its own log alone, and log_count
        // counts only its rows (platform spec 6.1).
        type CardRow = {
          language: string;
          lexicon_id: string;
          direction: ReviewLogRow["direction"];
          due: string;
          log_count: number;
        };
        const cards = upserts
          .filter((u) => u.table === "cards")
          .flatMap((u) => u.rows as CardRow[]);
        for (const card of cards) expect(codes).toContain(card.language);
        for (const c of codes) {
          const own = only(world, c).reviewLog;
          const mine = cards.filter((card) => card.language === c);
          expect(
            byKey(
              mine.map((card) => ({
                key: cardKey(card.lexicon_id, card.direction),
                due: card.due,
              })),
            ),
          ).toEqual(
            byKey(
              [...replay([], own).values()]
                .filter((s) => s.reviews > 0)
                .map((s) => ({
                  key: cardKey(s.lexiconId, s.direction),
                  due: s.card.due.toISOString(),
                })),
            ),
          );
          for (const card of mine) {
            expect(card.log_count).toBe(own.length);
            expect(ids[c]).toContain(card.lexicon_id);
          }
        }
      }),
      runs,
    );
  });
});
