import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { content } from "../src/languages/it/content/index.ts";
import { allQuestions } from "../src/languages/it/engine/index.ts";
import { evaluate } from "../src/languages/it/engine/meaning.ts";
import { startGame } from "../src/languages/it/engine/start.ts";

// CHI-090: WCAG 2.2 AA basics. Screen reader names in Italian, a whole round by
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
    await page.goto("/it");
    expect(await smallTargets(page)).toEqual([]);
    for (const path of ["/it/progress", "/settings", "/privacy"]) {
      await page.goto(path);
      expect(await smallTargets(page), path).toEqual([]);
    }
    await page.goto("/it/play?seed=5");
    await expect(page.getByRole("list", { name: "Questions to ask" })).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
    // The CPU's turn, with Show hint.
    await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Avanti" }).click();
    await expect(page.getByRole("button", { name: "Show hint" })).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
  });

  // PLAY-039, platform spec 10.2: the platform's own screens. Settings is above.
  test("the picker, the not-found screens and the handoff's failure screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Choose a game" })).toBeVisible();
    expect(await smallTargets(page), "/").toEqual([]);

    for (const [path, heading] of [
      ["/fr", "We don't have that language yet."],
      ["/nowhere/at/all", "Page not found."],
      ["/import", "We couldn't bring your progress over."],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      expect(await smallTargets(page), path).toEqual([]);
    }
  });

  test("Level 2 builder and the round end", async ({ page }) => {
    await page.goto("/it/play?level=2&seed=5");
    await page
      .getByRole("group", { name: "Adjective", exact: true })
      .getByRole("button")
      .first()
      .click();
    expect(await smallTargets(page)).toEqual([]);
    const g = startGame(5, 2, content);
    const name = content.characters.find((c) => c.id === g.cpuSecret)?.name ?? "";
    await page.getByRole("button", { name: "Indovina" }).click();
    await page.getByRole("button", { name: new RegExp(`^Guess ${name}: [^(]*$`) }).click();
    expect(await smallTargets(page)).toEqual([]); // the confirm dialog
    await page.getByRole("dialog").getByRole("button", { name: "Guess", exact: true }).click();
    await expect(page.getByRole("heading", { name: "You won!" })).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
  });
});

test("each card's accessible name lists name and attributes in Italian", async ({ page }) => {
  await page.goto("/it/play?seed=1");
  // A list on the phone, a grid on desktop (desktop spec DS 8.2).
  const cards = page.locator('[aria-label="Board"] button[aria-pressed]');
  await expect(cards).toHaveCount(24);
  const names = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  for (const n of names)
    expect(n).toMatch(
      /^[A-Z][a-z]+: capelli [a-z]+ [a-z]+, occhi [a-z]+(, (occhiali|cappello|barba|baffi))*$/,
    );
  expect(names).toContain("Giulia: capelli rossi corti, occhi verdi");
});

test.describe("keyboard only", () => {
  // WebKit on macOS does not Tab to buttons unless the system setting is on, so
  // this runs in Chromium; the same markup serves both.
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Tab order for buttons is a macOS setting in WebKit",
  );
  // On desktop the board is one tab stop with arrow keys; desktop.spec.ts plays
  // its own keyboard round with the shortcut keys (desktop spec DS 2.1).
  test.skip(({ isMobile }) => !isMobile, "phone tab order; desktop.spec.ts covers desktop");

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
    await page.goto("/it/play?seed=5");
    await page.locator("body").focus();

    // Ask the first question.
    const first = allQuestions(content)[0];
    if (!first) throw new Error("no questions");
    await tabTo(page, (el) => el.text.startsWith(first.text));
    const outline = await page.evaluate(
      () => getComputedStyle(document.activeElement as Element).outlineStyle,
    );
    expect(outline).toBe("solid");
    await page.keyboard.press("Enter");
    await tabTo(page, (el) => el.text === "Avanti");
    await page.keyboard.press("Enter");

    // Answer the CPU truthfully.
    const text = await page.evaluate(
      () =>
        document.querySelector('section[aria-label="Questions"] p[lang="it"]')?.textContent ?? "",
    );
    const q = allQuestions(content).find((x) => x.text === text);
    const attrs = content.characters.find((c) => c.id === g.playerSecret)?.attrs;
    if (!q || !attrs) throw new Error("no CPU question");
    const answer = evaluate(q.asked, attrs) ? "Sì" : "No";
    await tabTo(page, (el) => el.text === answer);
    await page.keyboard.press("Enter");
    await tabTo(page, (el) => el.text === "Avanti");
    await page.keyboard.press("Enter");

    // Flip a card and open its Zoom view from the keyboard.
    await tabTo(page, (el) => el.label.startsWith("Anna: "));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /^Anna: / })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    // Guess right, confirming in the dialog.
    const name = content.characters.find((c) => c.id === g.cpuSecret)?.name ?? "";
    await tabTo(page, (el) => el.text === "Indovina");
    await page.keyboard.press("Enter");
    await page.locator("body").focus();
    await tabTo(page, (el) => el.label.startsWith(`Guess ${name}: `));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toContainText(`Guess ${name}?`);
    await tabTo(page, (el) => el.text === "Guess", 5);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "You won!" })).toBeVisible();

    // Play again.
    await tabTo(page, (el) => el.text === "Play again");
    await page.keyboard.press("Enter");
    await expect(page.locator("header")).toContainText("Turn 1");
  });
});

// axe over Chi è? and the shared screens, at whatever size the profile is: the
// phones and the desktops both run this (spec 9, WCAG 2.2 AA).
test.describe("axe finds nothing", () => {
  const violations = async (page: Page) =>
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
  const phone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;
  // On the phone the questions are in a sheet that may be folded: open it.
  const openSheet = async (page: Page) => {
    if (!phone(page)) return;
    const toggle = page.getByRole("button", { name: /questions$/ });
    if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  };

  test("the picker, Home, Progress, Settings, Privacy and not-found", async ({ page }) => {
    for (const [path, heading] of [
      ["/", "Choose a game"],
      ["/it", "Chi è?"],
      ["/it/progress", "Progress"],
      ["/settings", "Settings"],
      ["/privacy", "Privacy"],
      ["/fr", "We don't have that language yet."],
      ["/import", "We couldn't bring your progress over."],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
      expect(await violations(page), path).toEqual([]);
    }
  });

  test("a Level 1 round: every phase, the confirm and round end", async ({ page }) => {
    await page.goto("/it/play?seed=5");
    await expect(page.getByRole("list", { name: "Questions to ask" })).toBeVisible();
    expect(await violations(page), "playerTurn").toEqual([]);
    await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
    await expect(page.getByRole("button", { name: "Avanti" })).toBeVisible();
    await openSheet(page);
    expect(await violations(page), "playerReview").toEqual([]);
    await page.getByRole("button", { name: "Avanti" }).click();
    await page.getByRole("button", { name: "Show hint" }).click();
    expect(await violations(page), "cpuTurn").toEqual([]);
    await page
      .getByRole("button", { name: /^(Sì|No)/ })
      .first()
      .click();
    await expect(page.getByRole("button", { name: "Avanti" })).toBeVisible();
    await openSheet(page);
    expect(await violations(page), "cpuReview").toEqual([]);
    await page.getByRole("button", { name: "Avanti" }).click();
    await page.getByRole("button", { name: "Indovina" }).click();
    expect(await violations(page), "guessing").toEqual([]);
    await page
      .getByRole("button", { name: /^Guess / })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toContainText("A wrong guess loses the round.");
    expect(await violations(page), "guess confirm").toEqual([]);
    await page.getByRole("dialog").getByRole("button", { name: "Guess", exact: true }).click();
    await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
    expect(await violations(page), "round end").toEqual([]);
  });

  test("Level 2: the builder, and feedback after a mistake", async ({ page }) => {
    await page.goto("/it/play?level=2&seed=8");
    const tile = (group: string, name: string) =>
      page
        .getByRole("group", { name: group, exact: true })
        .getByRole("button", { name, exact: true });
    await expect(tile("Verb", "ha")).toBeVisible();
    expect(await violations(page), "builder").toEqual([]);
    await tile("Verb", "ha").click();
    await tile("Article", "il").click();
    await tile("Noun", "barba").click();
    await page.getByRole("button", { name: "Chiedi" }).click();
    await expect(page.getByRole("status").first()).toBeVisible();
    expect(await violations(page), "feedback").toEqual([]);
    await page.goto("/it/progress");
    await expect(page.getByText("il → la").first()).toBeVisible();
    expect(await violations(page), "Progress with data").toEqual([]);
  });
});
