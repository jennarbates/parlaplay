import { expect, test, type Page } from "@playwright/test";
import { content } from "../src/languages/it/content/index.ts";
import { allQuestions, questionByKey } from "../src/languages/it/engine/index.ts";
import { startGame } from "../src/languages/it/engine/start.ts";
import { evaluate } from "../src/languages/it/engine/meaning.ts";

// CHI-055, CHI-057, CHI-058, CHI-059: a whole Level 1 round in the browser. The
// engine runs here too, so the test knows the secrets and the true answers.

const seed = 5;
const game = startGame(seed, 1, content);
const attrsOf = (id: string) => content.characters.find((c) => c.id === id)?.attrs;
const nameOf = (id: string) => content.characters.find((c) => c.id === id)?.name ?? "";
const truth = (key: string, secret: string) => {
  const q = questionByKey(content, key);
  const a = attrsOf(secret);
  if (!q || !a) throw new Error(key);
  return evaluate(q.asked, a);
};

const sheet = (page: Page) => page.getByRole("region", { name: "Questions" });
const picker = (page: Page) => page.getByRole("list", { name: "Questions to ask" });

test("the Level 1 picker lists all 16 questions with English hints", async ({ page }) => {
  await page.goto(`/it/play?seed=${seed}`);
  const items = picker(page).getByRole("button");
  await expect(items).toHaveCount(16);
  await expect(picker(page)).toContainText("Ha i capelli biondi?");
  await expect(picker(page)).toContainText("Does this person have blond hair?");
  await expect(picker(page)).toContainText("È una donna?");
  await expect(picker(page)).toContainText("Is it a woman?");
  // The default brown-eyes wording.
  await expect(picker(page)).toContainText("Ha gli occhi marroni?");
  await expect(picker(page)).not.toContainText("occhi castani");
});

test("a whole round: ask, answer the CPU right and wrong, guess with confirm", async ({ page }) => {
  await page.goto(`/it/play?seed=${seed}`);
  const first = allQuestions(content)[0];
  if (!first) throw new Error("no questions");

  // Ask: the answer is the truth about the CPU's secret, shown in the collapsed sheet.
  await picker(page)
    .getByRole("button", { name: new RegExp(first.text.replace("?", "\\?")) })
    .click();
  const yes = truth(first.key, game.cpuSecret);
  const answer = yes
    ? `Sì, ${first.text.charAt(0).toLowerCase()}${first.text.slice(1, -1)}.`
    : `No, non ${first.text.charAt(0).toLowerCase()}${first.text.slice(1, -1)}.`;
  await expect(sheet(page)).toContainText(answer);
  await expect(page.locator("header")).toContainText("Your turn");

  // Avanti: the CPU asks.
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.locator("header")).toContainText("Computer's turn");
  const cpuKey = await page.evaluate(
    () => document.querySelector('section[aria-label="Questions"] p[lang="it"]')?.textContent,
  );
  const cpuQ = allQuestions(content).find((q) => q.text === cpuKey);
  if (!cpuQ) throw new Error(`unknown CPU question ${cpuKey}`);

  // Show hint reveals the English.
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(sheet(page)).toContainText(/Does this person have|Is it a/);

  // Answer wrongly on purpose: the correct answer is shown.
  const right = truth(cpuQ.key, game.playerSecret);
  await page.getByRole("button", { name: right ? "No" : "Sì", exact: true }).click();
  await expect(sheet(page)).toContainText("Not quite:");
  await expect(sheet(page)).toContainText(right ? "Sì, " : "No, non ");

  // Back to the player; the question asked is greyed out with its answer.
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.locator("header")).toContainText("Turn 2");
  const asked = picker(page).getByRole("button", {
    name: new RegExp(first.text.replace("?", "\\?")),
  });
  await expect(asked).toBeDisabled();
  await expect(asked).toContainText(answer);

  // Guess: Indovina, tap a flipped card, see the warning, cancel; then guess right.
  const wrongOne = content.characters.find((c) => c.id !== game.cpuSecret);
  if (!wrongOne) throw new Error("no other character");
  await page.getByRole("button", { name: /questions$/ }).click(); // fold the sheet to reach the board
  await page.getByRole("button", { name: new RegExp(`^${wrongOne.name}: capelli`) }).click(); // flip it down
  await page.getByRole("button", { name: "Indovina" }).click();
  await expect(sheet(page)).toContainText("Tap the card you think it is.");
  await page
    .getByRole("button", { name: new RegExp(`^Guess ${wrongOne.name}: .*\\(flipped down\\)$`) })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(`Guess ${wrongOne.name}?`);
  await expect(dialog).toContainText(`${wrongOne.name} is flipped down.`);
  await expect(dialog).toContainText("A wrong guess loses the round.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("header")).toContainText("Your turn"); // nothing happened

  const target = nameOf(game.cpuSecret);
  await page.getByRole("button", { name: new RegExp(`^Guess ${target}: [^(]*$`) }).click();
  await expect(dialog).not.toContainText("flipped down");
  await dialog.getByRole("button", { name: "Guess", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You won!" })).toBeVisible();
  await expect(page.getByText(`You found ${target} in 2 turns.`)).toBeVisible();

  // Play again starts a new round.
  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.locator("header")).toContainText("Turn 1");
  await expect(picker(page).locator("button:disabled")).toHaveCount(0);
});

test("Cancel guess leaves guessing mode without guessing", async ({ page }) => {
  await page.goto(`/it/play?seed=${seed}`);
  await page.getByRole("button", { name: "Indovina" }).click();
  await page.getByRole("button", { name: "Cancel guess" }).click();
  await expect(page.getByRole("button", { name: "Indovina" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Guess / })).toHaveCount(0);
});

test("a wrong guess loses", async ({ page }) => {
  await page.goto(`/it/play?seed=${seed}`);
  const wrong = content.characters.find((c) => c.id !== game.cpuSecret);
  if (!wrong) throw new Error("no other character");
  await page.getByRole("button", { name: "Indovina" }).click();
  await page.getByRole("button", { name: new RegExp(`^Guess ${wrong.name}: [^(]*$`) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Guess", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You lost." })).toBeVisible();
  await expect(
    page.getByText(`That wasn't it. The computer's card was ${nameOf(game.cpuSecret)}.`),
  ).toBeVisible();
});

test("answering the CPU correctly shows Right!", async ({ page }) => {
  await page.goto(`/it/play?seed=${seed}`);
  await picker(page).getByRole("button").first().click();
  await page.getByRole("button", { name: "Avanti" }).click();
  const text = await page.evaluate(
    () => document.querySelector('section[aria-label="Questions"] p[lang="it"]')?.textContent,
  );
  const q = allQuestions(content).find((x) => x.text === text);
  if (!q) throw new Error("no CPU question");
  await page
    .getByRole("button", { name: truth(q.key, game.playerSecret) ? "Sì" : "No", exact: true })
    .click();
  await expect(sheet(page)).toContainText("Right!");
  await expect(sheet(page)).toContainText("✓");
});
