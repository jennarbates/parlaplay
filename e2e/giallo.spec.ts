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

test.describe("the inspector and the notebook", () => {
  const sheet = (page: Page) => page.getByRole("region", { name: "Questions" });
  const options = (page: Page) => sheet(page).getByRole("list", { name: "Options" });
  const pending = "Ispettrice Bassi has a question for you.";
  type Row = { lexiconId: string; rating: string };
  const reviews = async (page: Page) =>
    (await stored<{ reviewLog?: Row[] }>(page, "guest:it"))?.reviewLog ?? [];

  // The witness has real answers to these, so she asks after the fourth.
  const bringHerIn = async (page: Page) => {
    await openCase(page);
    await people(page).last().click();
    for (const text of [
      /^Dov'era tra le otto e le nove\?/,
      /^Con chi era tra le otto e le nove\?/,
      /^Che cosa faceva tra le otto e le nove\?/,
      /^Quando è sparita la torta\?/,
    ])
      await sheet(page).getByRole("button", { name: text }).click();
    await expect(page.getByText("Domande: 11")).toBeVisible();
    await expect(options(page).getByRole("button")).toHaveCount(3);
  };
  // The right option is her question's answer, which only the save knows here.
  const inspector = async (page: Page) => {
    await expect.poll(async () => (await saved(page))?.phase).toBe("inspector");
    const question = (await saved(page))?.inspector;
    if (!question) throw new Error("no question");
    return question;
  };
  type Saved = {
    state: { phase: string; cleared: string[]; inspector?: { answer: string; hint: string } };
  };
  const saved = async (page: Page) => (await stored<Saved>(page, "round:it:giallo"))?.state;

  test("she blocks asking until answered, and a reload doesn't get past her", async ({ page }) => {
    await bringHerIn(page);
    // The answer that brought her in stays in sight: the picker has gone.
    const told = (await page.getByRole("status").first().textContent()) ?? "";
    expect(told).not.toBe("");
    await expect(sheet(page)).toContainText(told);
    await expect(sheet(page)).toContainText("Ispettrice Bassi");
    await expect(sheet(page).getByRole("heading")).toBeFocused();
    await expect(sheet(page).getByRole("heading", { name: "Ask" })).toHaveCount(0);
    await people(page).first().click();
    await expect(sheet(page).getByRole("heading", { name: "Ask" })).toHaveCount(0);
    await expect(page.getByText("Domande: 11")).toBeVisible();

    // Folded away, she is still waiting.
    await sheet(page)
      .getByRole("button", { name: /Hide questions/ })
      .click();
    await expect(sheet(page)).toContainText(pending);
    await expect(options(page)).toBeHidden();

    await page.reload();
    await expect(options(page).getByRole("button")).toHaveCount(3);
    await expect(sheet(page).getByRole("heading", { name: "Ask" })).toHaveCount(0);
  });

  test("right: hard for the card, then back to asking", async ({ page }) => {
    await bringHerIn(page);
    const { answer } = await inspector(page);
    await options(page).getByRole("button", { name: answer, exact: true }).click();
    await expect(sheet(page).getByRole("status")).toHaveText("That's right.");
    await expect(options(page).getByRole("button").first()).toBeDisabled();
    await expect.poll(async () => (await reviews(page)).at(-1)?.rating).toBe("hard");

    await sheet(page).getByRole("button", { name: "Continue" }).click();
    await expect(sheet(page).getByRole("heading", { name: /^Ask/ })).toBeVisible();
    await expect(people(page).last()).toBeFocused();
    await expect(page.getByText("Domande: 11")).toBeVisible();
    await expect(
      sheet(page).getByRole("button", { name: /^Chi ha visto tra le sette/ }),
    ).toBeEnabled();
  });

  test("wrong: again for the card, and the right option is shown", async ({ page }) => {
    await bringHerIn(page);
    const { answer } = await inspector(page);
    await options(page).getByRole("button").filter({ hasNotText: answer }).first().click();
    await expect(sheet(page).getByRole("status")).toContainText(`The answer is: ${answer}`);
    await expect.poll(async () => (await reviews(page)).at(-1)?.rating).toBe("again");
    await sheet(page).getByRole("button", { name: "Continue" }).click();
    await expect(sheet(page).getByRole("heading", { name: /^Ask/ })).toBeVisible();
  });

  test("Show hint gives her question's English and removes the rating", async ({ page }) => {
    await bringHerIn(page);
    const { answer, hint } = await inspector(page);
    const before = (await reviews(page)).length;
    await sheet(page).getByRole("button", { name: "Show hint" }).click();
    await expect(sheet(page)).toContainText(hint);
    await options(page).getByRole("button", { name: answer, exact: true }).click();
    await expect(sheet(page).getByRole("status")).toHaveText("That's right.");
    await sheet(page).getByRole("button", { name: "Continue" }).click();
    await expect.poll(async () => (await saved(page))?.phase).toBe("asking");
    expect((await reviews(page)).length).toBe(before);
  });

  const notebook = (page: Page) => page.getByRole("dialog", { name: "Taccuino" });

  test("the notebook: evidence, then answers by person, in the order given", async ({ page }) => {
    await openCase(page);
    await sheet(page).getByRole("button", { name: "Taccuino" }).click();
    await expect(notebook(page).getByRole("list", { name: "Evidence" })).toContainText(
      "un ombrello",
    );
    await expect(notebook(page).getByRole("heading", { level: 3 })).toHaveCount(5);
    await expect(notebook(page).getByText("No answers yet.")).toHaveCount(5);
    await notebook(page).getByRole("button", { name: "Close" }).click();
    await expect(notebook(page)).toBeHidden();

    await people(page).last().click();
    for (const text of [/^Quando è sparita la torta\?/, /^Dov'era tra le otto e le nove\?/])
      await sheet(page).getByRole("button", { name: text }).click();
    await people(page).first().click();
    await sheet(page)
      .getByRole("button", { name: /^Quando è sparita la torta\?/ })
      .click();

    await sheet(page).getByRole("button", { name: "Taccuino" }).click();
    const witness = (await people(page).last().getAttribute("aria-label")) ?? "";
    const section = notebook(page).getByRole("region", { name: witness });
    await expect(section.getByRole("listitem")).toHaveCount(2);
    await expect(section.getByRole("listitem").first()).toContainText("Quando è sparita la torta?");
    await expect(section.getByRole("listitem").nth(1)).toContainText(
      "Dov'era tra le otto e le nove?",
    );
    await expect(notebook(page).getByText("No answers yet.")).toHaveCount(3);
  });

  test("Cleared is free and reversible, marks the face, survives a reload, and not for the witness", async ({
    page,
  }) => {
    await openCase(page);
    await expect(page.getByText("Domande: 15")).toBeVisible();
    await sheet(page).getByRole("button", { name: "Taccuino" }).click();
    await expect(notebook(page).getByRole("checkbox")).toHaveCount(4);

    const name = (await people(page).first().textContent()) ?? "";
    const toggle = notebook(page).getByRole("checkbox", { name: `Cleared: ${name}` });
    await toggle.check();
    await page.keyboard.press("Escape");
    await expect(notebook(page)).toBeHidden();
    await expect(people(page).first()).toHaveAccessibleName(/, cleared$/);
    await expect(page.getByText("Domande: 15")).toBeVisible();

    // The save lands just after the click, as every action's does.
    await expect.poll(async () => (await saved(page))?.cleared).toHaveLength(1);
    await page.reload();
    await expect(people(page).first()).toHaveAccessibleName(/, cleared$/);
    await sheet(page).getByRole("button", { name: "Taccuino" }).click();
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await notebook(page).getByRole("button", { name: "Close" }).click();
    await expect(people(page).first()).not.toHaveAccessibleName(/, cleared$/);
  });

  test("on a phone, her sheet and the notebook keep everything in reach", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 560 });
    await bringHerIn(page);
    for (const option of await options(page).getByRole("button").all()) {
      await option.scrollIntoViewIfNeeded();
      await expect(option).toBeInViewport({ ratio: 1 });
    }
    const taccuino = sheet(page).getByRole("button", { name: "Taccuino" });
    await expect(taccuino).toBeInViewport({ ratio: 1 });
    // Folded, the faces and the scene are all there to look at.
    await sheet(page)
      .getByRole("button", { name: /Hide questions/ })
      .click();
    const folded = (await sheet(page).boundingBox())?.y;
    if (folded === undefined) throw new Error("no sheet");
    const scene = await page.getByRole("region", { name: "Villa Rosa" }).boundingBox();
    if (!scene) throw new Error("no scene");
    expect(scene.y + scene.height).toBeLessThanOrEqual(folded);
    await sheet(page)
      .getByRole("button", { name: /Show questions/ })
      .click();
    await taccuino.click();
    const close = notebook(page).getByRole("button", { name: "Close" });
    await expect(close).toBeInViewport({ ratio: 1 });
    await notebook(page).getByRole("checkbox").last().scrollIntoViewIfNeeded();
    await expect(notebook(page).getByRole("checkbox").last()).toBeInViewport({ ratio: 1 });
  });

  test("axe finds nothing on her sheet, her result or the notebook", async ({ page }) => {
    await bringHerIn(page);
    const check = async () => {
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(violations).toEqual([]);
    };
    await check();
    const { answer } = await inspector(page);
    await options(page).getByRole("button").filter({ hasNotText: answer }).first().click();
    await expect(sheet(page).getByRole("status")).toContainText("The answer is");
    await check();
    await sheet(page).getByRole("button", { name: "Continue" }).click();
    await sheet(page).getByRole("button", { name: "Taccuino" }).click();
    await notebook(page).getByRole("checkbox").first().check();
    await check();
  });
});

test.describe("the accusation and the case end", () => {
  const sheet = (page: Page) => page.getByRole("region", { name: "Questions" });
  const accuse = (page: Page) => page.getByRole("dialog", { name: "Accusa" });
  const accusaButton = (page: Page) => sheet(page).getByRole("button", { name: "Accusa" });
  const rooms = ["in cucina", "in sala da pranzo", "in biblioteca", "in salotto", "in giardino"];
  const slots = ["tra le sette e le otto", "tra le otto e le nove", "tra le nove e le dieci"];
  type Truth = { cast: Record<string, string>; hide: number; crime: number; budget: number };

  const truth = async (page: Page) => {
    await expect.poll(() => stored(page, "round:it:giallo")).toBeDefined();
    const state = (await stored<{ state: Truth }>(page, "round:it:giallo"))?.state;
    if (!state) throw new Error("no save");
    return state;
  };
  // The cast's ids are their names: "c.anna" is Anna.
  const nameOf = (id = "") => `${id.charAt(2).toUpperCase()}${id.slice(3)}`;

  const pick = async (page: Page, who: string, room: string, slot: string) => {
    for (const text of [who, room, slot])
      await accuse(page)
        .locator("label")
        .filter({ hasText: new RegExp(`^${text}$`) }) // Enzo is in Lorenzo
        .click();
  };
  const solve = async (page: Page) => {
    const t = await truth(page);
    await accusaButton(page).click();
    await pick(page, nameOf(t.cast["r.culprit"]), rooms[t.hide] ?? "", slots[t.crime] ?? "");
    await accuse(page).getByRole("button", { name: "Accusa" }).click();
  };
  const wrong = async (page: Page) => {
    const t = await truth(page);
    await accusaButton(page).click();
    const room = rooms[(t.hide + 1) % rooms.length] ?? "";
    await pick(page, nameOf(t.cast["r.culprit"]), room, slots[t.crime] ?? "");
    await accuse(page).getByRole("button", { name: "Accusa" }).click();
  };

  test("the sheet offers suspects only, says the sentence, and warns about a cleared one", async ({
    page,
  }) => {
    await openCase(page);
    const first = (await people(page).first().textContent()) ?? "";
    await sheet(page).getByRole("button", { name: "Taccuino" }).click();
    await page.getByRole("checkbox", { name: `Cleared: ${first}` }).check();
    await page.keyboard.press("Escape");

    await accusaButton(page).click();
    await expect(accuse(page).getByRole("group", { name: "Chi?" }).getByRole("radio")).toHaveCount(
      4,
    );
    await expect(accuse(page).getByRole("group", { name: "Dove?" }).getByRole("radio")).toHaveCount(
      5,
    );
    const confirm = accuse(page).getByRole("button", { name: "Accusa" });
    await expect(confirm).toBeDisabled();
    await pick(page, first, "in biblioteca", "tra le otto e le nove");
    await expect(confirm).toBeEnabled();
    await expect(accuse(page).getByRole("status")).toHaveText(
      new RegExp(`^È stat[ao] ${first}, in biblioteca, tra le otto e le nove\\.$`),
    );
    await expect(accuse(page)).toContainText(`${first} is marked cleared.`);

    // Cancel changes nothing, and keeps the picks.
    await accuse(page).getByRole("button", { name: "Cancel" }).click();
    await expect(accuse(page)).toBeHidden();
    await expect(page.getByText("Domande: 15")).toBeVisible();
    await accusaButton(page).click();
    await expect(confirm).toBeEnabled();
  });

  test("solved with few questions: three stars, the solution, its proofs, and Solved on the list", async ({
    page,
  }) => {
    await openCase(page);
    const t = await truth(page);
    await solve(page);
    await expect(page.getByRole("heading", { name: "Case solved!" })).toBeFocused();
    await expect(page.getByRole("img", { name: "3 of 3 stars" })).toBeVisible();
    await expect(page.getByText(`${rooms[t.hide]}, ${slots[t.crime]}.`)).toBeVisible();
    const proofs = page.getByRole("region", { name: "The answers that prove it" });
    expect(await proofs.getByRole("listitem").count()).toBeGreaterThan(0);
    await expect(page.getByText("None. Nicely done.")).toBeVisible();
    await expect
      .poll(async () =>
        (await stored<Guest>(page, "guest:it"))?.games?.map((g) => [g.game, g.result]),
      )
      .toEqual([["giallo", "won"]]);
    await expect.poll(() => stored(page, "round:it:giallo")).toBeUndefined();

    await page.getByRole("button", { name: "Back to cases" }).click();
    await expect(page).toHaveURL(/\/it\/giallo$/);
    await expect(page.getByRole("button", { name: /La torta sparita/ })).toContainText("Solved");
    await expect(page.getByRole("link", { name: "Continue case" })).toHaveCount(0);
  });

  test("wrong: closed unsolved, with the solution, and Play again starts afresh", async ({
    page,
  }) => {
    await openCase(page);
    await people(page).first().click();
    await sheet(page)
      .getByRole("button", { name: /^Quando è sparita la torta\?/ })
      .click();
    await wrong(page);
    await expect(page.getByRole("heading", { name: "Not solved." })).toBeVisible();
    await expect(page.getByRole("img", { name: /stars/ })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "What happened" })).toContainText(/È stat[ao]/);
    await expect
      .poll(async () =>
        (await stored<Guest>(page, "guest:it"))?.games?.map((g) => [g.game, g.result]),
      )
      .toEqual([["giallo", "lost"]]);

    await page.getByRole("button", { name: "Play again" }).click();
    await expect(page.getByText("Domande: 15")).toBeVisible();
    await expect(sheet(page)).toContainText("Tap a face to ask them a question.");
    await expect(
      page.getByRole("list", { name: "People" }).locator('[aria-pressed="true"]'),
    ).toHaveCount(0);
    await expect.poll(async () => (await stored<Guest>(page, "guest:it"))?.games?.length).toBe(2);
  });

  // Plays to 0 questions, answering her each time she asks.
  const useAllQuestions = async (page: Page) => {
    await openCase(page);
    await people(page).last().click();
    const question = sheet(page).getByRole("button", {
      name: /^(?!Show hint|Hide hint).*\?$/,
      disabled: false,
    });
    const options = sheet(page).getByRole("list", { name: "Options" });
    for (let asked = 0; asked < 15; asked++) {
      await question.first().click();
      await expect(page.getByText(`Domande: ${14 - asked}`)).toBeVisible();
      if (await options.isVisible()) {
        await options.getByRole("button").first().click();
        await sheet(page).getByRole("button", { name: "Continue" }).click();
      }
    }
  };

  test("at 0 questions only Accusa is left, and 15 used is one star", async ({ page }) => {
    test.setTimeout(60_000);
    await useAllQuestions(page);
    await expect(page.getByText("Domande: 0")).toBeVisible();
    await expect(sheet(page)).toContainText("Hai finito le domande. Chi è stato?");
    await expect(
      sheet(page).getByRole("button", { name: /^(?!Show hint|Hide hint).*\?$/, disabled: false }),
    ).toHaveCount(0);
    await expect(accusaButton(page)).toBeEnabled();
    await solve(page);
    await expect(page.getByRole("img", { name: "1 of 3 stars" })).toBeVisible();
  });

  test("she holds up accusing, and a wrong answer to her is in the case's mistakes", async ({
    page,
  }) => {
    await openCase(page);
    await people(page).last().click();
    for (const text of [
      /^Dov'era tra le otto e le nove\?/,
      /^Con chi era tra le otto e le nove\?/,
      /^Che cosa faceva tra le otto e le nove\?/,
      /^Quando è sparita la torta\?/,
    ])
      await sheet(page).getByRole("button", { name: text }).click();
    await expect(accusaButton(page)).toBeDisabled();

    const inspector = await stored<{ state: { inspector?: { answer: string } } }>(
      page,
      "round:it:giallo",
    );
    const answer = inspector?.state.inspector?.answer ?? "";
    const options = sheet(page).getByRole("list", { name: "Options" });
    await options.getByRole("button").filter({ hasNotText: answer }).first().click();
    await expect(accusaButton(page)).toBeDisabled();
    await sheet(page).getByRole("button", { name: "Continue" }).click();
    await expect(accusaButton(page)).toBeEnabled();

    await wrong(page);
    const mistakes = page.getByRole("region", { name: "This case's mistakes" });
    await expect(mistakes.getByRole("listitem")).toHaveCount(1);
    await expect(mistakes).toContainText(answer);
  });

  test("on a phone, Accusa's sentence and the case end's buttons stay in reach", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 560 });
    await openCase(page);
    await accusaButton(page).click();
    const confirm = accuse(page).getByRole("button", { name: "Accusa" });
    await expect(confirm).toBeInViewport({ ratio: 1 });
    await accuse(page).getByRole("button", { name: "Cancel" }).click();
    await solve(page);
    for (const name of ["Back to cases", "Play again"])
      await expect(page.getByRole("button", { name })).toBeInViewport({ ratio: 1 });
    // Scrolled as far as it goes, nothing stays under the fixed buttons.
    const last = page.getByText("None. Nicely done.");
    await last.evaluate((el) => el.scrollIntoView({ block: "start" }));
    const [end, bar] = [
      await last.boundingBox(),
      await page.getByRole("button", { name: "Play again" }).boundingBox(),
    ];
    if (!end || !bar) throw new Error("no box");
    expect(end.y + end.height).toBeLessThanOrEqual(bar.y);
  });

  test("axe finds nothing on the sheet or either case end", async ({ page }) => {
    const check = async () => {
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(violations).toEqual([]);
    };
    await openCase(page);
    await accusaButton(page).click();
    await pick(page, nameOf((await truth(page)).cast["r.seen"]), "in biblioteca", slots[1] ?? "");
    await check();
    await accuse(page).getByRole("button", { name: "Cancel" }).click();
    await solve(page);
    await expect(page.getByRole("heading", { name: "Case solved!" })).toBeVisible();
    await check();
    await page.getByRole("button", { name: "Play again" }).click();
    await wrong(page);
    await expect(page.getByRole("heading", { name: "Not solved." })).toBeVisible();
    await check();
  });
});

test.describe("the Level 2 builder", () => {
  const sheet = (page: Page) => page.getByRole("region", { name: "Questions" });
  const row = (page: Page, name: string) => sheet(page).getByRole("group", { name, exact: true });
  const tap = (page: Page, group: string, name: string | RegExp) =>
    row(page, group).getByRole("button", { name, exact: true }).click();
  const arrive = /^è arrivat[ao] alla villa$/;
  const chiedi = (page: Page) => sheet(page).getByRole("button", { name: "Chiedi" }).click();
  const preview = (page: Page, text: string) => sheet(page).getByText(text, { exact: true });
  type Row = { lexiconId: string; rating: string };
  const reviews = async (page: Page) =>
    (await stored<{ reviewLog?: Row[] }>(page, "guest:it"))?.reviewLog ?? [];

  test.beforeEach(async ({ page }) => {
    await page.goto("/it");
    await page.getByRole("radio", { name: /Level 2/ }).check();
    await openCase(page);
    await people(page).first().click();
  });

  test("the tiles: prepositions, every question word with qual', and no English", async ({
    page,
  }) => {
    for (const p of ["con", "di", "a", "da"])
      await expect(
        row(page, "Preposition").getByRole("button", { name: p, exact: true }),
      ).toBeVisible();
    for (const form of [
      "chi",
      "che cosa",
      "cos'",
      "dov'",
      "perché",
      "qual",
      "qual'",
      "quante",
      "quant'",
    ])
      await expect(
        row(page, "Question word").getByRole("button", { name: form, exact: true }),
      ).toBeVisible();
    // ora only makes che ora.
    await expect(row(page, "Question word").getByRole("button", { name: "ora" })).toBeDisabled();
    await expect(sheet(page).getByRole("button", { name: /Show hint/ })).toHaveCount(0);
    await expect(row(page, "Time")).toHaveCount(0);
  });

  test("builds Dov'era tra le otto e le nove?, and asks it", async ({ page }) => {
    await tap(page, "Question word", "dov'");
    await tap(page, "Question", "era …");
    await chiedi(page);
    await expect(sheet(page).getByText("Pick a time.")).toBeVisible();
    await tap(page, "Time", "tra le otto e le nove");
    await expect(preview(page, "Dov'era tra le otto e le nove?")).toBeVisible();
    await chiedi(page);
    await expect(page.getByText("Domande: 14")).toBeVisible();
    await expect
      .poll(async () => (await reviews(page)).map((r) => [r.lexiconId, r.rating]))
      .toEqual([["q.dove", "good"]]);

    // Again to the same person is a duplicate, free; to someone else, a new question.
    await chiedi(page);
    await expect(sheet(page)).toContainText("You asked that already.");
    await expect(page.getByText("Domande: 14")).toBeVisible();
    await people(page).nth(1).click();
    await expect(preview(page, "Dov'era tra le otto e le nove?")).toBeVisible();
    await chiedi(page);
    await expect(page.getByText("Domande: 13")).toBeVisible();
  });

  test("a known error is rejected with its rule, for free, and di fixes it", async ({ page }) => {
    await tap(page, "Question word", "chi");
    await tap(page, "Question", "è questo ombrello");
    await chiedi(page);
    await expect(sheet(page).getByRole("status")).toHaveText("To ask whose, Italian says di chi.");
    await expect(page.getByText("Domande: 15")).toBeVisible();
    await tap(page, "Preposition", "di");
    await expect(sheet(page).getByRole("status")).toHaveCount(0);
    await expect(preview(page, "Di chi è questo ombrello?")).toBeVisible();
    await chiedi(page);
    await expect(page.getByText("Domande: 14")).toBeVisible();
    // The card keeps its again for the turn (GS 5.5).
    await expect
      .poll(async () => (await reviews(page)).map((r) => [r.lexiconId, r.rating]))
      .toEqual([["q.di_chi", "again"]]);
  });

  test("che and ora make a che ora; without a, the rule says so", async ({ page }) => {
    await tap(page, "Question word", "che");
    await tap(page, "Question word", "ora");
    await expect(
      row(page, "Question word").getByRole("button", { name: "che", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await tap(page, "Question", arrive);
    await chiedi(page);
    await expect(sheet(page).getByRole("status")).toHaveText(
      "To ask what time, Italian says a che ora.",
    );
    await tap(page, "Preposition", "a");
    await expect(sheet(page).getByText(/^A che ora è arrivat[ao] alla villa\?$/)).toBeVisible();
    await chiedi(page);
    await expect(page.getByText("Domande: 14")).toBeVisible();
  });

  test("a slip is answered, with the right form and its rule; nonsense is free", async ({
    page,
  }) => {
    await tap(page, "Question word", "quanti");
    await tap(page, "Question", "persone c'erano in cucina …");
    await tap(page, "Time", "tra le otto e le nove");
    await chiedi(page);
    await expect(page.getByText("Domande: 14")).toBeVisible();
    await expect(sheet(page)).toContainText(
      "Quante persone c'erano in cucina tra le otto e le nove?",
    );
    await expect(sheet(page).getByRole("status")).toHaveText(
      "Persone is feminine plural, so quante.",
    );
    await expect
      .poll(async () => (await reviews(page)).map((r) => [r.lexiconId, r.rating]))
      .toEqual([["q.quanto", "slip"]]);

    await tap(page, "Question", "persone c'erano in cucina …");
    await tap(page, "Question", arrive);
    await chiedi(page);
    await expect(sheet(page).getByRole("status")).toHaveText("Non capisco la domanda.");
    await expect(page.getByText("Domande: 14")).toBeVisible();
  });

  test("axe finds nothing, with feedback shown", async ({ page }) => {
    await tap(page, "Question word", "dov'");
    await tap(page, "Question", "viene");
    await chiedi(page);
    await expect(sheet(page).getByRole("status")).toContainText("da dove");
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(violations).toEqual([]);
  });
});
