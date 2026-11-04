import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { stored } from "./zh/game.ts";

// Chi è stato? GS 9.1: its card on Italian Home, its routes as their own chunk, the
// case list, the case screen and the Level 1 picker.
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

test.describe("the Level 1 picker", () => {
  const sheet = (page: Page) => page.getByRole("region", { name: "Questions" });
  // Anchored: its Show hint button's name has the question in it too.
  const stolen = (page: Page) =>
    sheet(page).getByRole("button", { name: /^Quando è sparita la torta\?/ });
  const whenStolen = "Quando è sparita la torta?";

  test("a face opens that person's questions, grouped by question word", async ({ page }) => {
    await openCase(page);
    await expect(sheet(page)).toContainText("Tap a face to ask them a question.");
    await people(page).first().click();
    const name = (await people(page).first().textContent()) ?? "";
    await expect(sheet(page).getByRole("heading", { name: `Ask ${name}` })).toBeVisible();
    for (const label of ["Dove", "Con chi", "Di chi", "A che ora"])
      await expect(sheet(page).getByRole("heading", { name: label, exact: true })).toBeVisible();
    await expect(sheet(page).getByRole("list", { name: "Di chi" })).toContainText(
      "Di chi è questo ombrello?",
    );
    await expect(sheet(page).getByRole("list", { name: "Dove", exact: true })).toContainText(
      "Dov'era tra le otto e le nove?",
    );
  });

  test("Show hint toggles one question's English", async ({ page }) => {
    await openCase(page);
    await people(page).first().click();
    const list = sheet(page).getByRole("list", { name: "Dove", exact: true });
    const text = "Dov'era tra le otto e le nove?";
    const hint = "Where were you between eight and nine?";
    await expect(list).not.toContainText(hint);
    await list.getByRole("button", { name: `Show hint: ${text}` }).click();
    await expect(list).toContainText(hint);
    await expect(list).not.toContainText("between seven and eight");
    await list.getByRole("button", { name: `Hide hint: ${text}` }).click();
    await expect(list).not.toContainText(hint);
  });

  test("asking uses a question, then greys it out with its answer, after a reload too", async ({
    page,
  }) => {
    await openCase(page);
    await people(page).first().click();
    await stolen(page).click();
    await expect(page.getByText("Domande: 14")).toBeVisible();
    const asked = stolen(page);
    await expect(asked).toBeDisabled();
    const answer = (await asked.textContent())?.replace(whenStolen, "") ?? "";
    expect(answer).not.toBe("");
    await expect(page.getByRole("status").filter({ hasText: answer })).toBeAttached();

    // The same question to someone else is a new question (GS 2).
    await people(page).nth(1).click();
    await expect(stolen(page)).toBeEnabled();
    await people(page).first().click();
    await expect(stolen(page)).toBeDisabled();

    await page.reload();
    await expect(page.getByText("Domande: 14")).toBeVisible();
    await people(page).first().click();
    await expect(stolen(page)).toBeDisabled();
    await expect(stolen(page)).toContainText(answer);
  });

  test("asking waits once the inspector has a question (GS 2)", async ({ page }) => {
    await openCase(page);
    await people(page).last().click(); // the witness, who has real answers to these
    for (const text of [
      /^Dov'era tra le otto e le nove\?/,
      /^Con chi era tra le otto e le nove\?/,
      /^Che cosa faceva tra le otto e le nove\?/,
      /^Quando è sparita la torta\?/,
    ])
      await sheet(page).getByRole("button", { name: text }).click();
    await expect(page.getByText("Domande: 11")).toBeVisible();
    await expect(sheet(page)).toContainText("Ispettrice Bassi has a question for you.");
    await expect(
      sheet(page).getByRole("button", { name: /^Chi ha visto tra le otto e le nove\?/ }),
    ).toBeDisabled();
    await people(page).first().click();
    await expect(stolen(page)).toBeDisabled();
    await expect(page.getByText("Domande: 11")).toBeVisible();
  });

  test("on a phone the open sheet leaves every face in reach", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 560 });
    await openCase(page);
    await people(page).first().click();
    await expect(sheet(page).getByRole("list", { name: "Dove", exact: true })).toBeVisible();
    const top = (await sheet(page).boundingBox())?.y;
    if (top === undefined) throw new Error("no sheet");
    for (const face of await people(page).all()) {
      const box = await face.boundingBox();
      if (!box) throw new Error("no face");
      expect(box.y + box.height).toBeLessThanOrEqual(top);
    }
    await people(page).nth(4).click();
    await expect(people(page).nth(4)).toHaveAttribute("aria-pressed", "true");
  });

  test("axe finds nothing, with a hint shown and a question asked", async ({ page }) => {
    await openCase(page);
    await people(page).first().click();
    await stolen(page).click();
    await sheet(page)
      .getByRole("list", { name: "Dove", exact: true })
      .getByRole("button", { name: /^Show hint/ })
      .first()
      .click();
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(violations).toEqual([]);
  });
});
