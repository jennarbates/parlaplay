import { expect, test } from "@playwright/test";
import { chooseItalian, chooseLanguage } from "./language.ts";

// Platform spec 2, 4.3 and 10.2: the picker, the last language and not-found.

test("a first visit to / shows the picker, one card per language", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/languages$/);
  await expect(page.getByRole("heading", { name: "Choose a language" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Chi è\?/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /谁？/ })).toBeVisible();
});

test("choosing Chinese, then reloading /, opens /zh (D13)", async ({ page }) => {
  await chooseLanguage(page, /谁？/, "zh");
  await page.goto("/");
  await expect(page).toHaveURL(/\/zh$/);
  await expect(page.getByRole("heading", { name: "谁？" })).toBeVisible();
});

test("following a link to a language does not change the default (D14)", async ({ page }) => {
  await chooseItalian(page);
  await page.goto("/zh/progress");
  await page.goto("/");
  await expect(page).toHaveURL(/\/it$/);
});

test("Change language on Home goes back to the picker", async ({ page }) => {
  await chooseItalian(page);
  await page.getByRole("link", { name: "Change language" }).first().click();
  await expect(page).toHaveURL(/\/languages$/);
});

test("an unknown language shows the not-found screen", async ({ page }) => {
  await page.goto("/fr/play");
  await expect(
    page.getByRole("heading", { name: "We don't have that language yet." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Choose a language" }).click();
  await expect(page).toHaveURL(/\/languages$/);
});
