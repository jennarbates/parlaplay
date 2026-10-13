// Shared by the handoff specs (platform spec 5.3): /import on its own (PLAY-035) and
// the whole move from the handoff page's origin (PLAY-037).
import { expect, type Page } from "@playwright/test";
import { Handoff } from "../src/core/handoff/schema.ts";

// A value from parlaplay's IndexedDB key-value store, read from inside the page.
export function stored<T>(page: Page, key: string): Promise<T | undefined> {
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
export const arrived = (page: Page, path: string) =>
  expect(page).toHaveURL((url) => url.pathname === path && url.hash === "");

type Row = { id: string; language?: string };
export type Guest = { games: Row[]; reviewLog: Row[] };

// What Chi è? would have saved: play the start of a real round here, then take the
// rows and the round as they are on disk, without the language Chi è? never wrote.
export async function chieData(page: Page): Promise<Handoff> {
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
export async function freshDevice(page: Page) {
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
