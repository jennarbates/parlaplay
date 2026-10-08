import { expect, type Page } from "@playwright/test";

// Platform spec 2: choose a language on the picker, as a first-time player does.
// It becomes the last language, so / and the desktop nav on shared pages use it.
export async function chooseLanguage(page: Page, title: RegExp, code: string) {
  await page.goto("/languages");
  await page.getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(new RegExp(`/${code}$`));
}

export const chooseItalian = (page: Page) => chooseLanguage(page, /Chi è\?/, "it");
