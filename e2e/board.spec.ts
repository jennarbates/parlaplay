import { expect, test } from "@playwright/test";
import { card, collapseSheet, savedRound } from "./game.ts";

// The board, top bar, bottom sheet and card detail view (spec 8).

const savedFlipped = async (page: Parameters<typeof savedRound>[0]) =>
  (await savedRound(page))?.flipped;

test.describe("on a 360 × 560 phone (spec 8)", () => {
  test.use({ viewport: { width: 360, height: 560 } });

  test("all 24 cards fit above the collapsed sheet, 6 × 4, with no scrolling", async ({ page }) => {
    await page.goto("/play?seed=1");
    await expect(page.getByRole("list", { name: "Board" }).getByRole("listitem")).toHaveCount(24);
    await collapseSheet(page);
    const sheetTop = (await page.getByRole("region", { name: "Questions" }).boundingBox())?.y ?? 0;
    for (const item of await page
      .getByRole("list", { name: "Board" })
      .getByRole("listitem")
      .all()) {
      const box = await item.boundingBox();
      expect(box).not.toBeNull();
      if (!box) continue;
      expect(box.y).toBeGreaterThanOrEqual(56); // below the top bar
      expect(box.y + box.height).toBeLessThanOrEqual(sheetTop);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
    }
    const scroll = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ]);
    expect(scroll).toEqual([360, 560]);
    // Six columns, four rows (Board.tsx): the dog and cat corners stay visible.
    const xs = new Set<number>();
    for (const item of await page.getByRole("list", { name: "Board" }).getByRole("listitem").all())
      xs.add(Math.round((await item.boundingBox())?.x ?? 0));
    expect(xs.size).toBe(6);
  });

  test("opening the sheet never shrinks the board", async ({ page }) => {
    await page.goto("/play?seed=1");
    await collapseSheet(page);
    const closed = await card(page, "王明").boundingBox();
    await page.getByRole("button", { name: /questions$/ }).click();
    await expect(page.getByRole("button", { name: /questions$/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(await card(page, "王明").boundingBox()).toEqual(closed);
  });
});

test("tap flips a card and tap again flips it back, and it shows by more than color", async ({
  page,
}) => {
  await page.goto("/play?seed=1");
  await collapseSheet(page);
  await card(page, "张伟").click();
  const flipped = card(page, "张伟");
  await expect(flipped).toHaveAttribute("aria-pressed", "true");
  // The face is turned away and a cross shows instead.
  await expect(flipped.locator("svg path")).toBeVisible();
  await flipped.click();
  await expect(card(page, "张伟")).toHaveAttribute("aria-pressed", "false");
});

test("Unflip all appears once every card is down, and turns them all back", async ({ page }) => {
  await page.goto("/play?seed=2");
  await collapseSheet(page);
  const unflip = page.getByRole("button", { name: "Unflip all" });
  const items = page.locator('ul[aria-label="Board"] button[aria-pressed="false"]');
  for (let i = 0; i < 24; i++) {
    await expect(unflip).toHaveCount(0);
    await items.first().click();
  }
  await expect(unflip).toBeVisible();
  await unflip.click();
  await expect(page.locator('ul[aria-label="Board"] button[aria-pressed="true"]')).toHaveCount(0);
});

test("flips survive a reload, because the round is saved after every action", async ({ page }) => {
  await page.goto("/play?seed=3");
  await collapseSheet(page);
  await card(page, "李强").click();
  await card(page, "李丽").click();
  await expect(card(page, "李丽")).toHaveAttribute("aria-pressed", "true");
  // Each action is written to IndexedDB; wait for the writes to land, then reload.
  await expect.poll(() => savedFlipped(page)).toEqual(["c.liqiang", "c.lili"]);
  await page.reload();
  await expect(card(page, "李强")).toHaveAttribute("aria-pressed", "true");
  await expect(card(page, "李丽")).toHaveAttribute("aria-pressed", "true");
});

test("the top bar shows the turn, whose turn, and your own card", async ({ page }) => {
  await page.goto("/play?seed=1");
  const bar = page.locator("header");
  await expect(bar).toContainText("Turn 1");
  await expect(bar).toContainText("Your turn");
  await expect(bar.getByRole("img", { name: /^Your card: \p{Script=Han}+$/u })).toBeVisible();
});

test.describe("card detail view (spec 3.5)", () => {
  test("clicking your own card in the top bar opens it large", async ({ page }) => {
    await page.goto("/play?seed=1");
    const bar = page.locator("header");
    const label = await bar.getByRole("img", { name: /^Your card: / }).getAttribute("aria-label");
    const name = label?.replace("Your card: ", "") ?? "";
    await bar.getByRole("button", { name: /Zoom your card/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("img", { name })).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  });

  test("long-press opens the face large with no text, and does not flip the card", async ({
    page,
  }) => {
    await page.goto("/play?seed=1");
    await collapseSheet(page);
    const davide = card(page, "刘洋");
    const box = await davide.boundingBox();
    if (!box) throw new Error("no card");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("img", { name: "刘洋" })).toBeVisible();
    expect((await dialog.innerText()).replace("×", "").trim()).toBe("");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(davide).toHaveAttribute("aria-pressed", "false");
  });

  test("a short tap does not open it", async ({ page }) => {
    await page.goto("/play?seed=1");
    await collapseSheet(page);
    await card(page, "陈杰").click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("keyboard users get a Zoom control that does the same", async ({ page }) => {
    await page.goto("/play?seed=1");
    await collapseSheet(page);
    // The Zoom control comes right after its card in tab order. WebKit does not Tab
    // between buttons by default, so there it is focused directly.
    const zoom = page.getByRole("button", { name: "Zoom 杨军" });
    await card(page, "杨军").focus();
    await page.keyboard.press("Tab");
    if (!(await zoom.evaluate((el) => el === document.activeElement))) await zoom.focus();
    await expect(zoom).toBeFocused();
    await expect(zoom).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog").getByRole("img", { name: "杨军" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});

test("the flip animation is off under prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play?seed=1");
  const duration = await card(page, "王明")
    .locator("> span")
    .evaluate((el) => getComputedStyle(el).transitionProperty);
  expect(duration).toBe("none");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  const animated = await card(page, "王明")
    .locator("> span")
    .evaluate((el) => getComputedStyle(el).transitionProperty);
  expect(animated).toContain("transform");
});
