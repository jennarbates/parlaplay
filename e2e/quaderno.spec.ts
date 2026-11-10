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
