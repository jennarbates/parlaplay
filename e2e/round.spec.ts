import { expect, test, type Page } from "@playwright/test";
import { content } from "../src/languages/it/content/index.ts";
import { allQuestions } from "../src/languages/it/engine/index.ts";
import { evaluate } from "../src/languages/it/engine/meaning.ts";
import { startGame } from "../src/languages/it/engine/start.ts";

// CHI-060, CHI-061, CHI-062: round end, quit and continue, and Home.

const nameOf = (id: string) => content.characters.find((c) => c.id === id)?.name ?? "";
const attrsOf = (id: string) => content.characters.find((c) => c.id === id)?.attrs;

// The games rows saved on this device, read from IndexedDB in the page.
function savedGames(page: Page): Promise<{ id: string; result?: string }[]> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open("chi-e");
        open.onsuccess = () => {
          const get = open.result.transaction("kv").objectStore("kv").get("guest");
          get.onsuccess = () => {
            open.result.close();
            resolve(
              (get.result as { games?: { id: string; result?: string }[] } | undefined)?.games ??
                [],
            );
          };
        };
      }),
  );
}

// The phase of the round saved in IndexedDB.
function savedPhase(page: Page): Promise<string | undefined> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open("chi-e");
        open.onsuccess = () => {
          const get = open.result.transaction("kv").objectStore("kv").get("round:it");
          get.onsuccess = () => {
            open.result.close();
            resolve((get.result as { state?: { phase?: string } } | undefined)?.state?.phase);
          };
        };
      }),
  );
}

async function cpuQuestionText(page: Page) {
  return page.evaluate(
    () => document.querySelector('section[aria-label="Questions"] p[lang="it"]')?.textContent ?? "",
  );
}

test.describe("round end (CHI-060)", () => {
  test("after a round with a mistake: result, both cards, history, mistakes, nudge, Play again", async ({
    page,
  }) => {
    const seed = 8;
    const g = startGame(seed, 2, content);
    await page.goto(`/it/play?level=2&seed=${seed}`);

    // A grammar mistake, then the fixed question.
    const tile = (group: string, name: string) =>
      page
        .getByRole("group", { name: group, exact: true })
        .getByRole("button", { name, exact: true });
    await tile("Verb", "ha").click();
    await tile("Article", "il").click();
    await tile("Noun", "barba").click();
    await page.getByRole("button", { name: "Chiedi" }).click();
    await expect(page.getByRole("status")).toContainText("barba is feminine singular: use la.");
    await tile("Article", "la").click();
    await page.getByRole("button", { name: "Chiedi" }).click();
    await page.getByRole("button", { name: "Avanti" }).click();

    // Answer the CPU wrongly.
    const text = await cpuQuestionText(page);
    const cpuQ = allQuestions(content).find((x) => x.text === text);
    const a = attrsOf(g.playerSecret);
    if (!cpuQ || !a) throw new Error("no CPU question");
    const truth = evaluate(cpuQ.asked, a);
    await page.getByRole("button", { name: truth ? "No" : "Sì", exact: true }).click();
    await page.getByRole("button", { name: "Avanti" }).click();

    // Guess right.
    await page.getByRole("button", { name: "Indovina" }).click();
    await page
      .getByRole("button", { name: new RegExp(`^Guess ${nameOf(g.cpuSecret)}: [^(]*$`) })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "Guess", exact: true }).click();

    await expect(page.getByRole("heading", { name: "You won!" })).toBeVisible();
    const cards = page.getByRole("region", { name: "Both cards" });
    await expect(
      cards.getByRole("img", { name: `Your card: ${nameOf(g.playerSecret)}` }),
    ).toBeVisible();
    await expect(
      cards.getByRole("img", { name: `Computer's card: ${nameOf(g.cpuSecret)}` }),
    ).toBeVisible();

    const history = page.getByRole("region", { name: "Questions" });
    await expect(history.getByRole("listitem")).toHaveCount(2);
    await expect(history).toContainText("Ha la barba?");
    await expect(history).toContainText(text);
    await expect(history).toContainText(`(you said ${truth ? "No" : "Sì"})`);

    const mistakes = page.getByRole("region", { name: "This round's mistakes" });
    await expect(mistakes.getByRole("listitem")).toHaveCount(cpuQ.fill.adj ? 3 : 2);
    await expect(mistakes).toContainText("barba: il → la");
    await expect(mistakes).toContainText(`${truth ? "No" : "Sì"} → ${truth ? "Sì" : "No"}`);

    await expect(
      page.getByRole("link", { name: "Sign in to keep your progress safe" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Play again" }).click();
    await expect(page.locator("header")).toContainText("Turn 1");
    await expect(page.getByRole("group", { name: "Your question" })).toBeVisible(); // still Level 2
  });

  test("a clean round has no mistakes, and Home goes home", async ({ page }) => {
    const g = startGame(5, 1, content);
    await page.goto("/it/play?seed=5");
    await page.getByRole("button", { name: "Indovina" }).click();
    await page
      .getByRole("button", { name: new RegExp(`^Guess ${nameOf(g.cpuSecret)}: [^(]*$`) })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "Guess", exact: true }).click();
    await expect(page.getByText("None. Nicely done.")).toBeVisible();
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page.getByRole("heading", { name: "Chi è?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue round" })).toHaveCount(0);
  });

  test("when the computer finds you first, it says so", async ({ page }) => {
    // Answer every CPU question truthfully and never guess: the CPU wins.
    const g = startGame(3, 1, content);
    await page.goto("/it/play?seed=3");
    const qs = allQuestions(content);
    for (let i = 0; i < 8; i++) {
      if (await page.getByRole("heading", { name: "You lost." }).isVisible()) break;
      await page
        .getByRole("list", { name: "Questions to ask" })
        .getByRole("button", { name: new RegExp(qs[i]?.text.replace("?", "\\?") ?? "") })
        .click();
      await page.getByRole("button", { name: "Avanti" }).click();
      if (await page.getByRole("heading", { name: "You lost." }).isVisible()) break;
      const text = await cpuQuestionText(page);
      const q = qs.find((x) => x.text === text);
      const a = attrsOf(g.playerSecret);
      if (!q || !a) throw new Error("no CPU question");
      await page
        .getByRole("button", { name: evaluate(q.asked, a) ? "Sì" : "No", exact: true })
        .click();
      await page.getByRole("button", { name: "Avanti" }).click();
    }
    await expect(page.getByRole("heading", { name: "You lost." })).toBeVisible();
    await expect(
      page.getByText(`The computer found ${nameOf(g.playerSecret)} first.`),
    ).toBeVisible();
  });
});

test.describe("quit and continue (CHI-061)", () => {
  test("Quit round asks to confirm, records abandoned, and goes home", async ({ page }) => {
    await page.goto("/it/play?seed=4");
    await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("menuitem", { name: "Quit round" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Quit this round?");
    await expect(dialog).toContainText("It will count as abandoned.");

    // Keep playing does nothing.
    await dialog.getByRole("button", { name: "Keep playing" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("header")).toContainText("Turn 1");

    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("menuitem", { name: "Quit round" }).click();
    await dialog.getByRole("button", { name: "Quit round" }).click();
    await expect(page.getByRole("heading", { name: "Chi è?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue round" })).toHaveCount(0);
    await expect
      .poll(async () => (await savedGames(page)).map((g) => g.result))
      .toEqual(["abandoned"]);
  });

  test("Home offers Continue round when one is saved, even after a reload", async ({ page }) => {
    await page.goto("/it/play?seed=4");
    await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Avanti" }).click();
    await expect.poll(() => savedPhase(page)).toBe("cpuTurn");
    await page.goto("/it");
    await expect(page.getByText("You have a round in progress (Level 1, turn 1).")).toBeVisible();
    await page.reload();
    const cont = page.getByRole("link", { name: "Continue round" });
    await expect(cont).toBeVisible();
    await cont.click();
    await expect(page.locator("header")).toContainText("Computer's turn");
  });

  test("starting a new round over a saved one records it abandoned", async ({ page }) => {
    await page.goto("/it/play?seed=4");
    await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
    await expect.poll(() => savedPhase(page)).toBe("playerReview");
    await page.goto("/it");
    await page.getByRole("button", { name: "New round" }).click();
    await expect(page.locator("header")).toContainText("Turn 1");
    await expect(
      page.getByRole("list", { name: "Questions to ask" }).locator("button:disabled"),
    ).toHaveCount(0);
    await expect
      .poll(async () => (await savedGames(page)).map((g) => g.result ?? "open"))
      .toEqual(["abandoned", "open"]);
  });
});

test.describe("Home (CHI-062)", () => {
  test("level picker, Play, Progress, Settings and sign-in status", async ({ page }) => {
    await page.goto("/it");
    await expect(page.locator("header").getByText("Guest")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/settings");
    await expect(page.getByRole("link", { name: "Progress" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Level 1/ })).toBeChecked();
    await page.getByRole("radio", { name: /Level 2/ }).check();
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("group", { name: "Your question" })).toBeVisible();
  });

  test("the chosen level is remembered", async ({ page }) => {
    await page.goto("/it");
    await page.getByRole("radio", { name: /Level 2/ }).check();
    await page.reload();
    await expect(page.getByRole("radio", { name: /Level 2/ })).toBeChecked();
  });
});
