import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/zh");
  await expect(page.getByRole("heading", { name: "谁？" })).toBeVisible();
});

test("/play loads directly", async ({ page }) => {
  const response = await page.goto("/zh/play");
  expect(response?.status()).toBe(200);
  await expect(page.locator("#root")).not.toBeEmpty();
});
