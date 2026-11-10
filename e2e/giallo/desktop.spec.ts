import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { stored } from "../zh/game.ts";

// Chi è stato? GS 9.2: the case at desktop size, and by keyboard. Runs on the
// desktop profiles only (1440 × 900 unless a test sets another size); giallo.spec.ts
// covers the phone.

const panel = (page: Page) => page.getByRole("complementary", { name: "Questions" });
const people = (page: Page) => page.getByRole("list", { name: "People" }).getByRole("button");
const notebook = (page: Page) => page.getByRole("region", { name: "Taccuino" });
const options = (page: Page) => panel(page).getByRole("list", { name: "Options" });
const domande = (page: Page, n: number) => expect(page.getByText(`Domande: ${n}`)).toBeVisible();

const openCase = async (page: Page) => {
  await page.goto("/it/giallo");
  await page.getByRole("button", { name: /La torta sparita/ }).click();
  await expect(page).toHaveURL(/\/it\/giallo\/play$/);
  await expect(people(page)).toHaveCount(5);
};

// Tab until the locator has focus: keyboard only, as a learner would.
const tabTo = async (page: Page, target: Locator, max = 80) => {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("never reached by Tab");
};

type Saved = {
  state: {
    cast: Record<string, string>;
    hide: number;
    crime: number;
    inspector?: { answer: string };
  };
};
const saved = async (page: Page) => (await stored<Saved>(page, "round:it:giallo"))?.state;
const rooms = ["in cucina", "in sala da pranzo", "in biblioteca", "in salotto", "in giardino"];
const slots = ["tra le sette e le otto", "tra le otto e le nove", "tra le nove e le dieci"];
// The cast's ids are their names: "c.anna" is Anna.
const nameOf = (id = "") => `${id.charAt(2).toUpperCase()}${id.slice(3)}`;

test.describe("the case at desktop size", () => {
  for (const size of [
    { width: 1024, height: 640 },
    { width: 1440, height: 900 },
  ])
    test(`at ${size.width} × ${size.height}: people, scene, questions, notebook and Accusa, with no page scroll`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await openCase(page);
      await people(page).first().click();
      for (const part of [
        people(page).last(),
        page.getByRole("heading", { name: "Villa Rosa" }),
        panel(page).getByRole("heading", { name: /^Ask / }),
        notebook(page).getByRole("heading", { name: "Taccuino" }),
        panel(page).getByRole("button", { name: "Accusa" }),
      ])
        await expect(part).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
        ),
      ).toBe(0);
      // No sheet and no Taccuino button: the notebook is always open.
      await expect(page.getByRole("region", { name: "Questions" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Taccuino" })).toHaveCount(0);
    });

  test("faces and Accusa show their keys, and carry aria-keyshortcuts", async ({ page }) => {
    await openCase(page);
    await expect(people(page).first()).toHaveAttribute("aria-keyshortcuts", "1");
    await expect(people(page).last()).toHaveAttribute("aria-keyshortcuts", "5");
    await expect(people(page).last()).toContainText("5");
    const accusa = panel(page).getByRole("button", { name: "Accusa" });
    await expect(accusa).toHaveAttribute("aria-keyshortcuts", "a");
    await expect(accusa).toHaveText("AccusaA");
    await expect(accusa).toHaveAccessibleName("Accusa");
    await expect(panel(page)).toContainText("Press ? for shortcuts");
  });

  test("the notebook updates in place, and Cleared marks the face", async ({ page }) => {
    await openCase(page);
    await page.keyboard.press("5");
    await page.keyboard.press("Enter");
    await domande(page, 14);
    const answer = (await panel(page).locator("p[aria-live]").textContent()) ?? "";
    expect(answer).toMatch(/^\S+: /);
    await expect(notebook(page)).toContainText(answer.replace(/^\S+: /, ""));
    const box = notebook(page).getByRole("checkbox").first();
    await box.check();
    await expect(people(page).first()).toHaveAccessibleName(/, cleared$/);
  });

  test("axe finds nothing, with a question asked", async ({ page }) => {
    await openCase(page);
    await page.keyboard.press("5");
    await page.keyboard.press("Enter");
    await domande(page, 14);
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(violations).toEqual([]);
  });
});

test.describe("keyboard (GS 9.2)", () => {
  test("1 to 5 pick a person and go to their questions; N, A and ? open what they say", async ({
    page,
  }) => {
    await openCase(page);
    await page.keyboard.press("3");
    await expect(people(page).nth(2)).toHaveAttribute("aria-pressed", "true");
    await expect(panel(page).locator("[data-question]").first()).toBeFocused();
    await page.keyboard.press("n");
    await expect(notebook(page)).toBeFocused();
    await page.keyboard.press("a");
    await expect(page.getByRole("dialog", { name: "Accusa" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Accusa" })).toBeHidden();
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    // A dialog has its own keys: 2 picks nobody behind it.
    await page.keyboard.press("2");
    await expect(people(page).nth(1)).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeHidden();
  });

  test("on a Cleared checkbox, the keys still work", async ({ page }) => {
    await openCase(page);
    await notebook(page).getByRole("checkbox").first().focus();
    await page.keyboard.press("2");
    await expect(people(page).nth(1)).toHaveAttribute("aria-pressed", "true");
  });

  test("keys with Ctrl, Cmd or Alt held do nothing", async ({ page }) => {
    await openCase(page);
    for (const key of ["Control+1", "Meta+2", "Alt+3"]) await page.keyboard.press(key);
    for (const face of await people(page).all())
      await expect(face).toHaveAttribute("aria-pressed", "false");
  });

  test("Level 2: Enter asks what is built, and on a tile picks it instead", async ({
    page,
    browserName,
  }) => {
    // WebKit only Tabs to buttons with a macOS setting on (see a11y.spec.ts).
    test.skip(browserName !== "chromium", "Tab order for buttons is a macOS setting in WebKit");
    await page.goto("/it");
    await page.getByRole("radio", { name: /Level 2/ }).check();
    await openCase(page);
    const row = (name: string) => panel(page).getByRole("group", { name, exact: true });

    await page.keyboard.press("1");
    await expect(panel(page).getByRole("heading", { name: /^Ask / })).toBeFocused();
    // Past the question's slots into the first row, then down the rows: one stop each.
    await tabTo(page, row("Preposition").getByRole("button").first(), 6);
    await page.keyboard.press("Tab");
    await expect(row("Question word").getByRole("button").first()).toBeFocused();
    // ← → move along the row: dov' is a few tiles in.
    for (let i = 0; i < 12; i++) {
      if (
        await row("Question word")
          .getByRole("button", { name: "dov'", exact: true })
          .evaluate((el) => el === document.activeElement)
      )
        break;
      await page.keyboard.press("ArrowRight");
    }
    await page.keyboard.press("Enter");
    await expect(row("Question word").getByRole("button", { name: "dov'" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await domande(page, 15); // Enter on a tile picked it, and asked nothing
    await page.keyboard.press("Tab");
    await expect(row("Question").getByRole("button").first()).toBeFocused();
    for (let i = 0; i < 12; i++) {
      const text = await page.evaluate(() => document.activeElement?.textContent ?? "");
      if (/^era …$/.test(text)) break;
      await page.keyboard.press("ArrowRight");
    }
    await page.keyboard.press("Enter");
    // The time row has appeared: its first tile.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(panel(page).getByText("Dov'era tra le sette e le otto?")).toBeVisible();

    // 2, then Enter: the same question to the next person.
    await page.keyboard.press("2");
    await expect(panel(page).getByRole("heading", { name: /^Ask / })).toBeFocused();
    await page.keyboard.press("Enter");
    await domande(page, 14);
    await page.keyboard.press("3");
    await page.keyboard.press("Enter");
    await domande(page, 13);
  });

  test("a whole case by keyboard only: her question, the notebook and the accusation", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Tab order for buttons is a macOS setting in WebKit");
    await page.goto("/it/giallo");
    await tabTo(page, page.getByRole("button", { name: /La torta sparita/ }));
    await page.keyboard.press("Enter");
    await expect(people(page)).toHaveCount(5);

    // The witness has real answers to these, so she asks after the fourth.
    for (const text of [
      /^Dov'era tra le otto e le nove\?/,
      /^Con chi era tra le otto e le nove\?/,
      /^Che cosa faceva tra le otto e le nove\?/,
      /^Quando è sparita la torta\?/,
    ]) {
      await page.keyboard.press("5");
      await tabTo(page, panel(page).getByRole("button", { name: text }));
      await page.keyboard.press("Enter");
    }
    await domande(page, 11);

    // Her question: H for the hint, Tab to the right option, Enter, then Continue.
    await expect(options(page).getByRole("button")).toHaveCount(3);
    await expect.poll(async () => (await saved(page))?.inspector).toBeDefined();
    const answer = (await saved(page))?.inspector?.answer ?? "";
    await page.keyboard.press("a"); // accusing waits for her
    await expect(page.getByRole("dialog", { name: "Accusa" })).toBeHidden();
    await page.keyboard.press("h");
    await expect(panel(page).getByRole("button", { name: "Show hint" })).toHaveCount(0);
    await tabTo(page, options(page).getByRole("button", { name: answer, exact: true }));
    await page.keyboard.press("Enter");
    await expect(panel(page).getByRole("button", { name: "Continue" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(people(page).last()).toBeFocused();

    // N, then Space on a suspect's Cleared.
    await page.keyboard.press("n");
    await expect(notebook(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await expect(notebook(page).getByRole("checkbox").first()).toBeChecked();

    // A, then each group's radios with the arrow keys, and Accusa.
    const t = await saved(page);
    if (!t) throw new Error("no save");
    await page.keyboard.press("a");
    const dialog = page.getByRole("dialog", { name: "Accusa" });
    await expect(dialog).toBeVisible();
    for (const [legend, choice] of [
      ["Chi?", nameOf(t.cast["r.culprit"])],
      ["Dove?", rooms[t.hide] ?? ""],
      ["Quando?", slots[t.crime] ?? ""],
    ] as const) {
      const group = dialog.getByRole("group", { name: legend });
      await tabTo(page, group.getByRole("radio").first());
      await page.keyboard.press("Space");
      const target = group.getByRole("radio", { name: new RegExp(`^${choice}(, cleared)?$`) });
      for (let i = 0; i < 6 && !(await target.isChecked()); i++)
        await page.keyboard.press("ArrowDown");
      await expect(target).toBeChecked();
    }
    await tabTo(page, dialog.getByRole("button", { name: "Accusa" }));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Case solved!" })).toBeFocused();
  });
});
