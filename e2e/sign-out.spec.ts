import { expect, test } from "@playwright/test";
import { hasSupabase } from "./inbox.ts";
import { answers } from "./game.ts";
import { signIn } from "./signin.ts";

// CHI-087: sign-out clears the device, warning first about unsynced progress. CI only.
test.skip(!hasSupabase, "needs the local Supabase (CI starts it)");

test("unsynced progress: warn, Wait keeps you signed in, Sign out clears the device", async ({
  page,
}) => {
  const email = await signIn(page);
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.goto("/play?seed=5");
  await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Next" }).click();
  await answers(page).getByRole("button").first().click(); // a rating to sync

  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  const warning = page.getByRole("dialog", {
    name: "Some progress hasn't synced yet. Sign out anyway?",
  });
  await expect(warning).toBeVisible();
  await warning.getByRole("button", { name: "Wait" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await warning.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Continue round" })).toHaveCount(0);
  await page.goto("/progress");
  await expect(page.getByText("Play a round to see your words here.")).toBeVisible();
});

test("everything synced: signs out without asking", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /hasn't synced/ })).toHaveCount(0);
});
