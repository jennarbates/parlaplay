import { expect, test, type Page } from "@playwright/test";
import { content } from "../src/content/index.ts";
import { startGame } from "../src/engine/start.ts";
import { answers, answerCpu, build, savedRound, sheet, stored, waitForPhase, zh } from "./game.ts";

// Building questions from tiles at Level 2 (spec 8.1, D9), and the feedback each
// kind of mistake gets (spec 3.6, 4.3).

const seed = 5;
const game = startGame(seed, 2, content);
const tray = (page: Page) => page.getByRole("group", { name: "Your question" });
const ask = (page: Page) => page.getByRole("button", { name: "Ask", exact: true }).click();
const status = (page: Page) => sheet(page).getByRole("status");

test.beforeEach(async ({ page }) => {
  await page.goto(`/play?level=2&seed=${seed}`);
  await expect(tray(page)).toBeVisible();
});

test("no English at Level 2: no picker and no glosses", async ({ page }) => {
  await expect(page.getByRole("list", { name: "Questions to ask" })).toHaveCount(0);
  await expect(sheet(page)).not.toContainText("Is he");
});

test("21 tiles, the first row of 7 on one line", async ({ page }) => {
  const groups = ["Who, verbs and 吗", "People", "Pets and things", "Places"];
  const counts = await Promise.all(
    groups.map((g) =>
      page.getByRole("group", { name: g, exact: true }).getByRole("button").count(),
    ),
  );
  expect(counts).toEqual([7, 5, 5, 4]);
  const tops = await page
    .getByRole("group", { name: "Who, verbs and 吗" })
    .getByRole("button")
    .evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size);
  expect(tops).toBe(1);
});

test("tapping tiles fills the tray in order; tapping the tray removes; Clear empties", async ({
  page,
}) => {
  await build(page, "他", "有", "狗", "吗");
  await expect(tray(page)).toHaveText("他有狗吗");
  await zh(tray(page), "有").click();
  await expect(tray(page)).toHaveText("他狗吗");
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(tray(page)).toHaveText("Tap words below");
});

test("the tray holds at most 6 tiles", async ({ page }) => {
  await build(page, "他", "他", "他", "他", "他", "他");
  await expect(zh(page.getByRole("group", { name: "Who, verbs and 吗" }), "她")).toBeDisabled();
});

test("the pinyin toggle shows pinyin on tiles and tray, and is remembered", async ({ page }) => {
  const places = page.getByRole("group", { name: "Places" });
  await expect(places.locator("[lang=zh-Latn-pinyin]")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Pinyin" }).check();
  await build(page, "他");
  await expect(tray(page)).toContainText("tā");
  await expect(places).toContainText("xuéxiào");
  await expect.poll(() => stored(page, "settings")).toEqual({ pinyin: true, pronoun: "pr.ta.m" });
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Pinyin" })).toBeChecked();
});

for (const [tiles, message] of [
  [[], "Tap words to build a question."],
  [["有", "狗", "吗"], "Add who you're asking about: 他 or 她."],
  [["他", "狗", "吗"], "Add a verb: 是, 有 or 在."],
  [["他", "有", "吗"], "Add a word to ask about."],
  [["他", "她", "有", "狗", "吗"], "Use one word of each kind."],
] as [string[], string][]) {
  test(`shape error: ${message}`, async ({ page }) => {
    await build(page, ...tiles);
    await ask(page);
    await expect(status(page)).toHaveText(message);
    await expect(page.locator("header")).toContainText("Your turn");
    await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);
  });
}

test("a wrong verb is rejected with its rule, and the tiles stay to fix it", async ({ page }) => {
  await build(page, "他", "是", "狗", "吗");
  await ask(page);
  await expect(status(page)).toHaveText("Use 有 (yǒu) for things someone has: 他有狗吗？");
  // Chinese in feedback is marked as Chinese and never italicised (spec 3.6).
  await expect(status(page).locator("em")).toHaveCount(0);
  await expect(status(page).locator('[lang="zh-Hans"]').first()).toHaveText("有");
  await expect(tray(page)).toHaveText("他是狗吗");
  // Fix it.
  await zh(tray(page), "是").click();
  await page.getByRole("button", { name: "Clear" }).click();
  await build(page, "他", "有", "狗", "吗");
  await ask(page);
  await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
  await expect(sheet(page)).toContainText(/(有，他有狗|没有，他没有狗)。/);
});

test("你, missing 吗 and wrong order: every problem shows at once", async ({ page }) => {
  await build(page, "你", "狗", "有");
  await ask(page);
  await expect(status(page).getByRole("listitem")).toHaveText([
    '你 (nǐ) means "you". Ask about them with 他 or 她.',
    "Add 吗 (ma) at the end to make a yes/no question.",
    "Chinese word order is who + verb + what + 吗. Try: 他有狗吗？",
  ]);
});

test("有 with a job is off board: explained, not marked wrong", async ({ page }) => {
  await build(page, "他", "有", "老师", "吗");
  await ask(page);
  await expect(status(page)).toHaveText(
    "他有老师吗？ asks if they have a teacher. To ask about their job, use 是: 他是老师吗？",
  );
  await page.waitForTimeout(200);
  expect((await savedRound(page))?.ratedThisTurn).toEqual([]);
});

test("the same question with the other pronoun is a duplicate", async ({ page }) => {
  await build(page, "他", "有", "狗", "吗");
  await ask(page);
  await page.getByRole("button", { name: "Next" }).click();
  await answerCpu(page, true, game.playerSecret);
  await page.getByRole("button", { name: "Next" }).click();
  await waitForPhase(page, "playerTurn");
  await build(page, "她", "有", "狗", "吗");
  await ask(page);
  await expect(status(page)).toContainText("You already asked that. The answer was:");
  await expect(status(page)).toContainText("他");
});

test("the CPU's questions at Level 2: seven answers, no hint, 不有 never right", async ({
  page,
}) => {
  await build(page, "他", "是", "男的", "吗");
  await ask(page);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(answers(page).getByRole("button")).toHaveCount(7);
  for (const h of ["是", "不是", "有", "没有", "不有", "在", "不在"])
    await expect(zh(answers(page), h)).toBeVisible();
  await expect(page.getByRole("button", { name: "Show hint" })).toHaveCount(0);
  await zh(answers(page), "不有").click();
  await expect(status(page)).toContainText("Not quite:");
});
