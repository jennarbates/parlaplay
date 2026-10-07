import { expect, test, type Page } from "@playwright/test";
import { content } from "../src/content/index.ts";
import { startGame } from "../src/engine/start.ts";
import { answersFor, savedRound, waitForPhase } from "./game.ts";

// CHI-090: WCAG 2.2 AA basics. Screen reader names in Chinese, a whole round by
// keyboard with visible focus, and 44 × 44 px touch targets.

// Every visible control smaller than 44 × 44 px. A radio or checkbox counts as its
// label, which is the thing you actually tap.
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      "button, a[href], input, select, textarea, [role=tab], [role=menuitem]",
    )) {
      const target = el.matches("input[type=radio], input[type=checkbox]")
        ? (el.closest("label") ?? el)
        : el;
      const r = target.getBoundingClientRect();
      const style = getComputedStyle(el);
      // Visually hidden until focused (sr-only) controls measure 1 × 1: skip them.
      const hidden =
        r.width <= 1 ||
        r.height <= 1 ||
        style.visibility === "hidden" ||
        el.closest("[hidden], dialog:not([open])");
      if (hidden) continue;
      if (Math.round(r.width) < 44 || Math.round(r.height) < 44) {
        small.push(
          `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(r.width)}×${Math.round(r.height)}`,
        );
      }
    }
    return small;
  });
}

test.describe("touch targets are at least 44 × 44 px", () => {
  test("Home, Progress and the game at both levels", async ({ page }) => {
    await page.goto("/");
    expect(await smallTargets(page)).toEqual([]);
    for (const path of ["/progress", "/settings", "/privacy"]) {
      await page.goto(path);
      expect(await smallTargets(page), path).toEqual([]);
    }
    await page.goto("/play?seed=5");
    await expect(page.getByRole("list", { name: "Questions to ask" })).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
    // The CPU's turn, with Show hint.
    await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("button", { name: "Show hint" })).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
  });

  test("Level 2 builder and the round end", async ({ page }) => {
    await page.goto("/play?level=2&seed=5");
    await page.getByRole("checkbox", { name: "Pinyin" }).check();
    await page.getByRole("group", { name: "People" }).getByRole("button").first().click();
    expect(await smallTargets(page)).toEqual([]);
    const g = startGame(5, 2, content);
    const name = content.characters.find((c) => c.id === g.cpuSecret)?.name ?? "";
    await page.getByRole("button", { name: "Guess", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(`^Guess ${name}：[^(]*$`) }).click();
    expect(await smallTargets(page)).toEqual([]); // the confirm dialog
    await page.getByRole("dialog").getByRole("button", { name: "Guess", exact: true }).click();
    await expect(page.getByRole("heading", { name: "You won!" })).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
  });
});

test("each card's accessible name lists name and attributes in Chinese (spec 9)", async ({
  page,
}) => {
  await page.goto("/play?seed=1");
  const cards = page.locator('ul[aria-label="Board"] button[aria-pressed]');
  await expect(cards).toHaveCount(24);
  const names = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  for (const n of names)
    expect(n).toMatch(
      /^\p{Script=Han}{2}：(男的|女的)，(老师|学生|医生)，在(家|学校|医院|饭店)(，有(狗|猫|手机|书|电脑))+$/u,
    );
  await expect(cards.first()).toHaveAttribute("lang", "zh-Hans");
});

test.describe("keyboard only", () => {
  // WebKit on macOS does not Tab to buttons unless the system setting is on, so
  // this runs in Chromium; the same markup serves both.
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Tab order for buttons is a macOS setting in WebKit",
  );

  // Press Tab until the focused element matches, proving it is reachable.
  async function tabTo(
    page: Page,
    matches: (el: { label: string; text: string }) => boolean,
    limit = 120,
  ) {
    for (let i = 0; i < limit; i++) {
      await page.keyboard.press("Tab");
      const el = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        return { label: a?.getAttribute("aria-label") ?? "", text: a?.textContent?.trim() ?? "" };
      });
      if (matches(el)) return;
    }
    throw new Error("never reached by Tab");
  }

  test("a whole round, with visible focus", async ({ page }) => {
    const g = startGame(5, 1, content);
    await page.goto("/play?seed=5");
    await page.locator("body").focus();

    // Ask the first question.
    await tabTo(page, (el) => el.text.endsWith("Is he a man?"));
    const outline = await page.evaluate(
      () => getComputedStyle(document.activeElement as Element).outlineStyle,
    );
    expect(outline).toBe("solid");
    await page.keyboard.press("Enter");
    await tabTo(page, (el) => el.text === "Next");
    await page.keyboard.press("Enter");

    // Answer the CPU truthfully. Level 1 buttons show pinyin above the characters.
    await waitForPhase(page, "cpuTurn");
    const key = (await savedRound(page))?.pendingCpuQuestion?.key ?? "";
    const right = content.lexicon.find((e) => e.id === answersFor(key, g.playerSecret)[0]);
    await tabTo(page, (el) => el.text === `${right?.pinyin}${right?.hanzi}`);
    await page.keyboard.press("Enter");
    await tabTo(page, (el) => el.text === "Next");
    await page.keyboard.press("Enter");

    // Flip a card and open its Zoom view from the keyboard.
    await tabTo(page, (el) => el.label.startsWith("王明："));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /^王明：/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    // Guess right, confirming in the dialog.
    const name = content.characters.find((c) => c.id === g.cpuSecret)?.name ?? "";
    await tabTo(page, (el) => el.text === "Guess");
    await page.keyboard.press("Enter");
    await page.locator("body").focus();
    await tabTo(page, (el) => el.label.startsWith(`Guess ${name}：`));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toContainText(`Guess ${name}`);
    await tabTo(page, (el) => el.text === "Guess", 5);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "You won!" })).toBeVisible();

    // Play again.
    await tabTo(page, (el) => el.text === "Play again");
    await page.keyboard.press("Enter");
    await expect(page.locator("header")).toContainText("Turn 1");
  });
});
