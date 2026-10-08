import { expect, test } from "@playwright/test";

// CHI-089: Settings.

test("the default level set in Settings is the one Home starts with", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("radio", { name: /Level 2/ }).check();
  await page.reload();
  await expect(page.getByRole("radio", { name: /Level 2/ })).toBeChecked();
  await page.goto("/");
  await expect(page.getByRole("radio", { name: /Level 2/ })).toBeChecked();
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("group", { name: "Your question" })).toBeVisible();

  // And the other way round: Home's picker changes the Settings default.
  await page.goto("/");
  await page.getByRole("radio", { name: /Level 1/ }).check();
  await page.goto("/settings");
  await expect(page.getByRole("radio", { name: /Level 1/ })).toBeChecked();
});

test("account and the privacy note are reachable", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
});
