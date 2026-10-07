import { expect, type Page } from "@playwright/test";
import { codeIn, countEmails, emailsTo, newEmail } from "./inbox.ts";

// Sign in through the real sheet with a code from the local inbox. Returns the email.
export async function signIn(page: Page, email = newEmail()): Promise<string> {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign in" }).click();
  const sheet = page.getByRole("dialog", { name: "Sign in" });
  await sheet.getByLabel("Email").fill(email);
  // The same address may already have older codes (another device): wait for a new one.
  const before = await countEmails(email);
  await sheet.getByRole("button", { name: "Send code" }).click();
  const [message] = await emailsTo(email, before + 1);
  if (!message) throw new Error("no email");
  await sheet.getByLabel("6-digit code").fill(codeIn(message));
  await sheet.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  return email;
}
