import { expect, test, type Page } from "@playwright/test";

// Chi è stato? GS 9.1: its card on Italian Home, and its routes as their own chunk.
const scripts = (page: Page) => {
  const urls: string[] = [];
  page.on("response", (r) => {
    if (r.url().endsWith(".js")) urls.push(r.url());
  });
  return urls;
};
const giallo = /GialloScreens-/;

test("/it lists the giallo as coming soon, and doesn't load its chunk", async ({ page }) => {
  const urls = scripts(page);
  await page.goto("/it");
  const card = page.getByRole("region", { name: "Chi è stato?" });
  await expect(card).toContainText("Coming soon");
  await expect(card.getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Chi è?" })).toBeVisible();
  expect(urls.filter((u) => giallo.test(u))).toEqual([]);
});

test("/it/giallo and /it/giallo/play load the giallo's chunk", async ({ page }) => {
  const urls = scripts(page);
  await page.goto("/it/giallo");
  await expect(page.getByRole("heading", { name: "Chi è stato?" })).toBeVisible();
  await expect(page.getByText("La torta sparita")).toBeVisible();
  expect(urls.some((u) => giallo.test(u))).toBe(true);

  await page.goto("/it/giallo/play");
  await expect(page.getByText("Coming soon.")).toBeVisible();
  await page.getByRole("link", { name: "Back to cases" }).click();
  await expect(page).toHaveURL(/\/it\/giallo$/);
});
