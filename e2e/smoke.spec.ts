import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/it");
  await expect(page.getByRole("heading", { name: "Chi è?" })).toBeVisible();
});

test("/play loads directly", async ({ page }) => {
  const response = await page.goto("/it/play");
  expect(response?.status()).toBe(200);
  await expect(page.locator("#root")).not.toBeEmpty();
});
