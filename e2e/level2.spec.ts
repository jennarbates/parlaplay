import { expect, test, type Page } from "@playwright/test";

// CHI-056 and CHI-057: building questions from tiles at Level 2, and the feedback
// each kind of mistake gets.

const sheet = (page: Page) => page.getByRole("region", { name: "Questions" });
const group = (page: Page, name: string) => page.getByRole("group", { name, exact: true });

async function build(
  page: Page,
  verb?: string,
  art?: string,
  noun?: string,
  adj?: [string, string],
) {
  if (verb) await group(page, "Verb").getByRole("button", { name: verb, exact: true }).click();
  if (art) await group(page, "Article").getByRole("button", { name: art, exact: true }).click();
  if (noun) await group(page, "Noun").getByRole("button", { name: noun, exact: true }).click();
  if (adj) {
    await group(page, "Adjective")
      .getByRole("button", { name: `${adj[0]}…` })
      .click();
    await group(page, "Forms").getByRole("button", { name: adj[1], exact: true }).click();
  }
}
const chiedi = (page: Page) => page.getByRole("button", { name: "Chiedi" }).click();

test.beforeEach(async ({ page }) => {
  await page.goto("/it/play?level=2&seed=5");
  await expect(page.getByRole("group", { name: "Your question" })).toBeVisible();
});

test("no English at Level 2: no picker and no glosses", async ({ page }) => {
  await expect(page.getByRole("list", { name: "Questions to ask" })).toHaveCount(0);
  await expect(sheet(page)).not.toContainText("Does this person");
});

test("four slots in order, filled by tapping tiles, previewing the question", async ({ page }) => {
  const slots = page.getByRole("group", { name: "Your question" }).getByRole("button");
  await expect(slots).toHaveText(["Verb", "Article", "Noun", "Adjective"]);
  await build(page, "ha", "i", "capelli", ["biondo", "biondi"]);
  await expect(slots).toHaveText(["Ha", "i", "capelli", "biondi"]);
  // Tapping a filled slot clears it.
  await slots.nth(1).click();
  await expect(slots).toHaveText(["Ha", "Article", "capelli", "biondi"]);
});

test("an adjective opens its forms, each distinct text once", async ({ page }) => {
  await group(page, "Adjective").getByRole("button", { name: "biondo…" }).click();
  await expect(group(page, "Forms").getByRole("button")).toHaveText([
    "biondo",
    "bionda",
    "biondi",
    "bionde",
  ]);
  await group(page, "Adjective").getByRole("button", { name: "marrone…" }).click();
  await expect(group(page, "Forms").getByRole("button")).toHaveText(["marrone", "marroni"]);
  await group(page, "Adjective").getByRole("button", { name: "verde…" }).click();
  await expect(group(page, "Forms").getByRole("button")).toHaveText(["verde", "verdi"]);
});

for (const [tiles, message] of [
  [[], "Add a verb."],
  [["ha"], "Add an article."],
  [["ha", "i"], "Add a noun."],
  [["ha", "i", "capelli"], "capelli needs a description: add a color or length."],
  [["ha", "la", "barba", ["nero", "nera"]], "Just ask Ha la barba?"],
] as [Parameters<typeof build> extends [Page, ...infer R] ? R : never, string][]) {
  test(`shape error: ${message}`, async ({ page }) => {
    await build(page, ...tiles);
    await chiedi(page);
    await expect(sheet(page).getByRole("status")).toHaveText(message);
    await expect(page.locator("header")).toContainText("Your turn");
    await expect(page.getByRole("button", { name: "Avanti" })).toHaveCount(0);
  });
}

test("a wrong article is rejected with its rule, and the tiles stay to fix it", async ({
  page,
}) => {
  await build(page, "ha", "gli", "capelli", ["biondo", "biondi"]);
  await chiedi(page);
  await expect(sheet(page).getByRole("status")).toHaveText(
    "capelli is masculine plural and starts with a consonant: use i.",
  );
  await expect(sheet(page).getByRole("status").locator("em")).toHaveText(["capelli", "i"]);
  const slots = page.getByRole("group", { name: "Your question" }).getByRole("button");
  await expect(slots).toHaveText(["Ha", "gli", "capelli", "biondi"]);
  // Fix it.
  await build(page, undefined, "i");
  await chiedi(page);
  await expect(page.getByRole("button", { name: "Avanti" })).toBeVisible();
  await expect(sheet(page)).toContainText(/(Sì, ha|No, non ha) i capelli biondi\./);
});

test("a wrong verb names avere", async ({ page }) => {
  await build(page, "è", "la", "barba");
  await chiedi(page);
  await expect(sheet(page).getByRole("status")).toHaveText(
    "Use ha (avere) for things someone has: Ha la barba?",
  );
});

test("verb, article and agreement all wrong: every problem shows at once", async ({ page }) => {
  await build(page, "è", "gli", "capelli", ["biondo", "bionde"]);
  await chiedi(page);
  await expect(sheet(page).getByRole("status").getByRole("listitem")).toHaveText([
    "Use ha (avere) for things someone has: Ha i capelli?",
    "capelli is masculine plural and starts with a consonant: use i.",
    "biondi, not bionde: capelli is masculine plural.",
  ]);
});

test("an agreement slip is accepted, answered with the right form, and corrected", async ({
  page,
}) => {
  await build(page, "ha", "i", "capelli", ["biondo", "bionde"]);
  await chiedi(page);
  await expect(page.getByRole("button", { name: "Avanti" })).toBeVisible();
  await page.getByRole("button", { name: /questions$/ }).click();
  await expect(sheet(page)).toContainText(/(Sì, ha|No, non ha) i capelli biondi\./);
  await expect(sheet(page).getByRole("status")).toHaveText(
    "biondi, not bionde: capelli is masculine plural.",
  );
});

test("occhi biondi is meaningless", async ({ page }) => {
  await build(page, "ha", "gli", "occhi", ["biondo", "biondi"]);
  await chiedi(page);
  await expect(sheet(page).getByRole("status")).toHaveText(
    "occhi can't be biondi. Try a word for eye color.",
  );
});

test("capelli marroni gets the word-choice hint", async ({ page }) => {
  await build(page, "ha", "i", "capelli", ["marrone", "marroni"]);
  await chiedi(page);
  await expect(sheet(page).getByRole("status")).toHaveText("For capelli, Italians say castani.");
});

test("occhi castani and occhi marroni are the same question", async ({ page }) => {
  await build(page, "ha", "gli", "occhi", ["castano", "castani"]);
  await chiedi(page);
  await page.getByRole("button", { name: "Avanti" }).click();
  await page
    .getByRole("button", { name: /^(Sì|No)$/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await build(page, "ha", "gli", "occhi", ["marrone", "marroni"]);
  await chiedi(page);
  await expect(sheet(page).getByRole("status")).toContainText(
    "You already asked that. The answer was:",
  );
  await expect(sheet(page).getByRole("status")).toContainText("occhi castani.");
});

test("the CPU's questions at Level 2 have no hint", async ({ page }) => {
  await build(page, "è", "un", "uomo");
  await chiedi(page);
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByRole("button", { name: "Sì", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show hint" })).toHaveCount(0);
});
