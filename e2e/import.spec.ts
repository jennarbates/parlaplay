import { expect, test, type Page } from "@playwright/test";
import { encodeHandoff } from "../src/core/handoff/codec.ts";
import { Handoff } from "../src/core/handoff/schema.ts";

// PLAY-035, platform spec 5.3: /import takes a Chi è? player's device data from
// the URL fragment. The handoff page that sends it is PLAY-036.

function stored<T>(page: Page, key: string): Promise<T | undefined> {
  return page.evaluate(
    (k) =>
      new Promise<T | undefined>((resolve) => {
        const open = indexedDB.open("parlaplay");
        open.onsuccess = () => {
          const get = open.result.transaction("kv").objectStore("kv").get(k);
          get.onsuccess = () => {
            open.result.close();
            resolve(get.result as T | undefined);
          };
        };
      }),
    key,
  );
}

// On that screen with the fragment gone. (A pattern on the end of the URL would also
// match the fragment's own next=.)
const arrived = (page: Page, path: string) =>
  expect(page).toHaveURL((url) => url.pathname === path && url.hash === "");

type Row = { id: string; language?: string };
type Guest = { games: Row[]; reviewLog: Row[] };

// What Chi è? would have saved: play the start of a real round here, then take the
// rows and the round as they are on disk, without the language Chi è? never wrote.
async function chieData(page: Page): Promise<Handoff> {
  await page.goto("/it/play?level=2&seed=8");
  const tile = (group: string, name: string) =>
    page
      .getByRole("group", { name: group, exact: true })
      .getByRole("button", { name, exact: true });
  await tile("Verb", "ha").click();
  await tile("Article", "il").click();
  await tile("Noun", "barba").click();
  await page.getByRole("button", { name: "Chiedi" }).click(); // a mistake: la barba
  await expect.poll(async () => (await stored<Guest>(page, "guest:it"))?.reviewLog.length).toBe(1);
  const guest = await stored<Guest>(page, "guest:it");
  const round = await stored<Handoff["round"]>(page, "round:it");
  if (!guest || !round) throw new Error("the round was not saved");
  const plain = (row: Row) =>
    Object.fromEntries(Object.entries(row).filter(([field]) => field !== "language"));
  // Parsed as the handoff page's data must be: these are Chi è?'s shapes.
  return Handoff.parse({
    v: 1,
    guest: { games: guest.games.map(plain), reviewLog: guest.reviewLog.map(plain) },
    round,
  });
}

// A device that has never opened parlaplay.games.
async function freshDevice(page: Page) {
  await page.goto("/privacy");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        localStorage.clear();
        const gone = indexedDB.deleteDatabase("parlaplay");
        gone.onsuccess = gone.onerror = gone.onblocked = () => resolve();
      }),
  );
}

test("a Chi è? guest's progress and round arrive, and / opens Italian", async ({ page }) => {
  const handoff = await chieData(page);
  await freshDevice(page);

  await page.goto(`/import#data=${await encodeHandoff(handoff)}&next=/it/progress`);
  await arrived(page, "/it/progress");
  // The mistake made on Chi è? is on Progress.
  await expect(page.getByText("barba").first()).toBeVisible();

  const guest = await stored<Guest>(page, "guest:it");
  expect(guest?.games).toHaveLength(1);
  expect(guest?.reviewLog).toHaveLength(1);
  for (const row of [...(guest?.games ?? []), ...(guest?.reviewLog ?? [])])
    expect(row.language).toBe("it");
  expect(await stored(page, "handoff")).toMatchObject({ from: "chie" });

  // / opens Italian now, and the round can be continued.
  await page.goto("/");
  await expect(page).toHaveURL(/\/it$/);
  await page.getByRole("link", { name: "Continue round" }).click();
  await expect(page.locator("header")).toContainText("Turn 1");

  // A second import adds nothing.
  await page.goto(`/import#data=${await encodeHandoff(handoff)}&next=/it`);
  await arrived(page, "/it");
  const again = await stored<Guest>(page, "guest:it");
  expect(again?.games).toHaveLength(1);
  expect(again?.reviewLog).toHaveLength(1);
});

test("the fragment leaves the address bar, and Back does not return to /import", async ({
  page,
}) => {
  await page.goto("/languages");
  const data = await encodeHandoff({ v: 1, guest: { games: [], reviewLog: [] } });
  await page.goto(`/import#data=${data}&next=/it/play`);
  await arrived(page, "/it/play");
  await page.goBack();
  await expect(page).toHaveURL(/\/languages$/);
});

test("a next that is not an Italian screen becomes /it", async ({ page }) => {
  const data = await encodeHandoff({ v: 1, guest: { games: [], reviewLog: [] } });
  await page.goto(`/import#data=${data}&next=https://example.com/`);
  await arrived(page, "/it");
});

test("damaged data saves nothing and offers Try again and Start fresh", async ({ page }) => {
  const data = await encodeHandoff({ v: 1, guest: { games: [], reviewLog: [] } });
  await page.goto(`/import#data=${data.slice(0, -8)}&next=/it/play`);
  await expect(
    page.getByRole("heading", { name: "We couldn't bring your progress over." }),
  ).toBeVisible();
  await arrived(page, "/import");
  expect(await stored(page, "guest:it")).toBeUndefined();
  expect(await stored(page, "handoff")).toBeUndefined();
  // Nothing leads away but the two choices (8.4: no logo, no nav).
  await expect(page.getByRole("link")).toHaveText(["Try again", "Start fresh"]);
  await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute(
    "href",
    "https://chie.parlaplay.games/",
  );
  await page.getByRole("link", { name: "Start fresh" }).click();
  await expect(page).toHaveURL(/\/it$/);
});

test("/import with no handoff shows the failure screen", async ({ page }) => {
  await page.goto("/import");
  await expect(
    page.getByRole("heading", { name: "We couldn't bring your progress over." }),
  ).toBeVisible();
});
