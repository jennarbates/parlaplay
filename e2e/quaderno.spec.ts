import { expect, test, type Page } from "@playwright/test";
import { hasSupabase } from "./inbox.ts";
import { signIn } from "./signin.ts";

// The workbook: progress, best scores and the reset, as a guest. Merging across
// devices is covered in src/quaderno/merge.test.ts.
const firstExercise = (page: Page) => page.locator('.ex[data-id="1.1-0"]');

async function answerFirstExercise(page: Page, wrong = 0) {
  const ex = firstExercise(page);
  const count = await ex.locator("li").count();
  for (let i = 0; i < count; i++) {
    const options = ex.locator("li").nth(i).locator(".opt");
    // The first exercise's right answers, in order.
    const right = ["Di dov’è?", "Come sta?", "Ciao", "Ciao", "Come ti chiami?"][i] as string;
    const pick =
      i < wrong
        ? options.filter({ hasNotText: right }).first()
        : options.getByText(right, { exact: true });
    await pick.click();
  }
}

test("the home page links to the workbook", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Italian workbook" }).click();
  await expect(page).toHaveURL(/\/quaderno\/$/);
  await expect(page.getByRole("heading", { name: "Benvenut* a tutt*!" })).toBeVisible();
  await expect(page.locator("#account")).toContainText("Saved on this device only");
});

test("a best score survives a reload and a worse try", async ({ page }) => {
  await page.goto("/quaderno/#c1");
  await answerFirstExercise(page, 1);
  await expect(firstExercise(page).locator(".best")).toHaveText("Best: 4 of 5");
  await page.reload();
  await expect(firstExercise(page).locator(".best")).toHaveText("Best: 4 of 5");
  await expect(page.locator("#overall")).toContainText("1 of");
  await answerFirstExercise(page, 3);
  await expect(firstExercise(page).locator(".best")).toHaveText("Best: 4 of 5");
});

test("reset asks first, then clears progress and writing", async ({ page }) => {
  await page.goto("/quaderno/#c1");
  await answerFirstExercise(page);
  const writing = page.locator("textarea.free").first();
  await writing.fill("Ciao, mi chiamo Sam. Come ti chiami?");
  await page.getByRole("button", { name: "Reset progress" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(firstExercise(page).locator(".best")).toHaveText("Best: 5 of 5");
  await page.getByRole("button", { name: "Reset progress" }).click();
  await page.getByRole("button", { name: "Yes, erase" }).click();
  await expect(firstExercise(page).locator(".best")).toHaveText("");
  await expect(page.locator("textarea.free").first()).toHaveValue("");
  await page.reload();
  await expect(page.locator("#overall")).toContainText("0 of");
});

test("progress saved before scores had timestamps is kept", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("tat1:doc")) return;
    localStorage.setItem("tat1:progress", JSON.stringify({ "1.1-0": { score: 3, total: 5 } }));
  });
  await page.goto("/quaderno/#c1");
  await expect(firstExercise(page).locator(".best")).toHaveText("Best: 3 of 5");
});

test("the house game names what you tap, and lights one thing up to name", async ({ page }) => {
  await page.goto("/quaderno/#c5");
  const game = page.locator('.ex[data-id="5.3-6"]');
  await expect(game.locator(".casa-q")).toContainText("Vedo, vedo…");
  await game.getByRole("button", { name: "l’armadio" }).click();
  await expect(game.locator(".feedback")).toContainText("l’armadio · wardrobe");
  await game.getByRole("button", { name: "Come si chiama?" }).click();
  await expect(game.locator(".t.glow")).toHaveCount(1);
  await expect(game.getByRole("textbox", { name: "name, with its article" })).toBeVisible();
});

test("the hard house game takes typed guesses, and tapping doesn't give it away", async ({
  page,
}) => {
  await page.goto("/quaderno/#c5");
  const game = page.locator('.ex[data-id="5.3-6"]');
  await game.getByRole("button", { name: "Difficile" }).click();
  const clues = game.locator(".casa-c p");
  await expect(clues).toHaveCount(1);
  await game.getByRole("button", { name: "l’armadio" }).click();
  await expect(game.locator(".feedback")).toBeEmpty();
  // Nothing in the house is a garage, so this is always wrong.
  const guess = game.getByRole("textbox", { name: "what I see, with its article" });
  await guess.fill("il garage");
  await guess.press("Enter");
  await expect(game.locator(".feedback")).toContainText("non è “il garage”");
  await expect(clues).toHaveCount(2);
  await game.getByRole("button", { name: "Un altro indizio" }).click();
  await expect(clues).toHaveCount(3);
  await guess.fill("il garage");
  await guess.press("Enter");
  await expect(game.locator(".feedback")).toContainText("Era");
  await expect(game.getByRole("button", { name: "Avanti" })).toBeVisible();
});

test("find the intruder marks the odd one out and explains why", async ({ page }) => {
  await page.goto("/quaderno/#c5");
  const game = page.locator('.ex[data-id="5.2-4"]');
  await expect(game.locator(".casa-q")).toContainText("Chi è l’intruso?");
  await expect(game.locator(".intr-w")).toHaveCount(3);
  await game.locator(".intr-w").first().click();
  await expect(game.locator(".intr-w.ok")).toHaveCount(1);
  await expect(game.locator(".feedback")).toContainText("l’intruso è");
  await expect(game.locator(".intr-w .en").first()).toBeVisible();
  await game.getByRole("button", { name: "Avanti" }).click();
  await expect(game.locator(".stats")).toContainText("Round 2 of 8");
});

test("the chapter 2 intruder game uses the chapter's own words", async ({ page }) => {
  await page.goto("/quaderno/#c2");
  const game = page.locator('.ex[data-id="2.7-6"]');
  await expect(game.locator(".ex-t")).toContainText("Trova l’intruso!");
  await expect(game.locator(".intr-w")).toHaveCount(3);
  await game.locator(".intr-w").first().click();
  await expect(game.locator(".feedback")).toContainText("l’intruso è");
});

test("the reflexive dice game wants the pronoun with the verb", async ({ page }) => {
  await page.goto("/quaderno/#c5");
  const game = page.locator('.ex[data-id="5.4-6"]');
  await expect(game.locator(".ex-t")).toContainText("Giochiamo con i dadi!");
  const prompt = (await game.locator(".drill-p .big").textContent()) ?? "";
  const [subject, verb] = prompt.split(" + ") as [string, string];
  const person = ["io", "tu", "lui/lei/Lei", "noi", "voi", "loro"].indexOf(subject);
  const expected = await page.evaluate(
    ([v, p]) => (window as unknown as { present: (v: string) => string[] }).present(v)[p],
    [verb, person] as const,
  );
  expect(expected).toMatch(/^(mi|ti|si|ci|vi) /);
  await game.getByRole("textbox").fill(expected ?? "");
  await game.getByRole("button", { name: "Check" }).click();
  await expect(game.locator(".feedback")).toContainText("Esatto!");
});

test("memory pairs an Italian word with its meaning and turns a wrong pair back", async ({
  page,
}) => {
  await page.goto("/quaderno/#c4");
  const game = page.locator(".ex", { has: page.locator(".mem") });
  const cards = game.locator(".mem-c");
  await expect(cards).toHaveCount(12);
  await game.locator('.mem-c.it[data-pair="0"]').click();
  await game.locator('.mem-c.en[data-pair="0"]').click();
  await expect(game.locator(".mem-c.ok")).toHaveCount(2);
  await expect(game.locator(".feedback")).toContainText("Sì!");
  await game.locator('.mem-c.it[data-pair="1"]').click();
  await game.locator('.mem-c.en[data-pair="2"]').click();
  await expect(game.locator(".mem-c.no")).toHaveCount(2);
  await expect(game.locator(".mem-c.up")).toHaveCount(2);
  await expect(game.locator(".stats")).toContainText("1 of 6 pairs · 2 moves");
  await game.getByRole("combobox", { name: "memory group" }).selectOption({ index: 2 });
  await expect(game.locator(".stats")).toContainText("6 of 13 words dealt");
});

test.describe("signed in", () => {
  test.skip(!hasSupabase, "needs the local Supabase (CI starts it)");
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, "phone profiles only");

  test("progress follows the account to another device, and a reset does too", async ({
    page,
    browser,
  }) => {
    const email = await signIn(page);
    await page.goto("/quaderno/#c1");
    await answerFirstExercise(page, 1);
    await expect(page.locator("#account")).toHaveText("Saved to your account.");

    const other = await browser.newContext();
    const phone = await other.newPage();
    await signIn(phone, email);
    await phone.goto("/quaderno/#c1");
    await expect(firstExercise(phone).locator(".best")).toHaveText("Best: 4 of 5");

    await phone.getByRole("button", { name: "Reset progress" }).click();
    await phone.getByRole("button", { name: "Yes, erase" }).click();
    await expect(phone.locator("#account")).toHaveText("Saved to your account.");
    await page.reload();
    await expect(firstExercise(page).locator(".best")).toHaveText("");
    await other.close();
  });

  test("a different account doesn't inherit this device's progress", async ({ page }) => {
    await signIn(page);
    await page.goto("/quaderno/#c1");
    await answerFirstExercise(page);
    await expect(page.locator("#account")).toHaveText("Saved to your account.");
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage))
        if (key.startsWith("sb-")) localStorage.removeItem(key);
    });
    await page.goto("/");
    await signIn(page);
    await page.goto("/quaderno/#c1");
    await expect(firstExercise(page).locator(".best")).toHaveText("");
  });
});
