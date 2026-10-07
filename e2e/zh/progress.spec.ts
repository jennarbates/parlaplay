import { expect, test } from "@playwright/test";
import { content } from "../../src/languages/zh/content/index.ts";
import { startGame } from "../../src/languages/zh/engine/start.ts";
import { answerCpu, build, hanziOf, savedGuest } from "./game.ts";

// The Progress screen (spec 8.1).

const savedRatings = async (page: Parameters<typeof savedGuest>[0]) =>
  ((await savedGuest(page)).reviewLog ?? []).map((r) => r.rating);

test("with no play yet, both tabs show the empty state", async ({ page }) => {
  await page.goto("/progress");
  await expect(page.getByText("Play a round to see your words here.")).toBeVisible();
  await page.getByRole("tab", { name: "Due" }).click();
  await expect(page.getByRole("tab", { name: "Due" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Play a round to see your words here.")).toBeVisible();
});

test("after a round: mistakes by word and grammar point, and words due with dates", async ({
  page,
}) => {
  const g = startGame(8, 2, content);
  await page.goto("/play?level=2&seed=8");
  const ask = () => page.getByRole("button", { name: "Ask", exact: true }).click();
  const clear = () => page.getByRole("button", { name: "Clear" }).click();

  // A wrong verb on 狗 (twice in one turn: one rating), then the fixed question.
  await build(page, "他", "是", "狗", "吗");
  await ask();
  await ask();
  await clear();
  await build(page, "他", "有", "狗", "吗");
  await ask();
  await page.getByRole("button", { name: "Next" }).click();

  // Answer the CPU wrongly: the question's noun is rated again, to understand.
  const { key } = await answerCpu(page, false, g.playerSecret);
  await page.getByRole("button", { name: "Next" }).click();

  // Turn 2: a word-order slip.
  await build(page, "他", "狗", "有", "吗");
  await ask();

  await expect.poll(() => savedRatings(page)).toContain("slip");
  await page.goto("/progress");
  const mistakes = page.getByRole("list", { name: "Mistakes by word and grammar point" });
  await expect(mistakes).toContainText("狗");
  await expect(mistakes).toContainText("是 → 有");
  await expect(mistakes).toContainText("Word order");
  await expect(mistakes).toContainText("Who + verb + what + 吗");
  // Newest first: the order slip came last.
  await expect(mistakes.getByRole("listitem").first()).toContainText("Word order");
  await expect(mistakes).toContainText(hanziOf(key.split("|")[1] ?? ""));

  await page.getByRole("tab", { name: "Due" }).click();
  // 狗 was rated again to say (due now) and good later; every card shows its time.
  const dueToday = page.getByRole("region", { name: "Due today" });
  await expect(dueToday).toContainText("狗");
  await expect(dueToday).toContainText("Say");
  await expect(dueToday).toContainText("Understand");
  for (const time of await dueToday.locator("time").all()) {
    await expect(time).toHaveAttribute("datetime", /^\d{4}-\d\d-\d\dT/);
    await expect(time).toHaveText(/\d{1,2}:\d\d/);
  }
});
