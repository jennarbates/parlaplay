import { expect, test, type Locator, type Page } from "@playwright/test";
import { content } from "../../src/languages/zh/content/index.ts";
import { build, card, chineseText, guessCard, savedRound, zh } from "./game.ts";

// zh-desktop.md ZS 13.3: Shéi at desktop size. Runs on the desktop profiles only
// (1440 × 900 unless a test sets another size).

const names = content.characters.map((c) => c.name);
const first = names[0] ?? "";
const panel = (page: Page) => page.getByRole("complementary", { name: "Questions" });
const cards = (page: Page) => page.locator('[aria-label="Board"] [data-card]');
// Level 1's questions: three columns at desktop size (ZS 7.1).
const questions = (page: Page) => panel(page).getByRole("group", { name: "Questions to ask" });

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

test.describe("Level 1: questions grouped by verb (ZS 7.1)", () => {
  const column = (page: Page, verb: string) =>
    questions(page).getByRole("region", { name: new RegExp(`^${verb}`) });

  test("three columns headed 是, 有 and 在, holding 5, 5 and 4 questions", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    for (const [verb, pinyin, english, count] of [
      ["是", "shì", "who they are", 5],
      ["有", "yǒu", "what they have", 5],
      ["在", "zài", "where they are", 4],
    ] as const) {
      const heading = column(page, verb).getByRole("heading");
      await expect(heading).toContainText(pinyin);
      await expect(heading).toContainText(english);
      await expect(column(page, verb).getByRole("button")).toHaveCount(count);
    }
    // Side by side, in that order.
    const xs = [];
    for (const verb of ["是", "有", "在"]) xs.push((await box(column(page, verb))).x);
    expect(xs[0]).toBeLessThan(xs[1] ?? 0);
    expect(xs[1]).toBeLessThan(xs[2] ?? 0);
    // The phone's single list is not here.
    await expect(page.getByRole("list", { name: "Questions to ask" })).toHaveCount(0);
  });

  test("the hint is one line, and shows whole on hover and on focus", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.goto("/zh/play?seed=1");
    const q = column(page, "是").getByRole("button").nth(2); // 他是老师吗？
    const hint = "Is he a teacher?";
    await expect(q).toHaveAccessibleDescription(hint);
    const line = q.locator("span", { hasText: hint }).first();
    expect((await box(line)).height).toBeLessThan(20); // one line
    const whole = q.locator('[aria-hidden="true"]', { hasText: hint });
    await expect(whole).toBeHidden();
    await q.hover();
    await expect(whole).toBeVisible();
    await page.mouse.move(5, 300);
    await expect(whole).toBeHidden();
    await q.focus();
    await expect(whole).toBeVisible();
  });

  test("an asked question is greyed and shows its answer; 她 changes every question", async ({
    page,
  }) => {
    await page.goto("/zh/play?seed=1");
    await panel(page).getByRole("button", { name: /她/ }).click();
    await expect(questions(page).getByRole("button").first()).toContainText("她");
    await questions(page).getByRole("button").first().click();
    await panel(page).getByRole("button", { name: "Next" }).click();
    await page.getByRole("group", { name: "Your answer" }).getByRole("button").first().click();
    await panel(page).getByRole("button", { name: "Next" }).click();
    const asked = questions(page).getByRole("button").first();
    await expect(asked).toBeDisabled();
    await expect(asked).toContainText(/，她/); // the answer, in place of the hint
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
        // The panel's middle holds the phase area first, then the log.
        [...(aside.children[1]?.children[0]?.children ?? [])].reduce(
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
    await measure(page, "L1 groups");
    // No question is wider than its column, pinyin included.
    for (const q of await questions(page).getByRole("button").all())
      expect(await q.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await questions(page).getByRole("button").first().click();
    await expect(panel(page).getByRole("button", { name: "Next" })).toBeVisible();
    await measure(page, "playerReview L1");
    await panel(page).getByRole("button", { name: "Next" }).click();
    await panel(page).getByRole("button", { name: "Show hint" }).click();
    await measure(page, "cpuTurn L1, hint");
  });
});

test.describe("round log (ZS 7.3)", () => {
  const log = (page: Page) => panel(page).getByRole("list", { name: "Round log" });
  const header = (page: Page) => panel(page).getByRole("button", { name: /^Round log/ });
  const next = (page: Page) => panel(page).getByRole("button", { name: "Next" }).click();

  // One whole turn at Level 1: ask the first question still open, then answer the
  // computer with its first answer button.
  async function turn(page: Page) {
    await questions(page).getByRole("button", { disabled: false }).first().click();
    await next(page);
    await page.getByRole("group", { name: "Your answer" }).getByRole("button").first().click();
    await next(page);
  }

  test("starts empty, then holds every question and answer, newest first", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    await expect(panel(page)).toContainText("Questions you and the computer ask show up here.");
    await turn(page);
    await expect(panel(page).getByRole("heading", { name: "Round log (2)" })).toBeVisible();
    const entries = log(page).getByRole("listitem");
    await expect(entries).toHaveCount(2);
    await expect(entries.nth(0)).toContainText("The computer asked");
    await expect(entries.nth(1)).toContainText("You asked");
    expect(await chineseText(entries.nth(1).locator("p").first())).toBe("他是男的吗？");

    // A reload mid-round rebuilds it from the saved history.
    await page.reload();
    await expect(log(page).getByRole("listitem")).toHaveCount(2);
  });

  test("one tab stop; arrows move; the focused entry shows its English when allowed", async ({
    page,
  }) => {
    await page.goto("/zh/play?seed=1");
    await turn(page);
    await expect(log(page).locator('[tabindex="0"]')).toHaveCount(1);
    const entries = log(page).getByRole("listitem");
    await entries.nth(0).focus();
    await expect(entries.nth(0)).toContainText(/(Is|Does) .+\? (Yes|No)\./); // playerTurn, Level 1
    await page.keyboard.press("ArrowDown");
    await expect(entries.nth(1)).toBeFocused();
    await expect(entries.nth(1)).toContainText("Is this person a man?");
    await page.keyboard.press("ArrowDown"); // the last one: stays
    await expect(entries.nth(1)).toBeFocused();

    // While the computer's question is being answered, no English (ZS 7.4).
    await questions(page).getByRole("button", { disabled: false }).first().click();
    await next(page);
    await entries.nth(0).focus();
    await expect(entries.nth(0)).not.toContainText(/Yes\.|No\./);
  });

  test("a wrong answer to the computer is marked", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=8");
    await build(page, "他", "有", "狗", "吗");
    await panel(page).getByRole("button", { name: "Ask", exact: true }).click();
    await next(page);
    await page.getByRole("group", { name: "Your answer" }).getByRole("button").nth(4).click(); // 不有
    await expect(log(page).getByRole("listitem").first()).toContainText("(you said 不有)");
  });

  test("with room for only its header, the header opens it over the phase area", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.goto("/zh/play?seed=1");
    await turn(page);
    await expect(log(page)).toHaveCount(0);
    await header(page).click();
    await expect(log(page).getByRole("listitem")).toHaveCount(2);
    await expect(log(page).getByRole("listitem").first()).toBeFocused();
    // It covers the phase area, from under the summary to above the actions.
    const over = await box(page.locator("[data-log-overlay]"));
    const under = await box(questions(page));
    expect(over.y).toBeLessThanOrEqual(under.y);
    expect(over.y + over.height).toBeGreaterThanOrEqual(under.y + under.height);
    await page.keyboard.press("Escape");
    await expect(log(page)).toHaveCount(0);
    await expect(header(page)).toBeFocused();
  });

  test("at Level 2 it stays closed while a question is being built (ZD17)", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=8"); // 1440 × 900: room to spare
    await build(page, "他", "有", "狗", "吗");
    await panel(page).getByRole("button", { name: "Ask", exact: true }).click();
    await expect(log(page).getByRole("listitem")).toHaveCount(1); // open in playerReview
    await next(page);
    await page.getByRole("group", { name: "Your answer" }).getByRole("button").first().click();
    await next(page);
    // The learner's turn again: only the header, though there is room.
    await expect(log(page)).toHaveCount(0);
    await expect(header(page)).toHaveText(/Round log \(2\)/);
    await header(page).click();
    await expect(log(page).getByRole("listitem")).toHaveCount(2);
    // Esc closes the log and nothing else.
    await page.keyboard.press("Escape");
    await expect(log(page)).toHaveCount(0);
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");
  });

  test("round end is two columns, the log on the right, Play again focused", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    await turn(page);
    await panel(page).getByRole("button", { name: "Guess" }).click();
    await guessCard(page, first).click();
    // Confirm with Enter and keep it held: the repeats must not press Play again.
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Guess", exact: true }),
    ).toBeFocused();
    await page.keyboard.down("Enter");
    const playAgain = page.getByRole("button", { name: "Play again" });
    await expect(playAgain).toBeFocused();
    for (let i = 0; i < 4; i++) await page.keyboard.down("Enter");
    await page.keyboard.up("Enter");
    await expect(playAgain).toBeVisible();
    const logRegion = page.getByRole("region", { name: /^Round log \(2\)/ });
    await expect(logRegion.getByRole("listitem")).toHaveCount(2);
    const cardsBox = await box(page.getByRole("region", { name: "Both cards" }));
    const logBox = await box(logRegion);
    expect(logBox.x).toBeGreaterThan(cardsBox.x + cardsBox.width - 1);
    expect(Math.round((await box(page.getByRole("img", { name: /^Your card/ }))).width)).toBe(192);
    // The phone's history list is replaced by the log here.
    await expect(page.getByRole("heading", { name: "Questions", exact: true })).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");
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
    await questions(page).getByRole("button").first().click();
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
