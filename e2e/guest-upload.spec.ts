import { expect, test, type Page } from "@playwright/test";
import { hasSupabase } from "./inbox.ts";
import { signIn } from "./signin.ts";

// CHI-085: signing in with guest progress on the device. CI only.
test.skip(!hasSupabase, "needs the local Supabase (CI starts it)");

const tile = (page: Page, group: string, name: string) =>
  page.getByRole("group", { name: group, exact: true }).getByRole("button", { name, exact: true });

// Make one mistake as a guest (a wrong article on barba), then quit the round.
async function playAsGuest(page: Page) {
  await page.goto("/it/play?level=2&seed=8");
  await tile(page, "Verb", "ha").click();
  await tile(page, "Article", "il").click();
  await tile(page, "Noun", "barba").click();
  await page.getByRole("button", { name: "Chiedi" }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "Quit round" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Quit round" }).click();
  await page.goto("/it/progress");
  await expect(page.getByRole("list", { name: "Mistakes by word" })).toContainText("il → la");
}

test("Yes keeps the guest's progress on the account", async ({ page }) => {
  await playAsGuest(page);
  await signIn(page);
  const prompt = page.getByRole("dialog", { name: "Save your progress to this account?" });
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole("button", { name: "Yes, save it" })).toBeFocused(); // the default
  await prompt.getByRole("button", { name: "Yes, save it" }).click();
  await expect(prompt).toBeHidden();
  await page.goto("/it/progress");
  await expect(page.getByRole("list", { name: "Mistakes by word" })).toContainText("il → la");
  await expect(page.getByText("Saved on this device, will sync later.")).toHaveCount(0);
});

test("No deletes the guest's progress", async ({ page }) => {
  await playAsGuest(page);
  await signIn(page);
  const prompt = page.getByRole("dialog", { name: "Save your progress to this account?" });
  await prompt.getByRole("button", { name: "No, delete it" }).click();
  // The prompt closes once the choice is on disk; reloading sooner would cancel it.
  await expect(prompt).toBeHidden();
  await page.goto("/it/progress");
  await expect(page.getByText("Play a round to see your words here.")).toBeVisible();
});

test("without guest progress there is no question", async ({ page }) => {
  await signIn(page);
  await expect(
    page.getByRole("dialog", { name: "Save your progress to this account?" }),
  ).toHaveCount(0);
});
