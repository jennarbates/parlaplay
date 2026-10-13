import { expect, test, type Page } from "@playwright/test";
import { maxEncodedLength } from "../src/core/handoff/encoding.ts";
import { messages } from "../handoff/src/chie.ts";
import { arrived, chieData, freshDevice, stored, type Guest } from "./handoff.ts";

// PLAY-036 and PLAY-037, platform spec 5.3 and 10.2: the whole move. The handoff
// page runs at a second origin, as chie.parlaplay.games does, with Chi è?'s
// database ("chi-e") seeded there, and sends the player to parlaplay at the first.
const chie = "http://localhost:4174";

type Entries = Record<string, unknown>;

// A blank page at the handoff page's origin, where the handoff page does not run.
async function blankChiePage(page: Page) {
  await page.route(`${chie}/__seed`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>seed</title>" }),
  );
  await page.goto(`${chie}/__seed`);
}

// Chi è?'s database at the handoff page's origin, as its chie-launch build made it.
// Seeded from a blank page there, so the handoff page has not run yet.
async function seedChie(page: Page, entries: Entries) {
  await blankChiePage(page);
  await page.evaluate(
    (all) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("chi-e", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("kv");
        open.onerror = () => reject(new Error("could not open chi-e"));
        open.onsuccess = () => {
          const tx = open.result.transaction("kv", "readwrite");
          for (const [key, value] of Object.entries(all)) tx.objectStore("kv").put(value, key);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
    entries,
  );
}

// What chi-e holds now: its keys, or null if the database does not exist.
async function chieKeys(page: Page): Promise<string[] | null> {
  await blankChiePage(page);
  return page.evaluate(
    () =>
      new Promise<string[] | null>((resolve) => {
        const open = indexedDB.open("chi-e");
        open.onupgradeneeded = () => open.transaction?.abort();
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          const keys = open.result.transaction("kv").objectStore("kv").getAllKeys();
          keys.onsuccess = () => {
            open.result.close();
            resolve(keys.result.map(String).sort());
          };
        };
      }),
  );
}

const uuid = () => crypto.randomUUID();
const game = () => ({
  id: uuid(),
  seed: 1,
  level: 1,
  contentVersion: 1,
  startedAt: "2026-10-20T10:00:00.000Z",
  endedAt: "2026-10-20T10:09:00.000Z",
  result: "won",
});

// How long the fragment's data is when this browser's own CompressionStream makes
// it, as the handoff page does. Engines compress a little differently, and from
// Node, so the size is measured where it will be made.
async function encodedLength(page: Page, handoff: unknown): Promise<number> {
  await blankChiePage(page);
  return page.evaluate(async (value) => {
    const gzip = new Blob([JSON.stringify(value)])
      .stream()
      .pipeThrough(new CompressionStream("gzip"));
    const bytes = (await new Response(gzip).arrayBuffer()).byteLength;
    return Math.ceil((bytes * 4) / 3); // base64url, unpadded
  }, handoff);
}

// Guest data whose handoff is at least `encoded` characters in this browser. Random
// text does not compress, so each row costs about its own length.
async function heavyGuest(page: Page, encoded: number) {
  const g = game();
  // As much random text as a row may hold: /import caps each field (spec 5.3).
  const filler = (length: number) =>
    Array.from({ length: Math.ceil(length / 32) }, () => uuid().replaceAll("-", ""))
      .join("")
      .slice(0, length);
  const row = () => ({
    id: uuid(),
    gameId: g.id,
    lexiconId: `n.${filler(62)}`,
    direction: "recognize",
    rating: "again",
    detail: { slot: filler(200), given: filler(200), expected: filler(200), rule: filler(200) },
    localDay: "2026-10-20",
    createdAt: "2026-10-20T10:01:00.000Z",
  });
  const guest = { games: [g], reviewLog: Array.from({ length: Math.floor(encoded / 700) }, row) };
  const size = () => encodedLength(page, { v: 1, guest });
  while ((await size()) < encoded) guest.reviewLog.push(...Array.from({ length: 50 }, row));
  return { guest, encoded: await size() };
}

test("seeded Chi è? progress appears in /it/progress, and stays on the old site", async ({
  page,
}) => {
  const handoff = await chieData(page); // a real round's rows and saved round
  await freshDevice(page);
  await seedChie(page, { guest: handoff.guest, round: handoff.round });

  await page.goto(`${chie}/progress`);
  await arrived(page, "/it/progress");
  expect(new URL(page.url()).port).toBe("4173");
  await expect(page.getByText("barba").first()).toBeVisible();
  const guest = await stored<Guest>(page, "guest:it");
  expect(guest?.games).toHaveLength(1);
  expect(guest?.reviewLog).toHaveLength(1);

  // / opens Italian, with the round to continue.
  await page.goto("/");
  await expect(page).toHaveURL(/\/it$/);
  await expect(page.getByRole("link", { name: "Continue round" })).toBeVisible();

  // The handoff page deleted nothing, so the move can be run again and adds nothing.
  expect(await chieKeys(page)).toEqual(["guest", "round"]);
  await page.goto(`${chie}/`);
  await arrived(page, "/it");
  const again = await stored<Guest>(page, "guest:it");
  expect(again?.games).toHaveLength(1);
  expect(again?.reviewLog).toHaveLength(1);
});

for (const [from, to] of [
  ["/", "/it"],
  ["/play", "/it/play"],
  ["/progress", "/it/progress"],
  ["/settings", "/it"],
] as const) {
  test(`with no Chi è? data, ${from} redirects straight to ${to}`, async ({ page }) => {
    const visited: string[] = [];
    page.on("framenavigated", (frame) => visited.push(new URL(frame.url()).pathname));
    await page.goto(`${chie}${from}`);
    await arrived(page, to);
    expect(new URL(page.url()).port).toBe("4173");
    expect(visited).not.toContain("/import");
    expect(await stored(page, "handoff")).toBeUndefined();
    // And the old origin is left as it was: no database made by looking.
    expect(await chieKeys(page)).toBeNull();
  });
}

test("a signed-in player's unsynced rows wait for them; their synced copy stays behind", async ({
  page,
}) => {
  const user = uuid();
  const g = game();
  await seedChie(page, {
    [`outbox:${user}`]: [{ kind: "game", row: g }],
    [`user:${user}`]: { games: [g], reviewLog: [] },
  });
  await page.goto(`${chie}/progress`);
  await arrived(page, "/it/progress");
  expect(await stored(page, "outbox:pending-handoff")).toEqual([
    { userId: user, ops: [{ kind: "game", row: { ...g, language: "it" } }] },
  ]);
  expect(await stored<Guest>(page, "guest:it")).toEqual({ games: [], reviewLog: [] });
});

test("a 500 KB payload arrives whole", async ({ page }) => {
  const { guest, encoded } = await heavyGuest(page, 510_000);
  expect(encoded).toBeGreaterThan(500_000);
  expect(encoded).toBeLessThan(maxEncodedLength);

  await seedChie(page, { guest });
  await page.goto(`${chie}/progress`);
  await arrived(page, "/it/progress");
  const saved = await stored<Guest>(page, "guest:it");
  expect(saved?.reviewLog).toHaveLength(guest.reviewLog.length);
  expect(saved?.reviewLog.at(-1)).toMatchObject({ ...guest.reviewLog.at(-1), language: "it" });
});

test("progress over 900 KB is not sent, and the page says who to email", async ({ page }) => {
  const { guest, encoded } = await heavyGuest(page, maxEncodedLength + 20_000);
  expect(encoded).toBeGreaterThan(maxEncodedLength);
  await seedChie(page, { guest });
  await page.goto(`${chie}/`);
  await expect(page.getByRole("status")).toHaveText(messages.tooLarge);
  expect(new URL(page.url()).origin).toBe(chie);
});

test("damaged Chi è? data shows the failure screen and saves nothing", async ({ page }) => {
  await seedChie(page, {
    guest: { games: [{ ...game(), id: "not-a-uuid" }], reviewLog: [] },
    round: { contentVersion: 1 },
  });
  await page.goto(`${chie}/play`);
  await expect(
    page.getByRole("heading", { name: "We couldn't bring your progress over." }),
  ).toBeVisible();
  await arrived(page, "/import");
  for (const key of ["guest:it", "round:it", "handoff"])
    expect(await stored(page, key)).toBeUndefined();
  expect(await chieKeys(page)).toEqual(["guest", "round"]);
});

test("the page shows the moving message while it works", async ({ page }) => {
  // The page is gone as soon as it has encoded the data, so note what it showed.
  await page.addInitScript(() => {
    new MutationObserver(() => {
      const text = document.getElementById("message")?.textContent;
      if (text) sessionStorage.setItem("shown", text);
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await seedChie(page, { guest: { games: [game()], reviewLog: [] } });
  await page.goto(`${chie}/`);
  await arrived(page, "/it");
  await blankChiePage(page);
  expect(await page.evaluate(() => sessionStorage.getItem("shown"))).toBe(messages.moving);
});
