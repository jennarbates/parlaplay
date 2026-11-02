import { expect, test, type Page } from "@playwright/test";
import { hasSupabase } from "./inbox.ts";
import { chooseItalian, chooseLanguage } from "./language.ts";
import { signIn } from "./signin.ts";
import { build, mistakes, savedRound, stored } from "./zh/game.ts";

// Platform spec 10.2, the E2E row: the picker, the last language, not-found, rounds
// and Progress kept apart per language, and one account over both. A full round in
// each language is level1.spec.ts and zh/level1.spec.ts; the handoff is
// handoff.spec.ts.

test("/ is the home page: every language, each with its games", async ({ page }) => {
  await page.goto("/");
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.getByRole("heading", { name: "Choose a game" })).toBeVisible();
  for (const language of ["Italian", "Chinese"])
    await expect(page.getByRole("heading", { name: new RegExp(`^${language}`) })).toBeVisible();
  await expect(pickerCard(page, /Chi è\?/)).toHaveAttribute("href", "/it");
  await expect(pickerCard(page, /谁？/)).toHaveAttribute("href", "/zh");
  // Not playable yet, so listed without a link.
  await expect(page.getByText("Chi è stato?")).toBeVisible();
  await expect(pickerCard(page, /Chi è stato\?/)).toHaveCount(0);
  await page.getByRole("link", { name: "Chinese progress" }).click();
  await expect(page).toHaveURL(/\/zh\/progress$/);
});

test("choosing Chinese, then reloading /, still shows the home page", async ({ page }) => {
  await chooseLanguage(page, /谁？/, "zh");
  await page.goto("/");
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.getByRole("heading", { name: "Choose a game" })).toBeVisible();
});

test("following a link to a language does not change the default (D14)", async ({ page }) => {
  await chooseItalian(page);
  await page.goto("/zh/progress");
  expect(await stored(page, "app")).toEqual({ lastLanguage: "it" });
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
  expect(await stored(page, "app")).toEqual({ lastLanguage: "it" });
});

// A picker card. On desktop the nav may link to a game by its title too.
const pickerCard = (page: Page, title: RegExp) =>
  page.getByRole("main").getByRole("link", { name: title });

// The mistake's row and the round are on disk, so leaving the page loses neither.
// The row is under the guest's key, or under the user's when signed in.
async function saved(page: Page, code: "it" | "zh") {
  const rows = () =>
    page.evaluate(
      (suffix) =>
        new Promise<number>((resolve) => {
          const open = indexedDB.open("parlaplay");
          open.onsuccess = () => {
            const store = open.result.transaction("kv").objectStore("kv");
            const keys = store.getAllKeys();
            const values = store.getAll();
            values.onsuccess = () => {
              open.result.close();
              // Whichever of the two holds rows: a signed-in player's guest key is empty.
              const counts = keys.result.map((k, i) =>
                /^(guest|user):/.test(String(k)) && String(k).endsWith(suffix)
                  ? ((values.result[i] as { reviewLog?: unknown[] }).reviewLog?.length ?? 0)
                  : 0,
              );
              resolve(Math.max(0, ...counts));
            };
          };
        }),
      `:${code}`,
    );
  await expect.poll(rows).toBe(1);
  const round = code === "it" ? "round:it:chie" : "round:zh:shei";
  await expect.poll(() => stored(page, round)).toBeDefined();
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

  // The language of each of the signed-in player's rows in a table, from the
  // database itself, through its REST API and Row Level Security.
  function serverLanguages(page: Page, table: string): Promise<string[]> {
    return page.evaluate(
      async ({ url, key, table }) => {
        const stored = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
        const session = JSON.parse((stored && localStorage.getItem(stored)) ?? "{}") as {
          access_token?: string;
        };
        const res = await fetch(`${url}/rest/v1/${table}?select=language`, {
          headers: { apikey: key, Authorization: `Bearer ${session.access_token ?? ""}` },
        });
        if (!res.ok) return [];
        return ((await res.json()) as { language: string }[]).map((row) => row.language);
      },
      {
        url: process.env.VITE_SUPABASE_URL ?? "",
        key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        table,
      },
    );
  }

  // A guest with a mistake in each language and no round left open.
  async function playBothAsGuest(page: Page) {
    await italianMistake(page);
    await quitRound(page);
    await chineseMistake(page);
    await quitRound(page);
    await expect(page.getByRole("heading", { name: "谁？" })).toBeVisible();
  }

  test("signing in with guest data in both shows one prompt and uploads both", async ({ page }) => {
    await playBothAsGuest(page);
    await signIn(page);
    const prompt = page.getByRole("dialog", { name: title });
    await expect(prompt).toBeVisible();
    await prompt.getByRole("button", { name: "Save", exact: true }).click();
    await expect(prompt).toBeHidden();
    await expect(page.getByText("Saved on this device, will sync later.")).toHaveCount(0);

    // Uploaded, not only kept here: the account's rows on the server are in both
    // languages. Read with the player's own session, as the app would.
    for (const table of ["games", "review_log"]) {
      await expect
        .poll(async () => [...new Set(await serverLanguages(page, table))].sort())
        .toEqual(["it", "zh"]);
    }
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
    for (const key of ["guest:it", "guest:zh", "round:it:chie", "round:zh:shei"])
      expect(await stored(page, key)).toBeUndefined();
  });
});
