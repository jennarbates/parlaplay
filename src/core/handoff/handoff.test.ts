// Platform spec 10.2, Handoff: the encoding round-trips, damaged data is rejected,
// the merge is a union, a second import adds nothing, next is one of three paths,
// and the newer saved round is kept.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../services/supabase.ts", () => ({ supabase: null }));
const { decodeHandoff, encodeHandoff, maxEncodedLength } = await import("./codec.ts");
const { importHandoff } = await import("./import.ts");
const { keepsExistingRound, mergeOutboxes, nextPath, parseFragment, withLanguage } =
  await import("./merge.ts");
const { read, resetForTests, write } = await import("../services/storage.ts");
const { useSyncStore } = await import("../services/sync.ts");
const { useAccountStore } = await import("../store/account.ts");
const { useAuthStore } = await import("../store/authStore.ts");
const { progressSaved, progressStore } = await import("../store/progressStore.ts");
const { useRounds } = await import("../store/rounds.ts");
type Handoff = import("./schema.ts").Handoff;
type GuestData = import("../store/progressStore.ts").GuestData;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const user = uuid(900);
const other = uuid(901);

const game = (n: number, startedAt = `2026-10-${String(n).padStart(2, "0")}T10:00:00.000Z`) => ({
  id: uuid(n),
  seed: n,
  level: 1 as const,
  contentVersion: 1,
  startedAt,
});
const review = (n: number, gameN: number) => ({
  id: uuid(100 + n),
  gameId: uuid(gameN),
  lexiconId: "n.cappello",
  direction: "recognize" as const,
  rating: "again" as const,
  detail: { slot: "art", given: "il", expected: "lo", rule: "art.lo" },
  localDay: "2026-10-06",
  createdAt: "2026-10-06T10:01:00.000Z",
});
const round = (gameN: number) => ({
  contentVersion: 1,
  gameId: uuid(gameN),
  state: { phase: "playerTurn", turn: 3 },
});

const handoff: Handoff = {
  v: 1,
  guest: {
    games: [{ ...game(1), endedAt: "2026-10-01T10:09:00.000Z", result: "won" }, game(2)],
    reviewLog: [review(1, 1), review(2, 2)],
  },
  round: round(2),
};
const fragment = async (h: Handoff, next = "/it/play") =>
  `#data=${await encodeHandoff(h)}&next=${next}`;

const italian = progressStore("it");
const chinese = progressStore("zh");
const guest = () => read<GuestData>("guest:it");

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  resetForTests();
  for (const p of [italian, chinese])
    p.setState({ games: [], reviewLog: [], loaded: true, owner: "guest" });
  useAuthStore.setState({ status: "guest", userId: null, email: null });
  useAccountStore.setState({ settled: true });
  useSyncStore.setState({ userId: null, outbox: [], status: "idle" });
  useRounds.setState({ saved: {}, hooks: {} });
});

describe("the encoding", () => {
  test("round-trips, and is safe in a URL fragment", async () => {
    const encoded = await encodeHandoff(handoff);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeHandoff(encoded)).toEqual(handoff);
  });

  test("a heavy guest's few hundred rows stay far under the 900 KB limit (D22)", async () => {
    const heavy: Handoff = {
      v: 1,
      guest: {
        games: Array.from({ length: 60 }, (_, i) => ({
          ...game(1),
          id: crypto.randomUUID(),
          seed: i,
        })),
        reviewLog: Array.from({ length: 600 }, () => ({
          ...review(1, 1),
          id: crypto.randomUUID(),
        })),
      },
    };
    const encoded = await encodeHandoff(heavy);
    expect(encoded.length).toBeLessThan(maxEncodedLength / 10);
    expect(await decodeHandoff(encoded)).toEqual(heavy);
  });

  test.each([
    ["not base64url", "a b+c/="],
    ["not gzip", "aGVsbG8"],
    ["longer than the limit", "A".repeat(maxEncodedLength + 1)],
  ])("rejects data that is %s", async (_, data) => {
    await expect(decodeHandoff(data)).rejects.toThrow();
  });

  test.each([
    ["an unknown version", { ...handoff, v: 2 }],
    [
      "a row with an extra field",
      { v: 1, guest: { games: [{ ...game(1), language: "zh" }], reviewLog: [] } },
    ],
    [
      "a row without its id",
      { v: 1, guest: { games: [{ ...game(1), id: undefined }], reviewLog: [] } },
    ],
    [
      "a rating that does not exist",
      { v: 1, guest: { games: [], reviewLog: [{ ...review(1, 1), rating: "easy" }] } },
    ],
    ["a round with no state", { v: 1, round: { contentVersion: 1, gameId: uuid(2) } }],
    ["an outbox with no user", { v: 1, outboxes: [{ ops: [] }] }],
    ["something that is not a handoff", ["guest"]],
  ])("Zod rejects %s", async (_, damaged) => {
    await expect(decodeHandoff(await encodeHandoff(damaged as Handoff))).rejects.toThrow();
  });
});

describe("the fragment", () => {
  test("holds data and next", () => {
    expect(parseFragment("#data=abc_-&next=/it/play")).toEqual({ data: "abc_-", next: "/it/play" });
    expect(parseFragment("")).toEqual({ data: null, next: null });
  });

  test.each([
    ["/it", "/it"],
    ["/it/play", "/it/play"],
    ["/it/progress", "/it/progress"],
    ["/zh", "/it"],
    ["/it/play/", "/it"],
    ["/it/../settings", "/it"],
    ["//evil.example/it", "/it"],
    ["https://evil.example/it/play", "/it"],
    ["javascript:alert(1)", "/it"],
    ["", "/it"],
    [null, "/it"],
  ])("next %s becomes %s", (next, path) => {
    expect(nextPath(next)).toBe(path);
  });
});

describe("the rows", () => {
  test("every row gets language it", () => {
    const incoming = withLanguage({
      ...handoff,
      outboxes: [
        {
          userId: user,
          ops: [
            { kind: "game", row: game(3) },
            { kind: "review", row: review(3, 3) },
          ],
        },
        { userId: other, ops: [] },
      ],
    });
    const rows = [
      ...incoming.guest.games,
      ...incoming.guest.reviewLog,
      ...incoming.outboxes.flatMap((o) => o.ops.map((op) => op.row)),
    ];
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row.language).toBe("it");
    expect(incoming.outboxes.map((o) => o.userId)).toEqual([user]); // an empty outbox is dropped
  });

  test("outboxes merge per user, each op once", () => {
    const start = { kind: "game" as const, row: { ...game(3), language: "it" as const } };
    const end = { kind: "game" as const, row: { ...start.row, result: "won" as const } };
    const merged = mergeOutboxes(
      [{ userId: user, ops: [start] }],
      [
        { userId: user, ops: [start, end] },
        { userId: other, ops: [start] },
      ],
    );
    expect(merged).toEqual([
      { userId: user, ops: [start, end] },
      { userId: other, ops: [start] },
    ]);
  });
});

describe("the saved round", () => {
  const games = [game(1), game(2)];

  test("is taken when the device has none", () => {
    expect(keepsExistingRound(undefined, round(2), games)).toBe(false);
  });

  test("the one whose games row started later is kept", () => {
    expect(keepsExistingRound(round(2), round(1), games)).toBe(true);
    expect(keepsExistingRound(round(1), round(2), games)).toBe(false);
  });

  test("the existing one is kept when either games row is missing", () => {
    expect(keepsExistingRound(round(1), round(7), games)).toBe(true);
    expect(keepsExistingRound(round(7), round(2), games)).toBe(true);
  });

  test("a round whose games row did not come with it is refused, even onto an empty device", () => {
    expect(keepsExistingRound(undefined, round(7), games)).toBe(true);
  });

  test("a round whose game is already finished is refused", () => {
    const finished = [{ ...game(2), result: "won" as const }];
    expect(keepsExistingRound(undefined, round(2), finished)).toBe(true);
    expect(keepsExistingRound(round(1), round(2), [game(1), ...finished])).toBe(true);
  });

  test("the same round arriving again is left alone", () => {
    expect(keepsExistingRound(round(2), round(2), games)).toBe(true);
  });
});

describe("importHandoff", () => {
  const now = new Date("2026-11-13T12:00:00Z");

  test("saves guest rows, the round and the handoff key, and returns next", async () => {
    expect(await importHandoff(await fragment(handoff), now)).toBe("/it/play");
    const saved = await guest();
    expect(saved?.games.map((g) => g.id)).toEqual([uuid(1), uuid(2)]);
    expect(saved?.reviewLog.map((r) => r.id)).toEqual([uuid(101), uuid(102)]);
    for (const row of [...(saved?.games ?? []), ...(saved?.reviewLog ?? [])])
      expect(row.language).toBe("it");
    expect(await read("round:it")).toEqual(round(2));
    expect(useRounds.getState().saved.it).toBe(true);
    expect(await read("handoff")).toEqual({ from: "chie", at: now.toISOString() });
    // The guest's open copy has them too, and Chinese has nothing.
    expect(italian.getState().games).toHaveLength(2);
    expect(italian.getState().reviewLog).toHaveLength(2);
    expect(chinese.getState().games).toHaveLength(0);
    expect(await read("guest:zh")).toBeUndefined();
  });

  test("merging into existing guest:it is a union by id", async () => {
    // Played here already: game 2 was finished here, game 5 exists only here.
    const here = {
      games: [
        {
          ...game(2),
          language: "it" as const,
          endedAt: "2026-10-02T10:09:00.000Z",
          result: "lost" as const,
        },
        { ...game(5), language: "it" as const },
      ],
      reviewLog: [
        { ...review(2, 2), language: "it" as const },
        { ...review(5, 5), language: "it" as const },
      ],
    };
    await write("guest:it", here);
    italian.setState(here);

    await importHandoff(await fragment(handoff), now);
    const saved = await guest();
    expect(saved?.games.map((g) => g.id).sort()).toEqual([uuid(1), uuid(2), uuid(5)]);
    expect(saved?.games.find((g) => g.id === uuid(2))?.result).toBe("lost"); // finished beats open
    expect(saved?.reviewLog.map((r) => r.id).sort()).toEqual([uuid(101), uuid(102), uuid(105)]);
    await progressSaved();
    expect(await guest()).toEqual(saved); // the open copy saved the same rows
  });

  test("a second import adds nothing", async () => {
    await importHandoff(await fragment(handoff), now);
    const first = { guest: await guest(), round: await read("round:it") };
    await importHandoff(await fragment(handoff), now);
    await progressSaved();
    expect({ guest: await guest(), round: await read("round:it") }).toEqual(first);
    expect(italian.getState().games).toHaveLength(2);
    expect(italian.getState().reviewLog).toHaveLength(2);
  });

  test("the newer saved round is kept", async () => {
    // The device's round started on Oct 9; the one handed off, on Oct 2.
    const here = { games: [{ ...game(9), language: "it" as const }], reviewLog: [] };
    await write("guest:it", here);
    italian.setState(here);
    await write("round:it", round(9));
    await importHandoff(await fragment(handoff), now);
    expect(await read("round:it")).toEqual(round(9));

    // And the other way round: the handed-off round is the newer one.
    await write("round:it", round(1));
    await importHandoff(await fragment(handoff), now);
    expect(await read("round:it")).toEqual(round(2));
  });

  test("a round of another content version is saved but not offered", async () => {
    await importHandoff(
      await fragment({
        v: 1,
        guest: { games: [game(2)], reviewLog: [] },
        round: { ...round(2), contentVersion: 99 },
      }),
      now,
    );
    expect(await read("round:it")).toMatchObject({ contentVersion: 99 });
    expect(useRounds.getState().saved.it).toBe(false);
  });

  test("a round finished here does not come back when the old link is opened again", async () => {
    await importHandoff(await fragment(handoff), now);
    // The player finishes round 2 on this site: its row closes and the round goes.
    italian.getState().recordGameEnd(uuid(2), "won");
    await progressSaved();
    const { remove } = await import("../services/storage.ts");
    await remove("round:it");
    useRounds.getState().setSaved("it", false);

    await importHandoff(await fragment(handoff), now);
    expect(await read("round:it")).toBeUndefined();
    expect(useRounds.getState().saved.it).toBe(false);
    expect((await guest())?.games.find((g) => g.id === uuid(2))?.result).toBe("won");
  });

  test("a round without its games row is not saved", async () => {
    await importHandoff(await fragment({ v: 1, round: round(2) }), now);
    expect(await read("round:it")).toBeUndefined();
    expect(await read("handoff")).toBeDefined();
  });

  test("a row with megabytes in one field is rejected", async () => {
    const huge = { ...review(1, 1), lexiconId: "n.".padEnd(100, "x") };
    const data = await encodeHandoff({ v: 1, guest: { games: [game(1)], reviewLog: [huge] } });
    await expect(importHandoff(`#data=${data}`, now)).rejects.toThrow();
    expect(await guest()).toBeUndefined();
  });

  test("a next outside the three allowed paths becomes /it", async () => {
    expect(await importHandoff(await fragment(handoff, "https://evil.example/"), now)).toBe("/it");
    expect(await importHandoff(`#data=${await encodeHandoff(handoff)}`, now)).toBe("/it");
  });

  test.each([
    ["no fragment", async () => ""],
    ["no data", async () => "#next=/it/play"],
    ["damaged data", async () => `#data=${(await encodeHandoff(handoff)).slice(0, -20)}&next=/it`],
    ["data Zod rejects", async () => fragment({ ...handoff, v: 3 } as unknown as Handoff)],
  ])("with %s, nothing is saved", async (_, make) => {
    await expect(importHandoff(await make(), now)).rejects.toThrow();
    for (const key of ["guest:it", "round:it", "handoff", "outbox:pending-handoff"] as const)
      expect(await read(key)).toBeUndefined();
    expect(italian.getState().games).toHaveLength(0);
  });

  test("signed in here, the rows wait in guest:it and the account's copy is untouched", async () => {
    useAuthStore.setState({ status: "signedIn", userId: other, email: "o@b.co" });
    italian.setState({ owner: other });
    await importHandoff(await fragment(handoff), now);
    expect((await guest())?.games).toHaveLength(2);
    expect(italian.getState().games).toHaveLength(0);
    expect(await read(`user:${other}:it`)).toBeUndefined();
    // The round stays behind: played under this account, its review rows would
    // point at a game that is only in the guest rows.
    expect(await read("round:it")).toBeUndefined();
  });

  test("signed in here, rows the account already has are not offered again", async () => {
    useAuthStore.setState({ status: "signedIn", userId: other, email: "o@b.co" });
    // Saved to the account after an earlier handoff: both games, one of the reviews.
    italian.setState({
      owner: other,
      games: [1, 2].map((n) => ({ ...game(n), language: "it" as const })),
      reviewLog: [{ ...review(1, 1), language: "it" as const }],
    });
    await importHandoff(await fragment(handoff), now);
    expect(await guest()).toEqual({ games: [], reviewLog: [{ ...review(2, 2), language: "it" }] });

    // And with nothing new, nothing is written: no guest data, so no prompt.
    vi.stubGlobal("indexedDB", new IDBFactory());
    resetForTests();
    italian.setState({
      reviewLog: [1, 2].map((n) => ({ ...review(n, n), language: "it" as const })),
    });
    await importHandoff(await fragment(handoff), now);
    expect(await guest()).toBeUndefined();
  });

  test("waits for the account to settle before saving", async () => {
    useAccountStore.setState({ settled: false });
    const importing = importHandoff(await fragment(handoff), now);
    await new Promise((r) => setTimeout(r, 20));
    expect(await guest()).toBeUndefined();
    useAccountStore.setState({ settled: true });
    await importing;
    expect((await guest())?.games).toHaveLength(2);
  });
});
