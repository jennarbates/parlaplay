import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { content } from "../../src/languages/zh/content/index.ts";
import { answersFor, build, card, chineseText, guessCard, savedRound, zh } from "./game.ts";
import { answerIds } from "../../src/languages/zh/ui/game/answers.ts";

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

test.describe("Level 2 type-to-find (ZS 7.2)", () => {
  const field = (page: Page) => panel(page).getByRole("combobox");
  const options = (page: Page) => panel(page).getByRole("option");
  const tray = (page: Page) => page.getByRole("group", { name: "Your question" });
  const trayText = async (page: Page) =>
    (await tray(page).getByRole("button").allTextContents()).join("");

  test("ta, you, gou, ma, each with Enter, then Enter again, asks 他有狗吗？", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=8");
    await field(page).focus();
    await page.keyboard.type("ta");
    await expect(options(page)).toHaveText(["他", "她"]);
    await expect(options(page).first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(field(page)).toHaveValue("");
    await expect(field(page)).toBeFocused();
    for (const word of ["you", "gou", "ma"]) {
      await page.keyboard.type(word);
      await page.keyboard.press("Enter");
    }
    expect(await trayText(page)).toBe("他有狗吗");
    await page.keyboard.press("Enter"); // the field is empty: ask
    await expect(panel(page).getByRole("button", { name: "Next" })).toBeVisible();
    expect((await savedRound(page))?.history.at(-1)?.text).toBe("他有狗吗？");
  });

  test("it is an APG combobox: the field keeps focus and names the selected option", async ({
    page,
  }) => {
    await page.goto("/zh/play?level=2&seed=8");
    await expect(field(page)).toHaveAttribute("aria-expanded", "false");
    await expect(field(page)).toHaveAttribute("aria-autocomplete", "list");
    await expect(field(page)).toHaveAttribute("placeholder", "Type pinyin, e.g. gou");
    await field(page).fill("n");
    await expect(field(page)).toHaveAttribute("aria-expanded", "true");
    await expect(options(page)).toHaveText(["你", "男的", "女的"]);
    const listId = (await field(page).getAttribute("aria-controls")) ?? "";
    await expect(page.locator(`[id="${listId}"]`)).toHaveRole("listbox");
    const active = async () =>
      page.locator(`[id="${await field(page).getAttribute("aria-activedescendant")}"]`);
    await expect(await active()).toHaveText("你");
    await page.keyboard.press("ArrowDown");
    await expect(await active()).toHaveText("男的");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp"); // wraps to the last
    await expect(await active()).toHaveText("女的");
    await expect(field(page)).toBeFocused();
    await page.keyboard.press("Enter");
    expect(await trayText(page)).toBe("女的");
    // Clicking an option picks it too, and focus stays in the field.
    await field(page).fill("x");
    await options(page).nth(1).click();
    expect(await trayText(page)).toBe("女的学校");
    await expect(field(page)).toBeFocused();
  });

  test("no match, a full tray, Backspace, Esc and nv", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=8");
    await field(page).fill("zz");
    await expect(panel(page)).toContainText("No word matches “zz”.");
    await page.keyboard.press("Enter"); // nothing to add
    expect(await trayText(page)).toBe("");
    await page.keyboard.press("Escape"); // clears the field, and only that
    await expect(field(page)).toHaveValue("");
    await expect(field(page)).toBeFocused();

    await field(page).fill("nv");
    await expect(options(page)).toHaveText(["女的"]);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Backspace"); // empty field: removes the last tile
    expect(await trayText(page)).toBe("");
    await page.keyboard.press("Backspace"); // nothing left: nothing happens
    await page.keyboard.press("Enter"); // empty field, empty tray: nothing is asked
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");

    for (const word of ["ta", "ta", "ni", "shi", "you", "zai"]) {
      await page.keyboard.type(word);
      await page.keyboard.press("Enter");
    }
    await expect(tray(page).getByRole("button")).toHaveCount(6);
    await page.keyboard.type("ma");
    await expect(panel(page)).toContainText("The question is full. Ask it, or remove a word.");
    await page.keyboard.press("Enter");
    await expect(tray(page).getByRole("button")).toHaveCount(6);

    // Esc on the empty field moves to the first tile row.
    await field(page).fill("");
    await page.keyboard.press("Escape");
    await expect(zh(panel(page), "他").first()).toBeFocused();
  });

  test("a held Enter adds one tile and does not ask (ZS 2.2)", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=8");
    await field(page).focus();
    await page.keyboard.type("gou");
    await page.keyboard.down("Enter");
    for (let i = 0; i < 4; i++) await page.keyboard.down("Enter"); // event.repeat
    await page.keyboard.up("Enter");
    expect(await trayText(page)).toBe("狗");
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");
  });

  test("a committed phrase that is a run of tiles adds them all (ZD16)", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=8");
    await field(page).fill("他有狗吗"); // as an IME commits it
    expect(await trayText(page)).toBe("他有狗吗");
    await expect(field(page)).toHaveValue("");
    await field(page).fill("他很好");
    await expect(panel(page)).toContainText("No word matches “他很好”.");
    await field(page).fill("狗");
    await expect(options(page)).toHaveText(["狗"]); // one word still asks for Enter
    // A run that would overfill the tray adds nothing.
    await field(page).fill("他有猫吗");
    await expect(panel(page)).toContainText("The question is full. Ask it, or remove a word.");
    await expect(tray(page).getByRole("button")).toHaveCount(4);
  });

  test("options show pinyin when the Pinyin toggle is on; Tab closes the list", async ({
    page,
  }) => {
    await page.goto("/zh/play?level=2&seed=8");
    await page.getByRole("checkbox", { name: "Pinyin" }).check();
    await field(page).fill("gou");
    await expect(options(page).first()).toContainText("gǒu");
    await page.keyboard.press("Tab");
    await expect(options(page)).toHaveCount(0);
    await expect(field(page)).toHaveValue("gou"); // the text stays
  });

  test("the phone has no find field", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/zh/play?level=2&seed=8");
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await expect(page.getByText("Build a question:")).toBeVisible();
  });
});

test.describe("keyboard (ZS 9)", () => {
  const focused = (page: Page) =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el?.dataset.card !== undefined ? `card ${el.dataset.card}` : (el?.tagName ?? "");
    });

  // The computer's turn, by number key: the right answer's place among the buttons.
  async function answerByNumber(page: Page) {
    await expect(page.getByRole("group", { name: "Your answer" })).toBeVisible();
    const round = await savedRound(page);
    const key = round?.pendingCpuQuestion?.key ?? "";
    const [right] = answersFor(key, round?.playerSecret ?? "");
    const place = answerIds(key, round?.level ?? 1).indexOf(right);
    await page.keyboard.press(String(place + 1));
    await expect(panel(page).getByRole("button", { name: "Next" })).toBeVisible();
    await expect(panel(page)).toContainText("Right!");
  }

  // g, then arrows from the first card to the computer's secret, Enter, Enter.
  async function guessByKeys(page: Page) {
    const secret = (await savedRound(page))?.cpuSecret;
    const index = content.characters.findIndex((c) => c.id === secret);
    await page.keyboard.press("g");
    await expect(panel(page)).toContainText("Click the card you think it is.");
    await page.keyboard.press("Control+Home");
    for (let i = 0; i < Math.floor(index / 6); i++) await page.keyboard.press("ArrowDown");
    for (let i = 0; i < index % 6; i++) await page.keyboard.press("ArrowRight");
    expect(await focused(page)).toBe(`card ${index}`);
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Guess", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "You won!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play again" })).toBeFocused();
  }

  test("a whole Level 1 round with only the keyboard (ZS 2.1)", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    await expect(cards(page)).toHaveCount(24);
    await page.keyboard.press("q");
    await expect(questions(page).getByRole("button").first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight"); // to the same row of 有
    await expect(questions(page).locator('[data-col="1"][data-row="1"]')).toBeFocused();
    await page.keyboard.press("t"); // 她
    await expect(questions(page).locator('[data-col="1"][data-row="1"]')).toContainText("她");
    await page.keyboard.press("Enter"); // ask
    await expect(panel(page).getByRole("button", { name: "Next" })).toBeVisible();
    // The question left with the phase: focus is on the board's card (ZS 2.2).
    expect(await focused(page)).toBe("card 0");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter"); // flip one
    await expect(cards(page).nth(1)).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("n");
    await page.keyboard.press("3"); // above the two answers shown: nothing
    await expect(page.getByRole("group", { name: "Your answer" })).toBeVisible();
    await page.keyboard.press("h");
    await expect(panel(page).getByRole("button", { name: /Show hint/ })).toHaveCount(0);
    await answerByNumber(page);
    await page.keyboard.press("n");
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");
    await page.keyboard.press("l");
    await expect(
      panel(page).getByRole("list", { name: "Round log" }).getByRole("listitem").first(),
    ).toBeFocused();
    await guessByKeys(page);
  });

  test("a whole Level 2 round with only the keyboard, typing pinyin", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=8");
    await expect(cards(page)).toHaveCount(24);
    await page.keyboard.press("/");
    await expect(panel(page).getByRole("combobox")).toBeFocused();
    for (const word of ["ta", "you", "gou", "ma"]) {
      await page.keyboard.type(word);
      await page.keyboard.press("Enter");
    }
    await page.keyboard.press("Enter"); // ask
    await expect(panel(page).getByRole("button", { name: "Next" })).toBeVisible();
    expect(await focused(page)).toBe("card 0"); // the find field left with the phase
    await page.keyboard.press("n");
    await page.keyboard.press("p"); // pinyin on the computer's question
    await expect(panel(page).locator("rt").first()).toBeVisible();
    await answerByNumber(page);
    await page.keyboard.press("n");
    // Turn 2: tiles by Tab and arrows, a to ask.
    await page.keyboard.press("q");
    await expect(zh(panel(page), "他").first()).toBeFocused();
    await page.keyboard.press("Enter"); // 他
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight"); // 有
    await page.keyboard.press("Enter");
    await page.keyboard.press("Backspace"); // off again
    await page.keyboard.press("Enter"); // and on
    const tray = page.getByRole("group", { name: "Your question" });
    await expect(tray.getByRole("button")).toHaveCount(2);
    await page.keyboard.press("/");
    await page.keyboard.type("mao");
    await page.keyboard.press("Enter");
    await page.keyboard.type("ma");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape"); // out of the empty field
    await page.keyboard.press("a");
    await expect(panel(page).getByRole("button", { name: "Next" })).toBeVisible();
    expect((await savedRound(page))?.history.at(-1)?.text).toBe("他有猫吗？");
    await page.keyboard.press("n");
    await answerByNumber(page);
    await page.keyboard.press("n");
    await guessByKeys(page);
  });

  test("each tile row is one tab stop, with arrows inside it", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=8");
    for (const label of ["Who, verbs and 吗", "People", "Pets and things", "Places"]) {
      const row = panel(page).getByRole("group", { name: label });
      await expect(row.locator('button[tabindex="0"]')).toHaveCount(1);
    }
    const row = panel(page).getByRole("group", { name: "People" });
    await row.getByRole("button").first().focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(row.getByRole("button").nth(2)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(row.getByRole("button").nth(1)).toBeFocused();
    await expect(row.locator('button[tabindex="0"]')).toHaveText("女的");
    await page.keyboard.press("Tab"); // on to the next row, not the next tile
    await expect(
      panel(page).getByRole("group", { name: "Pets and things" }).getByRole("button").first(),
    ).toBeFocused();
  });

  test("arrows skip asked questions and a column that is all asked", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    const at = (col: number, row: number) =>
      questions(page).locator(`[data-col="${col}"][data-row="${row}"]`);
    // Ask 他是男的吗？ (column 0, row 0), then come back to the player's turn.
    await at(0, 0).click();
    await panel(page).getByRole("button", { name: "Next" }).click();
    await page.getByRole("group", { name: "Your answer" }).getByRole("button").first().click();
    await panel(page).getByRole("button", { name: "Next" }).click();
    await page.keyboard.press("q");
    await expect(at(0, 1)).toBeFocused(); // the first one still open
    await page.keyboard.press("ArrowUp"); // nothing above it now
    await expect(at(0, 1)).toBeFocused();
    await at(1, 0).focus();
    await page.keyboard.press("ArrowLeft"); // row 0 of 是 is asked: its next open row
    await expect(at(0, 1)).toBeFocused();
    await at(1, 4).focus();
    await page.keyboard.press("ArrowRight"); // 在 has four: its last
    await expect(at(2, 3)).toBeFocused();
    await page.keyboard.press("ArrowRight"); // nowhere to go
    await expect(at(2, 3)).toBeFocused();
  });

  test("typing in the find field is not a shortcut", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=8");
    const field = panel(page).getByRole("combobox");
    await field.focus();
    await page.keyboard.type("nap");
    await expect(field).toHaveValue("nap");
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");
    await expect(page.getByRole("checkbox", { name: /Pinyin/ })).not.toBeChecked();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("keys that do not apply do nothing, and a held key acts once", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    await expect(cards(page)).toHaveCount(24);
    for (const key of ["p", "/", "a", "Backspace", "n", "1", "l"]) await page.keyboard.press(key);
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");
    await page.keyboard.press("Control+g");
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");
    // t held down switches once, not back and forth.
    await page.keyboard.down("t");
    for (let i = 0; i < 3; i++) await page.keyboard.down("t");
    await page.keyboard.up("t");
    await expect(
      panel(page)
        .getByRole("group", { name: "Ask about him or her" })
        .getByRole("button", { name: /她/ }),
    ).toHaveAttribute("aria-pressed", "true");
    // Esc cancels a guess.
    await page.keyboard.press("g");
    await page.keyboard.press("Escape");
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");
  });

  test("? and the menu open the shortcuts; no shortcut works behind a dialog or the menu", async ({
    page,
  }) => {
    await page.goto("/zh/play?seed=1");
    await expect(cards(page)).toHaveCount(24);
    await page.keyboard.press("?");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    expect((await box(dialog)).width).toBe(576); // 36rem
    for (const text of [
      "Go to the board",
      "type pinyin to find a word",
      "Answer the computer",
      "round log",
    ])
      await expect(dialog).toContainText(text);
    await page.keyboard.press("g"); // behind the dialog: nothing
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");

    await page.getByRole("button", { name: "Menu" }).click();
    await page.keyboard.press("g"); // behind the menu: nothing
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");
    await page.getByRole("menuitem", { name: "Keyboard shortcuts" }).click();
    await expect(dialog).toBeVisible();
  });

  test("controls show their keys and carry aria-keyshortcuts", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=8");
    for (const [name, key] of [
      ["Guess", "g"],
      ["Ask", "a"],
    ] as const) {
      const button = panel(page).getByRole("button", { name, exact: true });
      await expect(button).toHaveAttribute("aria-keyshortcuts", key);
      await expect(button.locator("kbd")).toHaveText(key.toUpperCase());
    }
    await expect(panel(page).getByRole("combobox")).toHaveAttribute("aria-keyshortcuts", "/");
    await build(page, "他", "有", "狗", "吗");
    await page.keyboard.press("a");
    await expect(panel(page).getByRole("button", { name: "Next" }).locator("kbd")).toHaveText("N");
    await page.keyboard.press("n");
    const answers = page.getByRole("group", { name: "Your answer" }).getByRole("button");
    await expect(answers).toHaveCount(7);
    await expect(answers.nth(6)).toHaveAttribute("aria-keyshortcuts", "7");
    await expect(answers.nth(6)).toContainText("7");
  });
});

test.describe("word glosses (ZS 7.4)", () => {
  const gloss = (page: Page) => page.getByRole("tooltip");
  const word = (scope: Locator, hanzi: string) =>
    scope.locator("span", { hasText: new RegExp(`^${hanzi}`) }).last();

  test("a word in the review and the log shows characters, pinyin and English", async ({
    page,
  }) => {
    await page.goto("/zh/play?level=2&seed=8");
    await build(page, "他", "有", "狗", "吗");
    await panel(page).getByRole("button", { name: "Ask", exact: true }).click();
    // playerReview: nothing is being rated, so English shows.
    const entry = panel(page)
      .getByRole("list", { name: "Round log" })
      .getByRole("listitem")
      .first();
    await word(entry, "狗").first().hover();
    await expect(gloss(page)).toHaveText(/狗\s*·\s*gǒu\s*·\s*dog/);
    // Hoverable: the pointer can move onto it and it stays (WCAG 1.4.13).
    await gloss(page).hover();
    await page.waitForTimeout(300);
    await expect(gloss(page)).toBeVisible();
    // Dismissible: Esc closes it without moving the pointer, and does nothing else.
    await page.keyboard.press("Escape");
    await expect(gloss(page)).toHaveCount(0);
    await expect(panel(page).getByRole("button", { name: "Next" })).toBeVisible();
    // The phase area's own sentence is glossable too.
    await word(panel(page).locator("div").first(), "有").first().hover();
    await expect(gloss(page)).toContainText("yǒu");
    await page.mouse.move(5, 300);
    await expect(gloss(page)).toHaveCount(0);
  });

  test("while the computer's question is pending, the gloss has no English", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=8");
    await build(page, "他", "有", "狗", "吗");
    await panel(page).getByRole("button", { name: "Ask", exact: true }).click();
    await panel(page).getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("group", { name: "Your answer" })).toBeVisible();
    const entry = panel(page)
      .getByRole("list", { name: "Round log" })
      .getByRole("listitem")
      .first();
    await word(entry, "狗").first().hover();
    await expect(gloss(page)).toContainText("gǒu");
    await expect(gloss(page)).not.toContainText("dog");
    await page.mouse.move(5, 300);
    // The live question and the answer buttons are never glossable.
    await panel(page).locator(".text-3xl").hover();
    await page.waitForTimeout(400);
    await expect(gloss(page)).toHaveCount(0);
  });

  test("tiles and Level 1's questions are not glossable", async ({ page }) => {
    await page.goto("/zh/play?level=2&seed=8");
    await zh(panel(page), "狗").first().hover();
    await page.waitForTimeout(400);
    await expect(gloss(page)).toHaveCount(0);
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

// ZS 12 and success criterion 6: axe finds nothing on any Shéi screen at desktop size.
test.describe("axe (WCAG 2.2 AA)", () => {
  const violations = async (page: Page) =>
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);

  test("Home and Progress, empty and with data", async ({ page }) => {
    await page.goto("/zh");
    await expect(page.getByRole("heading", { name: "谁？" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.goto("/zh/progress");
    await expect(page.getByText("Play a round to see your words here.")).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await page.goto("/zh/play?level=2&seed=8");
    await build(page, "他", "是", "狗", "吗");
    await panel(page).getByRole("button", { name: "Ask", exact: true }).click();
    await expect(panel(page)).toContainText("Try again.");
    expect(await violations(page), "Level 2 with feedback").toEqual([]);
    await page.goto("/zh/progress");
    await expect(page.getByRole("region", { name: "Mistakes" })).toContainText("是 → 有");
    expect(await violations(page), "Progress with data").toEqual([]);
  });

  test("every phase of a Level 1 round, the dialogs and round end", async ({ page }) => {
    await page.goto("/zh/play?seed=1");
    await expect(cards(page)).toHaveCount(24);
    expect(await violations(page), "playerTurn").toEqual([]);
    await questions(page).getByRole("button").first().click();
    await expect(panel(page).getByRole("button", { name: "Next" })).toBeVisible();
    expect(await violations(page), "playerReview").toEqual([]);
    await page.keyboard.press("n");
    await expect(page.getByRole("group", { name: "Your answer" })).toBeVisible();
    expect(await violations(page), "cpuTurn").toEqual([]);
    await page.keyboard.press("1");
    await expect(panel(page).getByRole("button", { name: "Next" })).toBeVisible();
    expect(await violations(page), "cpuReview").toEqual([]);
    await page.keyboard.press("n");
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    expect(await violations(page), "shortcuts").toEqual([]);
    await page.keyboard.press("Escape");
    await page.keyboard.press("g");
    expect(await violations(page), "guessing").toEqual([]);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toContainText("A wrong guess loses the round.");
    expect(await violations(page), "guess confirm").toEqual([]);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
    expect(await violations(page), "round end").toEqual([]);
  });

  test("Level 2: the builder with its find list, and the computer's seven answers", async ({
    page,
  }) => {
    await page.goto("/zh/play?level=2&seed=8");
    await panel(page).getByRole("combobox").fill("n");
    await expect(panel(page).getByRole("option")).toHaveCount(3);
    expect(await violations(page), "find list").toEqual([]);
    await panel(page).getByRole("combobox").fill("他有狗吗");
    await page.keyboard.press("Enter");
    await page.keyboard.press("n");
    await expect(page.getByRole("group", { name: "Your answer" })).toBeVisible();
    expect(await violations(page), "cpuTurn Level 2").toEqual([]);
  });
});
