import { expect, test } from "@playwright/test";
import { encodeHandoff } from "../src/core/handoff/codec.ts";
import { arrived, chieData, freshDevice, stored, type Guest } from "./handoff.ts";

// PLAY-035, platform spec 5.3: /import takes a Chi è? player's device data from
// the URL fragment. The handoff page that sends it is PLAY-036.

test("a Chi è? guest's progress and round arrive, and Italian's Home offers it", async ({
  page,
}) => {
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

  // Italian's Home offers the round to continue.
  await page.goto("/it");
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
