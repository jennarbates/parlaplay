import { expect, test, type Page } from "@playwright/test";

// CHI-089 and PLAY-029: Settings, one section per language (platform spec 8.1).

const section = (page: Page, language: string) => page.getByRole("region", { name: language });

// Shéi's device settings as saved in IndexedDB (platform spec 3.3, "settings:zh").
const savedPinyin = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<boolean | undefined>((resolve) => {
        const open = indexedDB.open("parlaplay");
        open.onsuccess = () => {
          const get = open.result.transaction("kv").objectStore("kv").get("settings:zh");
          get.onsuccess = () => {
            open.result.close();
            resolve((get.result as { pinyin?: boolean } | undefined)?.pinyin);
          };
        };
      }),
  );

test("the default level set in Settings is the one Home starts with", async ({ page }) => {
  await page.goto("/settings");
  const italian = section(page, "Italian");
  await italian.getByRole("radio", { name: /Level 2/ }).check();
  await page.reload();
  await expect(italian.getByRole("radio", { name: /Level 2/ })).toBeChecked();
  await page.goto("/it");
  await expect(page.getByRole("radio", { name: /Level 2/ })).toBeChecked();
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("group", { name: "Your question" })).toBeVisible();

  // And the other way round: Home's picker changes the Settings default.
  await page.goto("/it");
  await page.getByRole("radio", { name: /Level 1/ }).check();
  await page.goto("/settings");
  await expect(italian.getByRole("radio", { name: /Level 1/ })).toBeChecked();
});

test("account comes first, then a section per language, then the privacy note", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Account",
    "Italian",
    "Chinese",
    ...((page.viewportSize()?.width ?? 0) >= 1024 ? ["About"] : []),
  ]);
  await page.getByRole("link", { name: /Privacy|Read the privacy note/ }).click();
  await expect(page).toHaveURL(/\/privacy$/);
});

test("each language keeps its own level (platform spec 2)", async ({ page }) => {
  await page.goto("/settings");
  await section(page, "Chinese")
    .getByRole("radio", { name: /Level 2/ })
    .check();
  await expect(section(page, "Italian").getByRole("radio", { name: /Level 1/ })).toBeChecked();
  await page.goto("/zh");
  await expect(page.getByRole("radio", { name: /Level 2/ })).toBeChecked();
  await page.goto("/it");
  await expect(page.getByRole("radio", { name: /Level 1/ })).toBeChecked();
});

test("Chinese has Show pinyin at Level 2, the game's own Pinyin toggle", async ({ page }) => {
  await page.goto("/settings");
  const pinyin = section(page, "Chinese").getByRole("checkbox", { name: /Show pinyin at Level 2/ });
  await expect(pinyin).not.toBeChecked();
  await expect(section(page, "Italian").getByRole("checkbox")).toHaveCount(0);
  await pinyin.check();
  await expect.poll(() => savedPinyin(page)).toBe(true);
  await page.reload();
  await expect(pinyin).toBeChecked();

  await page.goto("/zh/play?level=2&seed=1");
  const inGame = page.getByRole("checkbox", { name: "Pinyin" });
  await expect(inGame).toBeChecked();
  await inGame.uncheck();
  await expect.poll(() => savedPinyin(page)).toBe(false);
  await page.goto("/settings");
  await expect(pinyin).not.toBeChecked();
});
