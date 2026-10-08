import { expect, test, type Page } from "@playwright/test";
import { content } from "../../src/languages/zh/content/index.ts";
import { startGame } from "../../src/languages/zh/engine/start.ts";
import {
  answerCpu,
  build,
  guessCard,
  hanziOf,
  nameOf,
  picker,
  savedGuest,
  savedRound,
  waitForPhase,
} from "./game.ts";

// Round end, quit and continue, and Home (spec 8.1).

const savedGames = async (page: Page) => (await savedGuest(page)).games ?? [];
const savedPhase = async (page: Page) => (await savedRound(page))?.phase;

test.describe("round end (CHI-060)", () => {
  test("after a round with a mistake: result, both cards, history, mistakes, nudge, Play again", async ({
    page,
  }) => {
    const seed = 8;
    const g = startGame(seed, 2, content);
    await page.goto(`/play?level=2&seed=${seed}`);

    // A grammar mistake, then the fixed question.
    await build(page, "他", "是", "狗", "吗");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Use 有 (yǒu)");
    await page.getByRole("button", { name: "Clear" }).click();
    await build(page, "他", "有", "狗", "吗");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await page.getByRole("button", { name: "Next" }).click();

    // Answer the CPU wrongly.
    const wrong = await answerCpu(page, false, g.playerSecret);
    await page.getByRole("button", { name: "Next" }).click();

    // Guess right.
    await page.getByRole("button", { name: "Guess", exact: true }).click();
    await guessCard(page, nameOf(g.cpuSecret)).click();
    await page.getByRole("dialog").getByRole("button", { name: "Guess", exact: true }).click();

    await expect(page.getByRole("heading", { name: "You won!" })).toBeVisible();
    const cards = page.getByRole("region", { name: "Both cards" });
    await expect(
      cards.getByRole("img", { name: `Your card: ${nameOf(g.playerSecret)}` }),
    ).toBeVisible();
    await expect(
      cards.getByRole("img", { name: `Computer's card: ${nameOf(g.cpuSecret)}` }),
    ).toBeVisible();

    const history = page.getByRole("region", { name: "Questions" });
    await expect(history.getByRole("listitem")).toHaveCount(2);
    await expect(history).toContainText("他有狗吗？");
    await expect(history).toContainText(`(you said ${hanziOf(wrong.id)})`);

    const mistakes = page.getByRole("region", { name: "This round's mistakes" });
    await expect(mistakes.getByRole("listitem")).toHaveCount(2);
    await expect(mistakes).toContainText("狗: 是 → 有");
    await expect(mistakes).toContainText(`${hanziOf(wrong.id)} →`);

    await expect(
      page.getByRole("link", { name: "Sign in to keep your progress safe" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Play again" }).click();
    await expect(page.locator("header")).toContainText("Turn 1");
    await expect(page.getByRole("group", { name: "Your question" })).toBeVisible(); // still Level 2
  });

  test("a clean round has no mistakes, and Home goes home", async ({ page }) => {
    const g = startGame(5, 1, content);
    await page.goto("/play?seed=5");
    await page.getByRole("button", { name: "Guess", exact: true }).click();
    await guessCard(page, nameOf(g.cpuSecret)).click();
    await page.getByRole("dialog").getByRole("button", { name: "Guess", exact: true }).click();
    await expect(page.getByText("None. Nicely done.")).toBeVisible();
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page.getByRole("heading", { name: "谁？" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue round" })).toHaveCount(0);
  });

  test("when the computer finds you first, it says so", async ({ page }) => {
    // Answer every CPU question truthfully and never guess: the CPU wins.
    const g = startGame(3, 1, content);
    await page.goto("/play?seed=3");
    for (let i = 0; i < 8; i++) {
      if (await page.getByRole("heading", { name: "You lost." }).isVisible()) break;
      await picker(page).getByRole("button").nth(i).click();
      await page.getByRole("button", { name: "Next" }).click();
      await page.waitForTimeout(100);
      if (await page.getByRole("heading", { name: "You lost." }).isVisible()) break;
      await answerCpu(page, true, g.playerSecret);
      await page.getByRole("button", { name: "Next" }).click();
      await waitForPhase(page, "playerTurn").catch(() => undefined);
    }
    await expect(page.getByRole("heading", { name: "You lost." })).toBeVisible();
    await expect(
      page.getByText(`The computer found ${nameOf(g.playerSecret)} first.`),
    ).toBeVisible();
  });
});

test.describe("quit and continue (CHI-061)", () => {
  test("Quit round asks to confirm, records abandoned, and goes home", async ({ page }) => {
    await page.goto("/play?seed=4");
    await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("menuitem", { name: "Quit round" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Quit this round?");
    await expect(dialog).toContainText("It will count as abandoned.");

    // Keep playing does nothing.
    await dialog.getByRole("button", { name: "Keep playing" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("header")).toContainText("Turn 1");

    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("menuitem", { name: "Quit round" }).click();
    await dialog.getByRole("button", { name: "Quit round" }).click();
    await expect(page.getByRole("heading", { name: "谁？" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue round" })).toHaveCount(0);
    await expect
      .poll(async () => (await savedGames(page)).map((g) => g.result))
      .toEqual(["abandoned"]);
  });

  test("Home offers Continue round when one is saved, even after a reload", async ({ page }) => {
    await page.goto("/play?seed=4");
    await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect.poll(() => savedPhase(page)).toBe("cpuTurn");
    await page.goto("/");
    await expect(page.getByText("You have a round in progress (Level 1, turn 1).")).toBeVisible();
    await page.reload();
    const cont = page.getByRole("link", { name: "Continue round" });
    await expect(cont).toBeVisible();
    await cont.click();
    await expect(page.locator("header")).toContainText("Computer's turn");
  });

  test("starting a new round over a saved one records it abandoned", async ({ page }) => {
    await page.goto("/play?seed=4");
    await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
    await expect.poll(() => savedPhase(page)).toBe("playerReview");
    await page.goto("/");
    await page.getByRole("button", { name: "New round" }).click();
    await expect(page.locator("header")).toContainText("Turn 1");
    await expect(
      page.getByRole("list", { name: "Questions to ask" }).locator("button:disabled"),
    ).toHaveCount(0);
    await expect
      .poll(async () => (await savedGames(page)).map((g) => g.result ?? "open"))
      .toEqual(["abandoned", "open"]);
  });
});

test.describe("Home (CHI-062)", () => {
  test("level picker, Play, Progress, Settings and sign-in status", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header").getByText("Guest")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/settings");
    await expect(page.getByRole("link", { name: "Progress" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Level 1/ })).toBeChecked();
    await page.getByRole("radio", { name: /Level 2/ }).check();
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("group", { name: "Your question" })).toBeVisible();
  });

  test("the chosen level is remembered", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: /Level 2/ }).check();
    await page.reload();
    await expect(page.getByRole("radio", { name: /Level 2/ })).toBeChecked();
  });
});
