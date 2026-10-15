import { expect, test, type Page } from "@playwright/test";
import { content as it } from "../src/languages/it/content/index.ts";
import { startGame as startIt } from "../src/languages/it/engine/start.ts";
import { content as zh } from "../src/languages/zh/content/index.ts";
import { startGame as startZh } from "../src/languages/zh/engine/start.ts";
import { hasSupabase } from "./inbox.ts";
import { signIn } from "./signin.ts";

// Spec 7.3 and 8.2 (Shéi 7.3 the same): round end nudges guests to sign in, and
// only guests. Runs on the phone and desktop profiles, in both games.

const nudgeText = "Sign in to keep your progress safe";
const nudge = (page: Page) => page.getByRole("link", { name: nudgeText });

const games = [
  {
    name: "Chi è?",
    path: "/it",
    guessButton: "Indovina",
    cpuName: (seed: number) =>
      it.characters.find((c) => c.id === startIt(seed, 1, it).cpuSecret)?.name,
    separator: ":",
  },
  {
    name: "Shéi",
    path: "/zh",
    guessButton: "Guess",
    cpuName: (seed: number) =>
      zh.characters.find((c) => c.id === startZh(seed, 1, zh).cpuSecret)?.name,
    separator: "：",
  },
];

// Win at once by guessing the computer's card on the first turn. Notes whether the
// nudge was ever in the page, so a flash while sign-in loads is caught too.
async function winRound(page: Page, game: (typeof games)[number]) {
  await page.addInitScript((text) => {
    new MutationObserver(() => {
      if (document.body?.textContent?.includes(text)) {
        (window as unknown as { nudgeSeen: boolean }).nudgeSeen = true;
      }
    }).observe(document, { childList: true, subtree: true, characterData: true });
  }, nudgeText);
  await page.goto(`${game.path}/play?seed=5`);
  await page.getByRole("button", { name: game.guessButton, exact: true }).click();
  await page
    .getByRole("button", {
      name: new RegExp(`^Guess ${game.cpuName(5)}${game.separator}[^(]*$`),
    })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Guess", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You won!" })).toBeVisible();
}

const nudgeSeen = (page: Page) =>
  page.evaluate(() => (window as unknown as { nudgeSeen?: boolean }).nudgeSeen ?? false);

for (const game of games) {
  test.describe(`${game.name} round end`, () => {
    test("a guest gets the nudge, which goes to Settings", async ({ page }) => {
      test.skip(!hasSupabase, "needs the local Supabase (CI starts it)");
      await winRound(page, game);
      await expect(nudge(page)).toBeVisible();
      await nudge(page).click();
      await expect(page).toHaveURL(/\/settings$/);
    });

    test("signed in: no nudge, not even while sign-in loads", async ({ page }) => {
      test.skip(!hasSupabase, "needs the local Supabase (CI starts it)");
      await signIn(page);
      await winRound(page, game);
      await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
      await expect(nudge(page)).toHaveCount(0);
      expect(await nudgeSeen(page)).toBe(false);
    });

    test("a build without sign-in has no nudge", async ({ page }) => {
      test.skip(hasSupabase, "this build has sign-in");
      await winRound(page, game);
      await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
      await expect(nudge(page)).toHaveCount(0);
      expect(await nudgeSeen(page)).toBe(false);
    });
  });
}
