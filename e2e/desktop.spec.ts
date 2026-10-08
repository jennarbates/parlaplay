import { expect, test, type Page } from "@playwright/test";
import { content } from "../src/languages/it/content/index.ts";
import { allQuestions } from "../src/languages/it/engine/index.ts";
import { evaluate } from "../src/languages/it/engine/meaning.ts";
import { startGame } from "../src/languages/it/engine/start.ts";
import { localDay } from "../src/core/services/localDay.ts";
import type { GuestData, ReviewLogRow } from "../src/core/store/progressStore.ts";
import { progressStats } from "../src/languages/it/ui/progressStats.ts";
import { hasSupabase } from "./inbox.ts";
import { chooseItalian } from "./language.ts";

// Desktop spec DS 13.3: the desktop layout, run by the desktop-chromium and
// desktop-webkit projects at 1440 × 900.

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

test.describe("app shell (DS 5)", () => {
  test("DesktopNav is on every screen but /play, marking the current one", async ({ page }) => {
    await chooseItalian(page); // shared pages show the last language chosen
    for (const [path, current] of [
      ["/it", "Chi è?"],
      ["/it/progress", "Progress"],
      ["/settings", "Settings"],
      ["/privacy", null],
    ] as const) {
      await page.goto(path);
      await expect(nav(page), path).toBeVisible();
      for (const name of ["Chi è?", "Play", "Progress", "Settings", "Guest · Sign in"])
        await expect(nav(page).getByRole("link", { name, exact: true }), path).toBeVisible();
      const marked = nav(page).locator('[aria-current="page"]');
      if (current) {
        await expect(marked, path).toHaveCount(1);
        await expect(marked, path).toHaveText(current);
      } else {
        await expect(marked, path).toHaveCount(0);
      }
    }
    await page.goto("/it/play?seed=1");
    await expect(page.getByRole("grid", { name: "Board" })).toBeVisible();
    await expect(nav(page)).toHaveCount(0);
  });

  test("the nav shows at 1024 wide, not at 1023, and follows a resize", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.goto("/it");
    await expect(nav(page)).toBeVisible();
    await page.setViewportSize({ width: 1023, height: 640 });
    await expect(nav(page)).toHaveCount(0);
    // Below lg the screen is the phone's 448px column, as before.
    expect(await page.locator("main").evaluate((m) => m.getBoundingClientRect().width)).toBe(448);
    await page.setViewportSize({ width: 1024, height: 640 });
    await expect(nav(page)).toBeVisible();
  });

  test("Play reads Continue while a round is saved, and the links go where they say", async ({
    page,
  }) => {
    await page.goto("/it");
    await nav(page).getByRole("link", { name: "Progress" }).click();
    await expect(page).toHaveURL(/\/progress$/);
    await nav(page).getByRole("link", { name: "Guest · Sign in" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await nav(page).getByRole("link", { name: "Play", exact: true }).click();
    await expect(page.getByRole("grid", { name: "Board" })).toBeVisible();
    // Flip a card so the round is saved, then come back.
    await page.locator('[aria-label="Board"] button[aria-pressed="false"]').first().click();
    await page.goto("/it");
    await expect(nav(page).getByRole("link", { name: "Continue", exact: true })).toBeVisible();
  });
});

test("no horizontal scroll on any screen at 1024 and 1440 wide", async ({ page }) => {
  await chooseItalian(page);
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/it", "/it/progress", "/settings", "/privacy"]) {
      await page.goto(path);
      await expect(nav(page)).toBeVisible();
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `${path} at ${width}`).toBe(width);
    }
  }
});

// At lg the board is an ARIA grid of rows of cells (DS 8.2).
const board = (page: Page) => page.getByRole("grid", { name: "Board" });
const panel = (page: Page) => page.locator('aside[aria-label="Questions"]');
const card = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name}: capelli`) });

test.describe("game: 6 × 4 board and side panel (DS 6)", () => {
  for (const size of [
    { width: 1024, height: 640 },
    { width: 1280, height: 720 },
  ]) {
    test(`all 24 cards and the whole panel fit at ${size.width} × ${size.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto("/it/play?seed=1");
      const items = board(page).getByRole("gridcell");
      await expect(items).toHaveCount(24);
      for (const item of await items.all()) {
        const box = await item.boundingBox();
        if (!box) throw new Error("no card box");
        expect(box.y).toBeGreaterThanOrEqual(56);
        expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      }
      // Six cards on the first row.
      const tops = await items.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
      expect(tops.filter((t) => t === tops[0])).toHaveLength(6);
      await expect(panel(page).getByRole("button", { name: "Indovina" })).toBeInViewport();
      const scroll = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.scrollHeight,
      ]);
      expect(scroll).toEqual([size.width, size.height]);
    });
  }

  test("an always-open panel instead of the sheet, in desktop wording", async ({ page }) => {
    await page.goto("/it/play?seed=1");
    await expect(panel(page)).toBeVisible();
    await expect(page.getByRole("button", { name: /questions$/ })).toHaveCount(0);
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");
    await panel(page).getByRole("button", { name: "Indovina" }).click();
    await expect(panel(page)).toContainText("Click the card you think it is.");
  });

  test("card positions are the same in playerTurn and playerReview", async ({ page }) => {
    await page.goto("/it/play?seed=1");
    const positions = () =>
      board(page)
        .getByRole("gridcell")
        .evaluateAll((els) => els.map((e) => JSON.stringify(e.getBoundingClientRect())));
    await expect(board(page).getByRole("gridcell")).toHaveCount(24);
    const before = await positions();
    await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
    await expect(panel(page).getByRole("button", { name: "Avanti" })).toBeVisible();
    await expect(panel(page)).toContainText("then click Avanti.");
    expect(await positions()).toEqual(before);
  });

  test("card names scale with the card, between 10 and 16 px", async ({ page }) => {
    const nameSize = () =>
      card(page, "Anna")
        .locator("span span span")
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    await page.goto("/it/play?seed=1");
    const big = await nameSize();
    expect(big).toBeGreaterThan(10);
    expect(big).toBeLessThanOrEqual(16);
    await page.setViewportSize({ width: 1024, height: 640 });
    const small = await nameSize();
    expect(small).toBeGreaterThanOrEqual(10);
    expect(small).toBeLessThan(big);
  });

  test("resizing across 1024px keeps flips and a guess in progress", async ({ page }) => {
    await page.goto("/it/play?seed=3");
    for (const name of ["Marco", "Sara", "Luca"]) await card(page, name).click();
    await panel(page).getByRole("button", { name: "Indovina" }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const sheet = page.getByRole("region", { name: "Questions" });
    await expect(sheet).toContainText("Tap the card you think it is.");
    await expect(page.getByRole("button", { name: /questions$/ })).toBeVisible();
    for (const name of ["Marco", "Sara", "Luca"])
      await expect(
        page.getByRole("button", { name: new RegExp(`^Guess ${name}: .*flipped down`) }),
      ).toHaveCount(1);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(panel(page)).toContainText("Click the card you think it is.");
    await panel(page).getByRole("button", { name: "Cancel guess" }).click();
    for (const name of ["Marco", "Sara", "Luca"])
      await expect(card(page, name)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[aria-label="Board"] button[aria-pressed="true"]')).toHaveCount(3);
  });

  test("resizing keeps a half-built Level 2 question", async ({ page }) => {
    await page.goto("/it/play?level=2&seed=5");
    await page.getByRole("group", { name: "Verb" }).getByRole("button").first().click();
    await page.getByRole("group", { name: "Noun" }).getByRole("button").first().click();
    const slots = page.getByRole("group", { name: "Your question" });
    const built = (await slots.textContent()) ?? "";
    expect(built).toContain("capelli");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("region", { name: "Questions" })).toBeVisible();
    await expect(slots).toHaveText(built);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(panel(page)).toBeVisible();
    await expect(slots).toHaveText(built);
  });
});

test.describe("mouse: hover preview and right-click (DS 7)", () => {
  const tooltip = (page: Page) => page.getByRole("tooltip");

  test("resting on a card shows a larger preview beside it; leaving hides it", async ({ page }) => {
    await page.goto("/it/play?seed=1");
    const chiara = card(page, "Chiara");
    await chiara.hover();
    await page.waitForTimeout(100);
    await expect(tooltip(page)).toHaveCount(0); // not before the delay
    await page.waitForTimeout(300);
    await expect(tooltip(page)).toBeVisible();
    await expect(tooltip(page)).toHaveText("Chiara");
    const id = await tooltip(page).getAttribute("id");
    await expect(chiara).toHaveAttribute("aria-describedby", id ?? "");
    // Beside the card, never over it, and twice as wide.
    const c = await chiara.boundingBox();
    const t = await tooltip(page).boundingBox();
    if (!c || !t) throw new Error("no boxes");
    expect(t.x >= c.x + c.width || t.x + t.width <= c.x).toBe(true);
    expect(t.width).toBeCloseTo(Math.min(c.width * 2, 256), 0);
    // Straight on to the next card: it swaps at once.
    await card(page, "Davide").hover();
    await expect(tooltip(page)).toHaveText("Davide", { timeout: 200 });
    await page.mouse.move(5, 300);
    await expect(tooltip(page)).toHaveCount(0);
  });

  test("no preview while guessing, or on a phone-sized window", async ({ page }) => {
    await page.goto("/it/play?seed=1");
    await panel(page).getByRole("button", { name: "Indovina" }).click();
    await page.getByRole("button", { name: /^Guess Chiara: / }).hover();
    await page.waitForTimeout(500);
    await expect(tooltip(page)).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/it/play?seed=1");
    await card(page, "Chiara").hover();
    await page.waitForTimeout(500);
    await expect(tooltip(page)).toHaveCount(0);
  });

  test("a click hides it, and it has no fade under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/it/play?seed=1");
    await card(page, "Elena").hover();
    await expect(tooltip(page)).toBeVisible();
    expect(await tooltip(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    await page.mouse.down();
    await expect(tooltip(page)).toHaveCount(0);
    await page.mouse.up();
  });

  test("right-click opens the card's detail and does not flip it", async ({ page }) => {
    await page.goto("/it/play?seed=1");
    const davide = card(page, "Davide");
    await davide.hover();
    await expect(tooltip(page)).toBeVisible();
    await davide.click({ button: "right" });
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("img", { name: "Davide" })).toBeVisible();
    await expect(tooltip(page)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(davide).toHaveAttribute("aria-pressed", "false");
    // Elsewhere, right-click does nothing of ours.
    await page.getByRole("button", { name: "Indovina" }).click({ button: "right" });
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("the context menu key on a focused card opens its detail", async ({ page, browserName }) => {
    await page.goto("/it/play?seed=1");
    await card(page, "Luca").focus();
    // The key raises contextmenu on the focused element. Macs have no such key and
    // WebKit does not raise it for a simulated one, so there the event is sent.
    if (browserName === "webkit") await card(page, "Luca").dispatchEvent("contextmenu");
    else await page.keyboard.press("ContextMenu");
    await expect(page.getByRole("dialog").getByRole("img", { name: "Luca" })).toBeVisible();
  });
});

// The name of the computer's card in a seeded round, to win it at once.
const cpuName = (seed: number) =>
  content.characters.find((c) => c.id === startGame(seed, 1, content).cpuSecret)?.name ?? "";

test.describe("round end and dialogs (DS 9.2, DS 9.6)", () => {
  test("round end is two columns, with Play again focused and not fixed", async ({ page }) => {
    await page.goto("/it/play?seed=5");
    await panel(page).getByRole("button", { name: "Indovina" }).click();
    await page.getByRole("button", { name: new RegExp(`^Guess ${cpuName(5)}: `) }).click();
    // Desktop: the dialog's focus starts on Guess, so Enter confirms.
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Guess", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "You won!" })).toBeVisible();

    const again = page.getByRole("button", { name: "Play again" });
    await expect(again).toBeFocused();
    expect(
      await again.evaluate((el) => getComputedStyle(el.parentElement as Element).position),
    ).toBe("static");
    // The questions sit to the right of the headline.
    const head = await page.getByRole("heading", { name: "You won!" }).boundingBox();
    const questions = await page.getByRole("heading", { name: "Questions" }).boundingBox();
    if (!head || !questions) throw new Error("no boxes");
    expect(questions.x).toBeGreaterThan(head.x + head.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
    await page.keyboard.press("Enter");
    await expect(page.locator("header")).toContainText("Turn 1");
  });

  test("dialogs close on Esc and on the backdrop, and give focus back", async ({ page }) => {
    await page.goto("/it/play?seed=1");
    const dialog = page.getByRole("dialog");
    // GuessConfirm, opened from the keyboard, at 24rem.
    await panel(page).getByRole("button", { name: "Indovina" }).click();
    const guess = page.getByRole("button", { name: /^Guess Anna: / });
    await guess.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    expect((await dialog.boundingBox())?.width).toBe(384);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(guess).toBeFocused();
    await guess.press("Enter");
    await expect(dialog).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(dialog).toBeHidden();
    await expect(guess).toBeFocused();
    // A click on the dialog's own padding does not close it.
    await guess.press("Enter");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    if (!box) throw new Error("no dialog box");
    await page.mouse.click(box.x + 4, box.y + 4);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await panel(page).getByRole("button", { name: "Cancel guess" }).click();

    // CardDetail, at 28rem.
    await card(page, "Anna").click({ button: "right" });
    await expect(dialog.getByRole("img", { name: "Anna" })).toHaveJSProperty("offsetWidth", 448);
    await page.mouse.click(10, 10);
    await expect(dialog).toBeHidden();

    // The quit confirmation.
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("menuitem", { name: "Quit round" }).click();
    await expect(dialog).toContainText("Quit this round?");
    await page.mouse.click(10, 10);
    await expect(dialog).toBeHidden();
    await expect(page.locator("header")).toContainText("Turn 1");
  });

  test("the sign-in sheet is a centred modal", async ({ page }) => {
    test.skip(!hasSupabase, "needs the local Supabase (CI starts it)");
    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    if (!box) throw new Error("no dialog box");
    expect(box.width).toBe(448); // 28rem
    expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThan(2);
    expect(Math.abs(box.y + box.height / 2 - 450)).toBeLessThan(2);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});

test.describe("keyboard (DS 4, DS 8)", () => {
  const focusedLabel = (page: Page) =>
    page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");

  test("a whole Level 1 round with only the shortcut keys (DS 2.1)", async ({ page }) => {
    const seed = 5;
    const g = startGame(seed, 1, content);
    await page.goto(`/it/play?seed=${seed}`);
    await expect(board(page)).toBeVisible();

    // q, then ↓ twice and Enter: the third question is asked.
    await page.keyboard.press("q");
    await expect(
      page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first(),
    ).toBeFocused();
    const first = await page.evaluate(() => document.activeElement?.textContent ?? "");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    const third = await page.evaluate(() => document.activeElement?.textContent ?? "");
    expect(third).not.toBe(first);
    await page.keyboard.press("Enter");
    await expect(panel(page).getByRole("button", { name: "Avanti" })).toBeVisible();

    // b, → and Enter flip the second card.
    await page.keyboard.press("b");
    expect(await focusedLabel(page)).toMatch(/^Anna: /);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(card(page, "Chiara")).toHaveAttribute("aria-pressed", "true");

    // a: the CPU asks; answer it truthfully with s or n; a again.
    await page.keyboard.press("a");
    const text = await panel(page).locator('p[lang="it"].text-2xl').innerText();
    const q = allQuestions(content).find((x) => x.text === text);
    const attrs = content.characters.find((c) => c.id === g.playerSecret)?.attrs;
    if (!q || !attrs) throw new Error("no CPU question");
    await page.keyboard.press(evaluate(q.asked, attrs) ? "s" : "n");
    await expect(panel(page)).toContainText("Right!");
    await page.keyboard.press("a");
    await expect(page.locator("header")).toContainText("Turn 2");

    // g, then the arrow keys to the computer's card, Enter, and Enter to confirm.
    await page.keyboard.press("g");
    await expect(panel(page)).toContainText("Click the card you think it is.");
    const index = content.characters.findIndex((c) => c.id === g.cpuSecret);
    await page.keyboard.press("Control+Home");
    for (let i = 0; i < index % 6; i++) await page.keyboard.press("ArrowRight");
    for (let i = 0; i < Math.floor(index / 6); i++) await page.keyboard.press("ArrowDown");
    expect(await focusedLabel(page)).toContain(`Guess ${cpuName(seed)}: `);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toContainText(`Guess ${cpuName(seed)}?`);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "You won!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play again" })).toBeFocused();
  });

  test("the board is one tab stop, moved around with the grid keys", async ({ page }) => {
    await page.goto("/it/play?seed=1");
    await expect(board(page)).toBeVisible();
    const tabStops = await board(page)
      .locator("button")
      .evaluateAll((els) => els.filter((e) => (e as HTMLElement).tabIndex >= 0).length);
    expect(tabStops).toBe(1);
    await page.keyboard.press("b");
    const names = content.characters.map((c) => c.name);
    const at = async () => (await focusedLabel(page)).split(":")[0];
    // No wrapping at the edges.
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowUp");
    expect(await at()).toBe(names[0]);
    await page.keyboard.press("End");
    expect(await at()).toBe(names[5]);
    await page.keyboard.press("ArrowRight");
    expect(await at()).toBe(names[5]);
    await page.keyboard.press("ArrowDown");
    expect(await at()).toBe(names[11]);
    await page.keyboard.press("Home");
    expect(await at()).toBe(names[6]);
    await page.keyboard.press("Control+End");
    expect(await at()).toBe(names[23]);
    await page.keyboard.press("ArrowDown");
    expect(await at()).toBe(names[23]);
    await page.keyboard.press("Control+Home");
    expect(await at()).toBe(names[0]);
    // The last card focused stays the tab stop.
    await page.keyboard.press("ArrowRight");
    await page.locator("body").focus();
    await page.keyboard.press("b");
    expect(await at()).toBe(names[1]);
    // i opens the detail view.
    await page.keyboard.press("i");
    await expect(page.getByRole("dialog").getByRole("img", { name: names[1] })).toBeVisible();
  });

  test("? and the menu open the shortcuts; the menu closes on Esc and outside", async ({
    page,
  }) => {
    await page.goto("/it/play?seed=1");
    await expect(board(page)).toBeVisible();
    await page.keyboard.press("?");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("?"); // a dialog is open: nothing more happens
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    const menu = page.getByRole("button", { name: "Menu" });
    await menu.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(menu).toBeFocused();
    await menu.click();
    await page.mouse.click(10, 300);
    await expect(page.getByRole("menu")).toBeHidden();
    await menu.click();
    await page.getByRole("menuitem", { name: "Keyboard shortcuts" }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toContainText("Press ? for shortcuts");
  });

  test("Level 2: Tab moves between tile rows, ← → along one", async ({ page, browserName }) => {
    // WebKit only Tabs to buttons with a macOS setting on (see a11y.spec.ts).
    test.skip(browserName !== "chromium", "Tab order for buttons is a macOS setting in WebKit");
    await page.goto("/it/play?level=2&seed=5");
    await expect(board(page)).toBeVisible();
    const row = (name: string) => page.getByRole("group", { name, exact: true });
    await page.keyboard.press("q");
    await expect(row("Verb").getByRole("button").first()).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(row("Verb").getByRole("button").nth(1)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(row("Article").getByRole("button").first()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(row("Noun").getByRole("button").first()).toBeFocused();
    await page.keyboard.press("ArrowLeft"); // no wrap
    await expect(row("Noun").getByRole("button").first()).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    // Back in the verb row, on the tile last focused there.
    await expect(row("Verb").getByRole("button").nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("group", { name: "Your question" })).not.toContainText("Verb");
  });

  test("buttons show their keys and carry aria-keyshortcuts", async ({ page }) => {
    await page.goto("/it/play?seed=1");
    const indovina = panel(page).getByRole("button", { name: "Indovina" });
    await expect(indovina).toHaveAttribute("aria-keyshortcuts", "g");
    await expect(indovina).toHaveText("IndovinaG");
    await expect(indovina).toHaveAccessibleName("Indovina");
  });

  test("keys with Ctrl, Cmd or Alt held do nothing", async ({ page }) => {
    await page.goto("/it/play?seed=1");
    await expect(board(page)).toBeVisible();
    await page.keyboard.press("Alt+g");
    await page.keyboard.press("Control+g");
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");
    await page.keyboard.press("G");
    await expect(panel(page)).toContainText("Click the card you think it is.");
    await page.keyboard.press("Escape");
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");
  });
});

test.describe("Home, Settings and Privacy (DS 9.1, 9.4, 9.5)", () => {
  const box = async (page: Page, l: ReturnType<Page["locator"]>) => {
    const b = await l.boundingBox();
    if (!b) throw new Error(`no box for ${page.url()}`);
    return b;
  };

  test("Home is two columns: the name on the left, levels and Play on the right", async ({
    page,
  }) => {
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/it");
      const main = page.locator("main");
      await expect(main).toContainText(
        "Ask yes-or-no questions in Italian to find the secret character.",
      );
      const title = await box(page, page.getByRole("heading", { name: "Chi è?" }));
      const play = await box(page, page.getByRole("button", { name: "Play" }));
      expect(play.x).toBeGreaterThan(title.x + title.width);
      // The two levels side by side.
      const one = await box(page, page.getByText("Level 1", { exact: true }));
      const two = await box(page, page.getByText("Level 2", { exact: true }));
      expect(two.y).toBe(one.y);
      expect(two.x).toBeGreaterThan(one.x);
      // The links and sign-in status are DesktopNav's.
      await expect(main.getByRole("link", { name: "Progress" })).toBeHidden();
      await expect(main.getByRole("link", { name: "Sign in" })).toBeHidden();
    }
  });

  test("Settings is rows under Game, Account and About", async ({ page }) => {
    await page.goto("/settings");
    for (const name of ["Game", "Account", "About"])
      await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
    const label = await box(page, page.getByText("Default level", { exact: true }));
    const control = await box(page, page.getByRole("radiogroup", { name: "Default level" }));
    expect(control.x).toBeGreaterThan(label.x + label.width);
    expect(Math.abs(control.y + control.height / 2 - (label.y + label.height / 2))).toBeLessThan(
      30,
    );
    // The default level still works from here.
    await page.getByRole("radio", { name: "Level 2" }).check();
    await page.goto("/it");
    await expect(page.getByRole("radio", { name: /Level 2/ })).toBeChecked();
  });

  test("Privacy is one reading column with a way back to Settings", async ({ page }) => {
    await page.goto("/privacy");
    const article = page.locator("article");
    const width = await article.evaluate((el) => el.getBoundingClientRect().width);
    const ch = await article.evaluate((el) => {
      const probe = document.createElement("span");
      probe.style.width = "65ch";
      probe.style.display = "block";
      el.append(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    });
    expect(width).toBeLessThanOrEqual(ch + 1);
    expect(await article.evaluate((el) => getComputedStyle(el).fontSize)).toBe("18px");
    await expect(page.locator("main").getByRole("link", { name: "Home" })).toBeHidden();
    await page.getByRole("link", { name: "Back to Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });
});

test.describe("Progress dashboard (DS 9.3)", () => {
  // A guest's games and review log, written to IndexedDB as the app keeps them.
  function seed(page: Page, data: GuestData) {
    return page.evaluate(
      (value) =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open("parlaplay", 1);
          open.onupgradeneeded = () => open.result.createObjectStore("kv");
          open.onsuccess = () => {
            const tx = open.result.transaction("kv", "readwrite");
            tx.objectStore("kv").put(value, "guest:it");
            tx.oncomplete = () => {
              open.result.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
      data,
    );
  }

  test("no tabs: four totals and both lists side by side", async ({ page }) => {
    const words = content.lexicon.filter((e) => e.pos === "noun").map((e) => e.id);
    const now = new Date();
    const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000);
    const row = (i: number, lexiconId: string, rating: ReviewLogRow["rating"], when: Date) => ({
      id: `r${i}`,
      language: "it" as const,
      gameId: "g1",
      lexiconId,
      direction: "recognize" as const,
      rating,
      localDay: localDay(when),
      createdAt: when.toISOString(),
      ...(rating === "slip"
        ? { detail: { slot: "art", given: "il", expected: "la", rule: "agreement" } }
        : {}),
    });
    const data: GuestData = {
      games: [
        {
          id: "g1",
          language: "it",
          seed: 1,
          level: 1,
          contentVersion: 1,
          startedAt: at(30).toISOString(),
          endedAt: at(29).toISOString(),
          result: "won",
        },
        {
          id: "g2",
          language: "it",
          seed: 2,
          level: 1,
          contentVersion: 1,
          startedAt: at(2).toISOString(),
          endedAt: at(1).toISOString(),
          result: "lost",
        },
      ],
      reviewLog: [
        row(1, words[0] ?? "", "good", at(30)),
        row(2, words[1] ?? "", "again", at(29)),
        row(3, words[2] ?? "", "again", at(2)),
        row(4, words[2] ?? "", "slip", at(1)),
      ] as ReviewLogRow[],
    };
    const expected = progressStats(data, now);

    await page.goto("/it");
    await seed(page, data);
    await page.goto("/it/progress");
    await expect(page.getByRole("tablist")).toHaveCount(0);
    for (const [label, value] of [
      ["Words seen", expected.wordsSeen],
      ["Due today", expected.dueToday],
      ["Mistakes this week", expected.mistakesThisWeek],
      ["Rounds played", expected.roundsPlayed],
    ] as const) {
      const tile = page.locator("dl > div").filter({ has: page.getByText(label, { exact: true }) });
      await expect(tile.locator("dd")).toHaveText(String(value));
    }
    expect(expected.wordsSeen).toBe(3);
    expect(expected.roundsPlayed).toBe(2);
    const mistakes = await page.getByRole("heading", { name: "Mistakes", level: 2 }).boundingBox();
    const due = await page.getByRole("heading", { name: "Due", level: 2 }).boundingBox();
    if (!mistakes || !due) throw new Error("no headings");
    expect(due.y).toBe(mistakes.y);
    expect(due.x).toBeGreaterThan(mistakes.x);
    await expect(page.getByRole("list", { name: "Mistakes by word" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Due today \(\d+\)$/ })).toHaveText(
      `Due today (${expected.dueToday})`,
    );
    await expect(page.locator("main").getByRole("link", { name: "Home" })).toHaveCount(0);
  });

  test("with no data, the empty message once, full width, with no tiles", async ({ page }) => {
    await page.goto("/it/progress");
    await expect(page.getByText("Play a round to see your words here.")).toHaveCount(1);
    await expect(page.locator("dl")).toHaveCount(0);
    await expect(page.getByRole("tablist")).toHaveCount(0);
  });
});

// The rest of the DS 13.3 cases.
test.describe("DS 13.3", () => {
  const flippedNames = (page: Page) =>
    page
      .locator('[aria-label="Board"] button[aria-pressed="true"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")?.split(":")[0]));

  test("resize: 1440 × 900 to 390 × 844 and back keeps the same 3 flips", async ({ page }) => {
    await page.goto("/it/play?seed=3");
    for (const name of ["Marco", "Sara", "Luca"]) await card(page, name).click();
    const before = await flippedNames(page);
    expect(before).toHaveLength(3);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("region", { name: "Questions" })).toBeVisible();
    await expect(page.getByRole("button", { name: /questions$/ })).toBeVisible();
    expect(await flippedNames(page)).toEqual(before);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(panel(page)).toBeVisible();
    expect(await flippedNames(page)).toEqual(before);
    await expect(page.locator("header")).toContainText("Turn 1");
  });

  test("typing sna in the sign-in email field changes nothing in a saved round", async ({
    page,
  }) => {
    test.skip(!hasSupabase, "needs the local Supabase (CI starts it)");
    await page.goto("/it/play?seed=1");
    await card(page, "Anna").click();
    await expect(card(page, "Anna")).toHaveAttribute("aria-pressed", "true");
    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const email = page.getByRole("textbox", { name: "Email" });
    await email.click();
    await page.keyboard.type("sna");
    await expect(email).toHaveValue("sna");
    await page.keyboard.press("Escape");
    await nav(page).getByRole("link", { name: "Continue", exact: true }).click();
    await expect(page.locator("header")).toContainText("Turn 1");
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");
    expect(await flippedNames(page)).toEqual(["Anna"]);
  });
});
