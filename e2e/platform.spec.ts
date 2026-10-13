import { expect, test, type Page } from "@playwright/test";
import { hasSupabase } from "./inbox.ts";
import { chooseItalian, chooseLanguage } from "./language.ts";
import { signIn } from "./signin.ts";
import { build, mistakes, savedRound, stored } from "./zh/game.ts";

// Platform spec 10.2, the E2E row: the picker, the last language, not-found, rounds
// and Progress kept apart per language, and one account over both. A full round in
// each language is level1.spec.ts and zh/level1.spec.ts; the handoff is
// handoff.spec.ts.

test("a first visit to / shows the picker, one card per language", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/languages$/);
  await expect(page.getByRole("heading", { name: "Choose a language" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Chi è\?/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /谁？/ })).toBeVisible();
});

test("choosing Chinese, then reloading /, opens /zh (D13)", async ({ page }) => {
  await chooseLanguage(page, /谁？/, "zh");
  await page.goto("/");
  await expect(page).toHaveURL(/\/zh$/);
  await expect(page.getByRole("heading", { name: "谁？" })).toBeVisible();
});

test("following a link to a language does not change the default (D14)", async ({ page }) => {
  await chooseItalian(page);
  await page.goto("/zh/progress");
  await page.goto("/");
  await expect(page).toHaveURL(/\/it$/);
});

test("Change language on Home goes back to the picker", async ({ page }) => {
  await chooseItalian(page);
  await page.getByRole("link", { name: "Change language" }).first().click();
  await expect(page).toHaveURL(/\/languages$/);
});

test("an unknown language shows the not-found screen", async ({ page }) => {
  await page.goto("/fr/play");
  await expect(
    page.getByRole("heading", { name: "We don't have that language yet." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Choose a language" }).click();
  await expect(page).toHaveURL(/\/languages$/);
});

test("Progress switches language without changing the default (8.1, D14)", async ({ page }) => {
  await chooseItalian(page);
  await page.goto("/it/progress");
  const languages = page.getByRole("group", { name: "Language" });
  await expect(languages.getByRole("button")).toHaveText(["Italian", "Chinese"]);
  await expect(languages.getByRole("button", { name: "Italian" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(languages.getByRole("button", { name: "Chinese" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await languages.getByRole("button", { name: "Chinese" }).click();
  await expect(page).toHaveURL(/\/zh\/progress$/);
  await expect(languages.getByRole("button", { name: "Chinese" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await languages.getByRole("button", { name: "Italian" }).click();
  await expect(page).toHaveURL(/\/it\/progress$/);

  await languages.getByRole("button", { name: "Chinese" }).click();
  await expect(page).toHaveURL(/\/zh\/progress$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/it$/);
});

// A picker card. On desktop the nav may link to a game by its title too.
const pickerCard = (page: Page, title: RegExp) =>
  page.getByRole("main").getByRole("link", { name: title });

// The mistake's row and the round are on disk, so leaving the page loses neither.
async function saved(page: Page, code: "it" | "zh") {
  await expect
    .poll(async () => (await stored<{ reviewLog: unknown[] }>(page, `guest:${code}`))?.reviewLog)
    .toHaveLength(1);
  await expect.poll(() => stored(page, `round:${code}`)).toBeDefined();
}

// A Level 2 mistake in each game, each on a word of its own.
const italianTile = (page: Page, group: string, name: string) =>
  page.getByRole("group", { name: group, exact: true }).getByRole("button", { name, exact: true });

async function italianMistake(page: Page) {
  await page.goto("/it/play?level=2&seed=8");
  await italianTile(page, "Verb", "ha").click();
  await italianTile(page, "Article", "il").click();
  await italianTile(page, "Noun", "barba").click();
  await page.getByRole("button", { name: "Chiedi" }).click(); // barba: il → la
  await saved(page, "it");
}

async function chineseMistake(page: Page) {
  await page.goto("/zh/play?level=2&seed=8");
  await build(page, "他", "是", "狗", "吗");
  await page.getByRole("button", { name: "Ask", exact: true }).click(); // 狗: 是 → 有
  await saved(page, "zh");
}

const italianMistakes = (page: Page) => page.getByRole("list", { name: "Mistakes by word" });

test("a saved round in each language survives switching (2, 3.3)", async ({ page }) => {
  await italianMistake(page);
  await chineseMistake(page);

  // Both cards on the picker offer their round.
  await page.goto("/languages");
  for (const title of [/Chi è\?/, /谁？/])
    await expect(pickerCard(page, title)).toContainText("Continue round");

  // Italian's round is as it was left: Level 2, turn 1, the mistake still to fix.
  await pickerCard(page, /Chi è\?/).click();
  await expect(page).toHaveURL(/\/it$/);
  await page
    .getByRole("link", { name: /^Continue( round)?$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/it\/play/);
  await expect(page.locator("header")).toContainText("Turn 1");
  await expect(page.getByRole("button", { name: "Chiedi" })).toBeVisible();

  // And so is Chinese's, after playing on in Italian.
  await page.goto("/zh");
  await page.getByRole("link", { name: "Continue round" }).click();
  await expect(page).toHaveURL(/\/zh\/play/);
  await expect(page.locator("header")).toContainText("Turn 1");
  await expect(page.getByRole("button", { name: "Ask", exact: true })).toBeVisible();
  expect((await savedRound(page))?.level).toBe(2);
});

test("Progress shows only its own language's words (3.4.1, 8.1)", async ({ page }) => {
  await italianMistake(page);
  await chineseMistake(page);

  await page.goto("/it/progress");
  await expect(italianMistakes(page)).toContainText("il → la");
  await expect(page.getByRole("main")).not.toContainText("狗");

  await page
    .getByRole("group", { name: "Language" })
    .getByRole("button", { name: "Chinese" })
    .click();
  await expect(page).toHaveURL(/\/zh\/progress$/);
  await expect(mistakes(page)).toContainText("是 → 有");
  await expect(page.getByRole("main")).not.toContainText("barba");
});

test.describe("one account, two languages (2, 6.3)", () => {
  test.skip(!hasSupabase, "needs the local Supabase (CI starts it)");
  // The prompt and the sheet are the same on desktop; the games are played on the phone.
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, "phone profiles only");

  const title = "Save your Italian and Chinese progress to this account?";

  async function quitRound(page: Page) {
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("menuitem", { name: "Quit round" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Quit round" }).click();
  }

  // A guest with a mistake in each language and no round left open.
  async function playBothAsGuest(page: Page) {
    await italianMistake(page);
    await quitRound(page);
    await chineseMistake(page);
    await quitRound(page);
    await expect(page.getByRole("heading", { name: "谁？" })).toBeVisible();
  }

  test("signing in with guest data in both shows one prompt and uploads both", async ({
    page,
    browser,
  }) => {
    await playBothAsGuest(page);
    const email = await signIn(page);
    const prompt = page.getByRole("dialog", { name: title });
    await expect(prompt).toBeVisible();
    await prompt.getByRole("button", { name: "Save", exact: true }).click();
    await expect(prompt).toBeHidden();
    await expect(page.getByText("Saved on this device, will sync later.")).toHaveCount(0);

    // Uploaded, not only kept here: a second device signing in sees both.
    const other = await (await browser.newContext()).newPage();
    await signIn(other, email);
    await expect(other.getByRole("dialog", { name: /^Save your/ })).toHaveCount(0);
    await other.goto("/it/progress");
    await expect(italianMistakes(other)).toContainText("il → la");
    await other.goto("/zh/progress");
    await expect(mistakes(other)).toContainText("是 → 有");
    await other.context().close();
  });

  test("Don't save deletes the guest data of both", async ({ page }) => {
    await playBothAsGuest(page);
    await signIn(page);
    const prompt = page.getByRole("dialog", { name: title });
    await prompt.getByRole("button", { name: "Don't save" }).click();
    await expect(prompt).toBeHidden();
    for (const path of ["/it/progress", "/zh/progress"]) {
      await page.goto(path);
      await expect(page.getByText("Play a round to see your words here.")).toBeVisible();
    }
  });

  test("sign-out clears both languages and both saved rounds", async ({ page }) => {
    await signIn(page);
    await italianMistake(page);
    await chineseMistake(page);
    await page.goto("/languages");
    for (const name of [/Chi è\?/, /谁？/])
      await expect(pickerCard(page, name)).toContainText("Continue round");

    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

    await page.goto("/languages");
    for (const name of [/Chi è\?/, /谁？/])
      await expect(pickerCard(page, name)).not.toContainText("Continue round");
    for (const path of ["/it/progress", "/zh/progress"]) {
      await page.goto(path);
      await expect(page.getByText("Play a round to see your words here.")).toBeVisible();
    }
    for (const key of ["guest:it", "guest:zh", "round:it", "round:zh"])
      expect(await stored(page, key)).toBeUndefined();
  });
});
