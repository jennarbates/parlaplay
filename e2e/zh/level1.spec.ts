import { expect, test } from "@playwright/test";
import { content } from "../../src/languages/zh/content/index.ts";
import { startGame } from "../../src/languages/zh/engine/start.ts";
import {
  answerCpu,
  answers,
  card,
  chineseText,
  collapseSheet,
  guessCard,
  nameOf,
  picker,
  savedRound,
  stored,
  sheet,
  truth,
  waitForPhase,
  zh,
} from "./game.ts";

// A whole Level 1 round in the browser (spec 8.1). The engine runs here too, so
// the test knows the secrets and the true answers.

const seed = 5;
const game = startGame(seed, 1, content);

test("the picker lists the 14 questions with pinyin and English, and the pronoun switch", async ({
  page,
}) => {
  await page.goto(`/play?seed=${seed}`);
  await expect(picker(page).getByRole("button")).toHaveCount(14);
  expect(await chineseText(picker(page))).toContain("他是医生吗？");
  await expect(picker(page)).toContainText("Is he a doctor?");
  await expect(picker(page)).toContainText("Does he have a dog?");
  await expect(picker(page)).toContainText("Is he at school?");
  // Pinyin is shown above every word at Level 1 (D14).
  await expect(picker(page).locator("rt").first()).toHaveText("tā");

  await page.getByRole("button", { name: /她\s*she/ }).click();
  await expect.poll(() => chineseText(picker(page))).toContain("她是医生吗？");
  await expect(picker(page)).toContainText("Is she a doctor?");
  // The switch is remembered on this device (spec 7.3).
  await expect.poll(() => stored(page, "settings")).toEqual({ pinyin: false, pronoun: "pr.ta.f" });
  await page.reload();
  await expect(page.getByRole("button", { name: /她\s*she/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("a whole round: ask, answer the CPU right and wrong, guess with confirm", async ({ page }) => {
  await page.goto(`/play?seed=${seed}`);

  // Ask: the answer is the truth about the CPU's secret, with the asker's pronoun.
  await picker(page)
    .getByRole("button", { name: /Does he have a dog\?/ })
    .click();
  const yes = truth("v.you|n.gou", game.cpuSecret);
  const answer = yes ? "有，他有狗。" : "没有，他没有狗。";
  await expect(sheet(page)).toContainText(answer);
  await expect(page.locator("header")).toContainText("Your turn");

  // Next: the CPU asks, with two answer buttons in its question's verb.
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.locator("header")).toContainText("Computer's turn");
  await expect(answers(page).getByRole("button")).toHaveCount(2);

  // Show hint reveals the English.
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(sheet(page)).toContainText(/^.*(Is|Does) (he|she) /);

  // Answer wrongly on purpose: the correct full answer is shown.
  await answerCpu(page, false, game.playerSecret);
  await expect(sheet(page)).toContainText("Not quite:");
  await expect(sheet(page)).toContainText("✗");

  // Back to the player; the question asked is greyed out with its answer.
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.locator("header")).toContainText("Turn 2");
  const asked = picker(page).getByRole("button").nth(5); // 他有狗吗？, the sixth question
  await expect(asked).toBeDisabled();
  await expect(asked).toContainText(answer);

  // Guess: flip a card, tap it while guessing, see the warning, cancel; then guess right.
  const wrongOne = content.characters.find((c) => c.id !== game.cpuSecret);
  if (!wrongOne) throw new Error("no other character");
  await collapseSheet(page);
  await card(page, wrongOne.name).click();
  await page.getByRole("button", { name: "Guess", exact: true }).click();
  await expect(sheet(page)).toContainText("Tap the card you think it is.");
  await guessCard(page, wrongOne.name, true).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(`Guess ${wrongOne.name} ${wrongOne.namePinyin}?`);
  await expect(dialog).toContainText(`${wrongOne.name} is flipped down.`);
  await expect(dialog).toContainText("A wrong guess loses the round.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("header")).toContainText("Your turn"); // nothing happened

  const target = nameOf(game.cpuSecret);
  await guessCard(page, target).click();
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
  await page.goto(`/play?seed=${seed}`);
  await page.getByRole("button", { name: "Guess", exact: true }).click();
  await page.getByRole("button", { name: "Cancel guess" }).click();
  await expect(page.getByRole("button", { name: "Guess", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Guess \S+：/ })).toHaveCount(0);
});

test("a wrong guess loses", async ({ page }) => {
  await page.goto(`/play?seed=${seed}`);
  const wrong = content.characters.find((c) => c.id !== game.cpuSecret);
  if (!wrong) throw new Error("no other character");
  await page.getByRole("button", { name: "Guess", exact: true }).click();
  await guessCard(page, wrong.name).click();
  await page.getByRole("dialog").getByRole("button", { name: "Guess", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You lost." })).toBeVisible();
  await expect(
    page.getByText(`That wasn't it. The computer's card was ${nameOf(game.cpuSecret)}.`),
  ).toBeVisible();
});

test("answering the CPU correctly shows Right!", async ({ page }) => {
  await page.goto(`/play?seed=${seed}`);
  await picker(page).getByRole("button").first().click();
  await page.getByRole("button", { name: "Next" }).click();
  await answerCpu(page, true, game.playerSecret);
  await expect(sheet(page)).toContainText("Right!");
  await expect(sheet(page)).toContainText("✓");
});

test("a pronoun slip after the gender is known is shown, and the question still answered", async ({
  page,
}) => {
  await page.goto(`/play?seed=${seed}`);
  const woman = content.characters.find((c) => c.id === game.cpuSecret)?.attrs.gender === "n.nvde";
  // Ask the gender, then ask with the other pronoun.
  await picker(page)
    .getByRole("button", { name: /Is he a man\?/ })
    .click();
  await page.getByRole("button", { name: "Next" }).click();
  await answerCpu(page, true, game.playerSecret);
  await page.getByRole("button", { name: "Next" }).click();
  await waitForPhase(page, "playerTurn");
  if (!woman) await page.getByRole("button", { name: /她\s*she/ }).click();
  await picker(page)
    .getByRole("button", { name: /have a cat\?/ })
    .click();
  await expect(sheet(page)).toContainText(
    `You found out they're ${woman ? "a woman" : "a man"}, so write ${woman ? "她" : "他"}.`,
  );
  expect((await savedRound(page))?.phase).toBe("playerReview");
});

test("Level 1 offers the right verb's two answers, with pinyin", async ({ page }) => {
  await page.goto(`/play?seed=${seed}`);
  await picker(page).getByRole("button").first().click();
  await page.getByRole("button", { name: "Next" }).click();
  await waitForPhase(page, "cpuTurn");
  const verb = (await savedRound(page))?.pendingCpuQuestion?.key.split("|")[0];
  const pair = { "v.shi": ["是", "不是"], "v.you": ["有", "没有"], "v.zai": ["在", "不在"] }[
    verb ?? ""
  ];
  for (const h of pair ?? []) await expect(zh(answers(page), h)).toBeVisible();
  await expect(answers(page).locator("[lang=zh-Latn-pinyin]")).toHaveCount(2);
});
