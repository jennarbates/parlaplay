import { expect, test, type Page } from "@playwright/test";
import { stored } from "./zh/game.ts";

// Chi è stato? GS 9.1: its card on Italian Home, its routes as their own chunk, the
// case list and the case screen.
const scripts = (page: Page) => {
  const urls: string[] = [];
  page.on("response", (r) => {
    if (r.url().endsWith(".js")) urls.push(r.url());
  });
  return urls;
};
const giallo = /GialloScreens-/;
type Guest = { games?: { game: string; result?: string }[] };

test("/it lists the giallo as coming soon, and doesn't load its chunk", async ({ page }) => {
  const urls = scripts(page);
  await page.goto("/it");
  const card = page.getByRole("region", { name: "Chi è stato?" });
  await expect(card).toContainText("Coming soon");
  await expect(card.getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Chi è?" })).toBeVisible();
  expect(urls.filter((u) => giallo.test(u))).toEqual([]);
});

test("/it/giallo loads the giallo's chunk; with no case, the case screen goes there", async ({
  page,
}) => {
  const urls = scripts(page);
  await page.goto("/it/giallo/play");
  await expect(page).toHaveURL(/\/it\/giallo$/);
  await expect(page.getByRole("heading", { name: "Chi è stato?" })).toBeVisible();
  expect(urls.some((u) => giallo.test(u))).toBe(true);
});

const openCase = async (page: Page) => {
  await page.goto("/it/giallo");
  await page.getByRole("button", { name: /La torta sparita/ }).click();
  await expect(page).toHaveURL(/\/it\/giallo\/play$/);
};
const people = (page: Page) => page.getByRole("list", { name: "People" }).getByRole("button");

test("the case list shows each case's setting and difficulty, blank until solved", async ({
  page,
}) => {
  await page.goto("/it/giallo");
  const open = page.getByRole("button", { name: /La torta sparita/ });
  await expect(open).toContainText("Villa Rosa");
  await expect(open).toContainText("Easy");
  await expect(open).not.toContainText("Solved");
  await expect(page.getByRole("link", { name: "Continue case" })).toHaveCount(0);
});

test("the case: title, questions left, named faces to select, and the scene", async ({ page }) => {
  await openCase(page);
  await expect(page.getByText("La torta sparita")).toBeVisible();
  await expect(page.getByText("Domande: 15")).toBeVisible();
  await expect(page.getByText("un ombrello")).toBeVisible();
  await expect(page.getByText("delle chiavi")).toBeVisible();

  await expect(people(page)).toHaveCount(5);
  // GS 10: each named with the person's name and job.
  for (const face of await people(page).all()) await expect(face).toHaveAccessibleName(/^\S+, \S+/);
  const [first, second] = [people(page).nth(0), people(page).nth(1)];
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await second.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(first).toHaveAttribute("aria-pressed", "false");
});

test("a reload resumes the case, with the same people in the same order", async ({ page }) => {
  await openCase(page);
  const names = await people(page).evaluateAll((els) => els.map((e) => e.ariaLabel));
  await page.reload();
  await expect(page).toHaveURL(/\/it\/giallo\/play$/);
  await expect(people(page)).toHaveCount(5);
  expect(await people(page).evaluateAll((els) => els.map((e) => e.ariaLabel))).toEqual(names);

  await page.goto("/it/giallo");
  await page.getByRole("link", { name: "Continue case" }).click();
  await expect(page).toHaveURL(/\/it\/giallo\/play$/);
  await expect(people(page)).toHaveCount(5);
});

test("Quit case confirms, then returns to the list with nothing to continue", async ({ page }) => {
  await openCase(page);
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Keyboard shortcuts" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Quit case" }).click();
  await expect(page.getByRole("heading", { name: "Quit this case?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep playing" }).click();
  await expect(page).toHaveURL(/\/it\/giallo\/play$/);

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "Quit case" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Quit case" }).click();
  await expect(page).toHaveURL(/\/it\/giallo$/);
  await expect(page.getByRole("link", { name: "Continue case" })).toHaveCount(0);
  // Recorded as abandoned, and the save is gone (both land just after the click).
  await expect
    .poll(async () =>
      (await stored<Guest>(page, "guest:it"))?.games?.map((g) => [g.game, g.result]),
    )
    .toEqual([["giallo", "abandoned"]]);
  await expect.poll(() => stored(page, "round:it:giallo")).toBeUndefined();
  await page.reload();
  await expect(page.getByRole("button", { name: /La torta sparita/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue case" })).toHaveCount(0);
});
