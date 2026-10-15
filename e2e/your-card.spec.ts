import { expect, test, type Locator, type Page } from "@playwright/test";

// #131: the player's own card is bigger and easier to see. In the top bar it fills
// the bar's height, in a frame, on every screen; on a desktop screen at least
// 800px tall a larger copy also heads the side panel. Neither changes the board.

const games = [
  { name: "Chi è?", path: "/it" },
  { name: "Shéi", path: "/zh" },
];
const bar = (page: Page) => page.locator("header");
const barFace = (page: Page) => bar(page).getByRole("img", { name: /^Your card: / });
const panelCard = (page: Page) =>
  page.getByRole("complementary", { name: "Questions" }).locator("figure");

async function height(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("not rendered");
  return Math.round(box.height);
}

for (const game of games) {
  test.describe(`${game.name}: your card`, () => {
    test("on a 360 × 560 phone, it fills the 56px bar", async ({ page }, info) => {
      test.skip(info.project.name.startsWith("desktop"), "phone profiles");
      await page.setViewportSize({ width: 360, height: 560 });
      await page.goto(`${game.path}/play?seed=1`);
      expect(await height(bar(page))).toBe(56);
      expect(await height(barFace(page))).toBe(48);
      const face = await barFace(page).boundingBox();
      expect((face?.x ?? 0) + (face?.width ?? 0)).toBeLessThanOrEqual(360);
      await expect(panelCard(page)).toHaveCount(0);
    });

    test("at 1440 × 900, a larger copy heads the side panel", async ({ page }, info) => {
      test.skip(!info.project.name.startsWith("desktop"), "desktop profiles");
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${game.path}/play?seed=1`);
      await expect(panelCard(page)).toBeVisible();
      const label = await barFace(page).getAttribute("aria-label");
      await expect(panelCard(page)).toContainText(label?.replace("Your card: ", "") ?? "");
      expect(await height(panelCard(page).locator("div").first())).toBe(128);
      // The bar's card is still the one to click and the one a screen reader hears.
      await expect(panelCard(page)).toHaveAttribute("aria-hidden", "true");
      await bar(page)
        .getByRole("button", { name: /Zoom your card/ })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
    });

    test("at 1024 × 640 there is no room for it, so only the bar has it", async ({
      page,
    }, info) => {
      test.skip(!info.project.name.startsWith("desktop"), "desktop profiles");
      await page.setViewportSize({ width: 1024, height: 640 });
      await page.goto(`${game.path}/play?seed=1`);
      await expect(barFace(page)).toBeVisible();
      await expect(panelCard(page)).toBeHidden();
    });
  });
}
