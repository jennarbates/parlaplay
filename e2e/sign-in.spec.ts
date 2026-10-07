import { expect, test, type Page } from "@playwright/test";
import { codeIn, emailsTo, hasSupabase, newEmail } from "./inbox.ts";

// CHI-083 (and CHI-082's template): signing in with a 6-digit code against the
// local Supabase. CI points the app at it; without it the tests are skipped.
test.skip(!hasSupabase, "needs the local Supabase (CI starts it)");

async function requestCode(page: Page, email: string) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign in" }).click();
  const sheet = page.getByRole("dialog", { name: "Sign in" });
  await sheet.getByLabel("Email").fill(email);
  await sheet.getByRole("button", { name: "Send code" }).click();
  await expect(sheet).toContainText(`We sent a code to ${email}`);
  return sheet;
}

test("sign in with the code from the email, typed into the same tab", async ({ page }) => {
  const email = newEmail();
  const sheet = await requestCode(page, email);
  const [message] = await emailsTo(email);
  if (!message) throw new Error("no email");
  await sheet.getByLabel("6-digit code").fill(codeIn(message));
  await sheet.getByRole("button", { name: "Sign in" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  // Home shows it too, and it survives a reload.
  await page.goto("/");
  await expect(page.getByRole("link", { name: email })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: email })).toBeVisible();

  // Sign out.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("the email shows the code and has no link (spec 7.3)", async ({ page }) => {
  const email = newEmail();
  await requestCode(page, email);
  const [message] = await emailsTo(email);
  if (!message) throw new Error("no email");
  expect(message.Subject).toBe("Your Shéi sign-in code");
  expect(codeIn(message)).toMatch(/^\d{6}$/);
  expect(message.HTML).not.toMatch(/<a\s/i);
  expect(message.Text).not.toMatch(/https?:\/\//);
});

test("a wrong code shows an inline error", async ({ page }) => {
  const email = newEmail();
  const sheet = await requestCode(page, email);
  const [message] = await emailsTo(email);
  if (!message) throw new Error("no email");
  const wrong = codeIn(message) === "000000" ? "111111" : "000000";
  await sheet.getByLabel("6-digit code").fill(wrong);
  await sheet.getByRole("button", { name: "Sign in" }).click();
  await expect(sheet.getByRole("alert")).toHaveText(
    "That code is wrong or has expired. Check it, or send a new one.",
  );
  await expect(page.getByText("Signed in as")).toHaveCount(0);
});

test("Resend code is offered after the cooldown and sends a new code", async ({ page }) => {
  const email = newEmail();
  const sheet = await requestCode(page, email);
  await emailsTo(email, 1);
  await expect(sheet.getByRole("button", { name: /Resend code in \d+ s/ })).toBeDisabled();
  const resend = sheet.getByRole("button", { name: "Resend code" });
  await expect(resend).toBeEnabled({ timeout: 10_000 });
  await resend.click();
  const both = await emailsTo(email, 2);
  expect(both).toHaveLength(2);
  // The newest code works.
  const newest = both[0];
  if (!newest) throw new Error("no email");
  await sheet.getByLabel("6-digit code").fill(codeIn(newest));
  await sheet.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
});

test("an email that fails to send shows an inline error with retry", async ({ page }) => {
  await page.route("**/auth/v1/otp**", (route) => route.abort());
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign in" }).click();
  const sheet = page.getByRole("dialog", { name: "Sign in" });
  await sheet.getByLabel("Email").fill(newEmail());
  await sheet.getByRole("button", { name: "Send code" }).click();
  await expect(sheet.getByRole("alert")).toContainText("We couldn't send the email.");
  // Retry works once the network is back.
  await page.unroute("**/auth/v1/otp**");
  await sheet.getByRole("button", { name: "Send code" }).click();
  await expect(sheet).toContainText("We sent a code to");
});
