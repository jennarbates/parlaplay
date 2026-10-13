import { expect, test } from "@playwright/test";
import { hasSupabase } from "../inbox.ts";
import { signIn } from "../signin.ts";
import { mistakeAndQuit, mistakes } from "./game.ts";

// Signing in with Chinese guest progress on the device (platform spec 2, 6.3). CI only.
test.skip(!hasSupabase, "needs the local Supabase (CI starts it)");

const title = "Save your Chinese progress to this account?";

// Make one mistake as a guest (the wrong verb on 狗), then quit the round.
async function playAsGuest(page: Parameters<typeof mistakeAndQuit>[0]) {
  await mistakeAndQuit(page, "是", "狗");
  await page.goto("/zh/progress");
  await expect(mistakes(page)).toContainText("是 → 有");
}

test("Save keeps the guest's progress on the account", async ({ page }) => {
  await playAsGuest(page);
  await signIn(page);
  const prompt = page.getByRole("dialog", { name: title });
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole("button", { name: "Save", exact: true })).toBeFocused(); // the default
  await prompt.getByRole("button", { name: "Save", exact: true }).click();
  await expect(prompt).toBeHidden();
  await page.goto("/zh/progress");
  await expect(mistakes(page)).toContainText("是 → 有");
  await expect(page.getByText("Saved on this device, will sync later.")).toHaveCount(0);
});

test("Don't save deletes the guest's progress", async ({ page }) => {
  await playAsGuest(page);
  await signIn(page);
  const prompt = page.getByRole("dialog", { name: title });
  await prompt.getByRole("button", { name: "Don't save" }).click();
  // The prompt closes once the choice is on disk; reloading sooner would cancel it.
  await expect(prompt).toBeHidden();
  await page.goto("/zh/progress");
  await expect(page.getByText("Play a round to see your words here.")).toBeVisible();
});
