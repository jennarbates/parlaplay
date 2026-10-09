import { expect, test, type Locator, type Page } from "@playwright/test";
import { chooseItalian, chooseLanguage } from "./language.ts";

// Platform spec 8.4 (PLAY-065): the logo at the top left of every screen links to /.

const logo = (page: Page) => page.getByRole("link", { name: "parlaplay home" });

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("no box");
  return b;
}

test("exactly one logo on every screen, at the top left", async ({ page }) => {
  await chooseItalian(page);
  for (const path of ["/languages", "/it", "/it/progress", "/zh", "/settings", "/privacy", "/fr"]) {
    await page.goto(path);
    await expect(logo(page)).toHaveCount(1);
    const b = await box(logo(page));
    expect(b.x).toBeLessThan(400); // left, inside the centred column at desktop sizes
    expect(b.y).toBeLessThan(60);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
  }
});

test("mid-round, the logo goes Home, which offers Continue round", async ({ page }) => {
  await chooseItalian(page);
  await page.goto("/it/play?seed=5");
  await expect(page.locator("header")).toContainText("Turn 1");
  await expect(logo(page)).toHaveCount(1);
  await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
  await logo(page).click();
  await expect(page).toHaveURL(/\/it$/);
  await expect(page.getByRole("link", { name: "Continue round" }).first()).toBeVisible();
});

test("the logo goes to the last language chosen, not the one being viewed (D14)", async ({
  page,
}) => {
  await chooseItalian(page);
  await page.goto("/zh/progress");
  await logo(page).click();
  await expect(page).toHaveURL(/\/it$/);
});

test("with no language chosen, the logo opens the picker", async ({ page }) => {
  await page.goto("/privacy");
  await logo(page).click();
  await expect(page).toHaveURL(/\/languages$/);
});

test.describe("on a 360 × 560 phone (spec 8.3, 8.4)", () => {
  test.use({ viewport: { width: 360, height: 560 } });

  test("the picker still fits without scrolling", async ({ page }) => {
    await page.goto("/languages");
    await expect(logo(page)).toBeVisible();
    const scroll = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ]);
    expect(scroll).toEqual([360, 560]);
  });

  for (const [code, title] of [
    ["it", /Chi è\?/],
    ["zh", /谁？/],
  ] as const) {
    test(`${code}: the game's top bar stays 56 px with the bubble alone`, async ({ page }) => {
      await chooseLanguage(page, title, code);
      await page.goto(`/${code}/play?seed=5`);
      const bar = page.locator("header").first();
      await expect(bar).toContainText("Turn 1");
      expect((await box(bar)).height).toBe(56);
      const img = logo(page).getByRole("img");
      await expect(img).toHaveCount(1); // the full logo is display: none below lg
      expect((await box(img)).width).toBeLessThanOrEqual(30);
      const overflow = await bar.evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(overflow).toBe(false);
    });
  }
});
