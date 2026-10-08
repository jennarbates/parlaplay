import { expect, test } from "@playwright/test";
import { hasSupabase } from "./inbox.ts";
import { signIn } from "./signin.ts";

// CHI-084: signed-in writes go to the outbox, then Supabase. CI only.
test.skip(!hasSupabase, "needs the local Supabase (CI starts it)");

test("a failed sync shows the banner, keeps play going, and clears when back online", async ({
  page,
  context,
}) => {
  await signIn(page);
  // Block the database API, then play to the end of a round.
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.goto("/play?seed=5");
  await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "Quit round" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Quit round" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved on this device, will sync later." }),
  ).toBeVisible();
  // Play is never blocked.
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.locator("header")).toContainText("Turn 1");

  // Back online: the outbox flushes and the banner goes.
  await page.unroute("**/rest/v1/**");
  await context.setOffline(true);
  await context.setOffline(false); // fires the online event
  await expect(page.getByText("Saved on this device, will sync later.")).toHaveCount(0);
});
