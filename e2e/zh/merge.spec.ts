import { expect, test, type Page } from "@playwright/test";
import { hasSupabase, newEmail } from "./inbox.ts";
import { signIn } from "./signin.ts";

// CHI-086: two devices on one account end up with the same Progress. CI only.
test.skip(!hasSupabase, "needs the local Supabase (CI starts it)");

const tile = (page: Page, group: string, name: string) =>
  page.getByRole("group", { name: group, exact: true }).getByRole("button", { name, exact: true });

async function mistakeAndQuit(page: Page, art: string, noun: string) {
  await page.goto("/play?level=2&seed=8");
  await tile(page, "Verb", "ha").click();
  await tile(page, "Article", art).click();
  await tile(page, "Noun", noun).click();
  await page.getByRole("button", { name: "Chiedi" }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "Quit round" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Quit round" }).click();
  await expect(page.getByRole("heading", { name: "谁？" })).toBeVisible();
}

test("a mistake made on one device shows on the other", async ({ browser }) => {
  const email = newEmail();
  const phone = await (await browser.newContext()).newPage();
  const laptop = await (await browser.newContext()).newPage();

  await signIn(phone, email);
  await mistakeAndQuit(phone, "il", "barba"); // barba: il → la

  await signIn(laptop, email);
  await mistakeAndQuit(laptop, "la", "cappello"); // cappello: la → il
  await laptop.goto("/progress");
  const laptopMistakes = laptop.getByRole("list", { name: "Mistakes by word" });
  await expect(laptopMistakes).toContainText("il → la");
  await expect(laptopMistakes).toContainText("la → il");

  // The phone picks up the laptop's mistake on its next sync (app start).
  await phone.goto("/progress");
  await expect(phone.getByRole("list", { name: "Mistakes by word" })).toContainText("la → il");
  await expect(phone.getByRole("list", { name: "Mistakes by word" })).toContainText("il → la");
});
