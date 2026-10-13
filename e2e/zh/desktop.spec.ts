import { expect, test, type Locator, type Page } from "@playwright/test";
import { content } from "../../src/languages/zh/content/index.ts";
import { build, card, guessCard, savedRound, zh } from "./game.ts";

// zh-desktop.md ZS 13.3: Shéi at desktop size. Runs on the desktop profiles only
// (1440 × 900 unless a test sets another size).

const names = content.characters.map((c) => c.name);
const first = names[0] ?? "";
const panel = (page: Page) => page.getByRole("complementary", { name: "Questions" });
const cards = (page: Page) => page.locator('[aria-label="Board"] [data-card]');

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("no box");
  return b;
}

const noPageScroll = (page: Page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth <= d.clientWidth && d.scrollHeight <= d.clientHeight;
  });

test.describe("layout: board on the left, panel on the right (ZS 5, ZS 6)", () => {
  // ZS 5.2's worked sizes.
  for (const [width, height, cardWidth] of [
    [1024, 640, 77],
    [1280, 720, 93],
    [1440, 900, 131],
    [1920, 1080, 168],
  ] as const) {
    test(`at ${width} × ${height} cards are ${cardWidth}px and the panel 448px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/zh/play?level=2&seed=1");
      await expect(cards(page)).toHaveCount(24);
      expect(Math.round((await box(cards(page).first())).width)).toBe(cardWidth);
      expect((await box(panel(page))).width).toBe(448);
      // The board is centred in its column.
      const column = width - 448;
      const left = (await box(cards(page).first())).x;
      const right = column - ((await box(cards(page).nth(5))).x + cardWidth);
      expect(Math.abs(left - right)).toBeLessThan(2);
    });
  }

  for (const level of [1, 2] as const) {
    for (const [width, height] of [
      [1024, 640],
      [1440, 900],
    ] as const) {
      test(`Level ${level} fits ${width} × ${height} with no page scroll`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto(`/zh/play?level=${level}&seed=1`);
        await expect(cards(page)).toHaveCount(24);
        expect(await noPageScroll(page)).toBe(true);
        for (const c of await cards(page).all()) await expect(c).toBeInViewport({ ratio: 1 });
        await expect(
          panel(page).getByText("Your turn: ask a question, or guess."),
        ).toBeInViewport();
        await expect(panel(page).getByRole("button", { name: "Guess" })).toBeInViewport();
      });
    }
  }

  test("an always-open panel instead of the sheet", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    await expect(panel(page)).toBeVisible();
    await expect(page.getByRole("button", { name: /questions$/ })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Questions" })).toHaveCount(0);
  });

  test("captions grow to 16px and 12px (ZD4)", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    const caption = page.locator('[aria-label="Board"] p').first();
    const size = (lang: string) =>
      caption.locator(`[lang="${lang}"]`).evaluate((el) => getComputedStyle(el).fontSize);
    expect(await size("zh-Hans")).toBe("16px");
    expect(await size("zh-Latn-pinyin")).toBe("12px");
    expect((await box(caption)).height).toBe(36);
  });

  test("Level 2: Clear and Ask are in the actions, in desktop wording (ZD5)", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=1");
    await expect(panel(page)).toContainText("Click words below, or type pinyin");
    const guess = await box(panel(page).getByRole("button", { name: "Guess" }));
    for (const name of ["Clear", "Ask"]) {
      const b = await box(panel(page).getByRole("button", { name, exact: true }));
      expect(Math.abs(b.y - guess.y)).toBeLessThan(2); // one row, pinned at the bottom
    }
    await build(page, "他", "有", "狗", "吗");
    await panel(page).getByRole("button", { name: "Clear" }).click();
    await expect(panel(page)).toContainText("Click words below, or type pinyin");
    await build(page, "他", "有", "狗", "吗");
    await panel(page).getByRole("button", { name: "Ask", exact: true }).click();
    await expect(panel(page)).toContainText("Flip down everyone this rules out, then click Next.");
  });

  test("guessing says Click, and the confirm is 24rem with focus on Guess", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    await panel(page).getByRole("button", { name: "Guess" }).click();
    await expect(panel(page)).toContainText("Click the card you think it is.");
    await guessCard(page, first).click();
    const dialog = page.getByRole("dialog");
    expect((await box(dialog)).width).toBe(384);
    await expect(dialog.getByRole("button", { name: "Guess", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("Enter held on a card while guessing opens the confirm and goes no further", async ({
    page,
  }) => {
    await page.goto("/zh/play?seed=1");
    await panel(page).getByRole("button", { name: "Guess" }).click();
    await cards(page).first().focus();
    await page.keyboard.down("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("A wrong guess loses the round.");
    for (let i = 0; i < 5; i++) await page.keyboard.down("Enter"); // event.repeat
    await page.keyboard.up("Enter");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Play again" })).toHaveCount(0);
  });
});

// ZS 6.3: at 1024 × 640 the panel has 422px for the phase area and the log, and the
// log's header needs 44px, so no phase area may be taller than 378px.
test.describe("phase areas fit 1024 × 640 (ZS 6.3)", () => {
  const budget = 378;
  // The height of what the phase area holds, whatever the area itself stretches to.
  const areaHeight = (page: Page) =>
    panel(page).evaluate((aside) =>
      Math.round(
        [...(aside.children[1]?.children ?? [])].reduce(
          (h, c) => h + c.getBoundingClientRect().height,
          0,
        ),
      ),
    );
  const measured: Record<string, number> = {};
  const measure = async (page: Page, name: string) => {
    measured[name] = await areaHeight(page);
    expect(measured[name], name).toBeLessThanOrEqual(budget);
  };
  test.afterAll(() => console.log("ZS 6.3 measured:", JSON.stringify(measured)));

  test("Level 2: the builder, with pinyin and with feedback, and every later phase", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.goto("/zh/play?level=2&seed=8");
    const ask = () => panel(page).getByRole("button", { name: "Ask", exact: true }).click();
    await measure(page, "L2 builder");
    await page.getByRole("checkbox", { name: "Pinyin" }).check();
    await measure(page, "L2 builder, pinyin");
    await build(page, "他", "是", "狗", "吗"); // one mistake: the wrong verb
    await ask();
    await expect(panel(page)).toContainText("Try again.");
    await measure(page, "L2 builder, pinyin, one mistake");
    await page.getByRole("checkbox", { name: "Pinyin" }).uncheck();
    await measure(page, "L2 builder, one mistake");
    await panel(page).getByRole("button", { name: "Clear" }).click();
    // Three mistakes at once is the tallest feedback there is. It may scroll (ZD18),
    // and the feedback is what shows first.
    await build(page, "你", "狗", "有");
    await ask();
    measured["L2 builder, three mistakes (scrolls)"] = await areaHeight(page);
    await expect(panel(page).getByRole("status").first()).toBeInViewport({ ratio: 1 });
    await panel(page).getByRole("button", { name: "Clear" }).click();
    await build(page, "他", "有", "狗", "吗");
    await ask();
    await expect(panel(page).getByRole("button", { name: "Next" })).toBeVisible();
    await measure(page, "playerReview");
    await panel(page).getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("group", { name: "Your answer" })).toBeVisible();
    await measure(page, "cpuTurn L2");
    await page.getByRole("checkbox", { name: "Pinyin" }).count();
    await page.getByRole("group", { name: "Your answer" }).getByRole("button").nth(4).click(); // 不有
    await expect(panel(page).getByRole("button", { name: "Next" })).toBeVisible();
    await measure(page, "cpuReview, wrong");
  });

  test("Level 1: the CPU's question with its hint, and the reviews", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.goto("/zh/play?seed=8");
    await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
    await expect(panel(page).getByRole("button", { name: "Next" })).toBeVisible();
    await measure(page, "playerReview L1");
    await panel(page).getByRole("button", { name: "Next" }).click();
    await panel(page).getByRole("button", { name: "Show hint" }).click();
    await measure(page, "cpuTurn L1, hint");
  });
});

test.describe("mouse and board keys (ZS 8, ZS 9.4)", () => {
  const tooltip = (page: Page) => page.getByRole("tooltip");

  test("resting on a card shows its face, name and pinyin over it", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    const c = cards(page).nth(7);
    await c.hover();
    await expect(tooltip(page)).toBeVisible();
    await expect(tooltip(page)).toContainText(names[7] ?? "");
    await expect(tooltip(page).locator('[lang="zh-Latn-pinyin"]')).toHaveText(
      content.characters[7]?.namePinyin ?? "",
    );
    const cb = await box(c);
    const tb = await box(tooltip(page));
    expect(tb.x < cb.x + cb.width && tb.x + tb.width > cb.x).toBe(true);
    expect(tb.y < cb.y + cb.height && tb.y + tb.height > cb.y).toBe(true);
    expect(tb.width).toBeCloseTo(Math.min(cb.width * 2, 256), 0);
    await page.mouse.move(5, 300);
    await expect(tooltip(page)).toHaveCount(0);
  });

  test("no preview while guessing", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    await panel(page).getByRole("button", { name: "Guess" }).click();
    await cards(page).nth(7).hover();
    await page.waitForTimeout(600);
    await expect(tooltip(page)).toHaveCount(0);
  });

  test("right-click opens the card's detail and does not flip it", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    await card(page, first).click({ button: "right" });
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("img", { name: first })).toBeVisible();
    expect(Math.round((await box(dialog.getByRole("img", { name: first }))).width)).toBe(448);
    await page.keyboard.press("Escape");
    await expect(card(page, first)).toHaveAttribute("aria-pressed", "false");
  });

  test("the board is a grid with one tab stop; arrows move, Enter flips, i zooms", async ({
    page,
  }) => {
    await page.goto("/zh/play?seed=1");
    await expect(page.getByRole("grid", { name: "Board" }).getByRole("row")).toHaveCount(4);
    await expect(page.locator('[aria-label="Board"] [data-card][tabindex="0"]')).toHaveCount(1);
    const at = () => page.evaluate(() => (document.activeElement as HTMLElement).dataset.card);
    await cards(page).first().focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    expect(await at()).toBe("7");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft"); // no wrap at the edge
    expect(await at()).toBe("6");
    await page.keyboard.press("End");
    expect(await at()).toBe("11");
    await page.keyboard.press("Control+End");
    expect(await at()).toBe("23");
    await page.keyboard.press("Control+Home");
    expect(await at()).toBe("0");
    await page.keyboard.press("Enter");
    await expect(card(page, first)).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("i");
    await expect(page.getByRole("dialog").getByRole("img", { name: first })).toBeVisible();
  });

  test("the menu closes on Esc and on a click outside, and gives focus back", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    const menu = page.getByRole("button", { name: "Menu" });
    await menu.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(menu).toBeFocused();
    await menu.click();
    await cards(page).nth(12).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  });
});

test.describe("resize across 1024px (ZS 2.2)", () => {
  const phone = { width: 390, height: 844 };
  const desktop = { width: 1440, height: 900 };

  test("flips, the Level 2 tray and a guess survive, there and back", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=1");
    for (const i of [0, 5, 9]) await cards(page).nth(i).click();
    await build(page, "他", "有");
    const tray = page.getByRole("group", { name: "Your question" });
    await expect(tray.getByRole("button")).toHaveCount(2);

    await page.setViewportSize(phone);
    await expect(page.getByRole("region", { name: "Questions" })).toBeVisible();
    await expect(tray.getByRole("button")).toHaveCount(2);
    expect((await savedRound(page))?.flipped).toHaveLength(3);

    await page.setViewportSize(desktop);
    await expect(panel(page)).toBeVisible();
    await expect(tray.getByRole("button")).toHaveCount(2);
    await expect(zh(tray, "他")).toBeVisible();
    await expect(page.locator('[aria-label="Board"] [data-flipped="true"]')).toHaveCount(3);

    await panel(page).getByRole("button", { name: "Guess" }).click();
    await page.setViewportSize(phone);
    await expect(page.getByText("Tap the card you think it is.")).toBeVisible();
  });

  test("a shown hint survives", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
    await panel(page).getByRole("button", { name: "Next" }).click();
    await panel(page).getByRole("button", { name: "Show hint" }).click();
    await expect(panel(page).getByRole("button", { name: "Show hint" })).toHaveCount(0);
    await page.setViewportSize(phone);
    await expect(page.getByRole("button", { name: "Show hint" })).toHaveCount(0);
    await page.setViewportSize(desktop);
    await expect(panel(page).getByRole("button", { name: "Show hint" })).toHaveCount(0);
  });
});

test.describe("Home and Progress (ZS 10.1, ZS 10.3)", () => {
  const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

  test("Home is two columns: the name and pitch, then the levels and Play", async ({ page }) => {
    await page.goto("/zh");
    const title = page.getByRole("heading", { name: "谁？" });
    expect(await title.evaluate((el) => getComputedStyle(el).fontSize)).toBe("60px");
    const main = page.getByRole("main");
    await expect(main.getByText("Shéi?")).toBeVisible();
    await expect(main.getByText("Chinese", { exact: true })).toBeVisible(); // platform spec 8.1
    await expect(main).toContainText("Ask questions in Chinese to find the secret character.");
    await expect(main).toContainText("Click ready-made questions, with English hints");

    const l1 = await box(page.locator("label", { hasText: "Level 1" }));
    const l2 = await box(page.locator("label", { hasText: "Level 2" }));
    expect(Math.abs(l1.y - l2.y)).toBeLessThan(2); // side by side
    expect(l1.x).toBeGreaterThan((await box(title)).x + 300); // in the right column
    // The phone's links and sign-in line are DesktopNav's job here.
    await expect(main.getByRole("link", { name: "Progress" })).toBeHidden();
    await expect(main.getByRole("link", { name: "Sign in" })).toBeHidden();
    await expect(nav(page).getByRole("link", { name: "Progress" })).toBeVisible();

    await page.locator("label", { hasText: "Level 2" }).click();
    await main.getByRole("button", { name: "Play" }).click();
    await expect(page).toHaveURL(/\/zh\/play/);
    await expect(panel(page)).toContainText("Click words below, or type pinyin");
  });

  test("Progress with no data: one message, no tiles, no tabs", async ({ page }) => {
    await page.goto("/zh/progress");
    await expect(page.getByText("Play a round to see your words here.")).toHaveCount(1);
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(page.getByRole("term")).toHaveCount(0);
  });

  test("Progress is four totals and both lists side by side", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=8");
    await build(page, "他", "是", "狗", "吗"); // a mistake on 狗
    await panel(page).getByRole("button", { name: "Ask", exact: true }).click();
    await expect(panel(page)).toContainText("Try again.");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("menuitem", { name: "Quit round" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Quit round" }).click();
    await expect(page.getByRole("heading", { name: "谁？" })).toBeVisible();

    await page.goto("/zh/progress");
    await expect(page.getByRole("tablist")).toHaveCount(0);
    const total = (label: string) =>
      page.locator("dl > div", { hasText: label }).getByRole("definition");
    await expect(total("Words seen")).toHaveText("1");
    await expect(total("Due today")).toHaveText("1");
    await expect(total("Mistakes this week")).toHaveText("1");
    await expect(total("Rounds played")).toHaveText("1");

    const mistakes = page.getByRole("region", { name: "Mistakes" });
    const due = page.getByRole("region", { name: "Due", exact: true });
    await expect(mistakes).toContainText("是 → 有");
    await expect(due).toContainText("狗");
    await expect(due.getByRole("heading", { level: 3, name: /Due today/ })).toBeVisible();
    const m = await box(mistakes);
    const d = await box(due);
    expect(Math.abs(m.y - d.y)).toBeLessThan(2);
    expect(d.x).toBeGreaterThan(m.x + m.width - 1);
    // The phone's Home link is the nav's job.
    await expect(page.getByRole("main").getByRole("link", { name: "Home" })).toHaveCount(0);
  });

  test("no horizontal scroll on any Shéi screen at 1024 and 1440, DesktopNav on all but the game", async ({
    page,
  }) => {
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ["/zh", "/zh/progress", "/settings", "/privacy"]) {
        await page.goto(path);
        await expect(nav(page)).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
          `${path} at ${width}`,
        ).toBe(true);
      }
      await page.goto("/zh/play?seed=1");
      await expect(cards(page)).toHaveCount(24);
      expect(await noPageScroll(page)).toBe(true);
      await expect(nav(page)).toHaveCount(0);
    }
  });
});
