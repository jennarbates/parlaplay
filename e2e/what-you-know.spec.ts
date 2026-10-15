import { expect, test, type Locator, type Page } from "@playwright/test";
import type { GameState as ItState } from "../src/languages/it/engine/index.ts";
import { factsOf as itFacts } from "../src/languages/it/ui/game/facts.ts";
import type { GameState as ZhState } from "../src/languages/zh/engine/index.ts";
import { factsOf as zhFacts } from "../src/languages/zh/ui/game/facts.ts";
import { build, chineseText, stored } from "./zh/game.ts";

// #132: "What you know", the facts the learner's own questions have found out about
// the computer's card, in the language being learned only. On the phone a button
// in the sheet opens them; on desktop they are a tab under the phase area.

const games = [
  {
    name: "Chi è?",
    path: "/it",
    next: "Avanti",
    answer: (page: Page) => page.getByRole("button", { name: "Sì", exact: true }),
    // The saved round's facts, worked out by the game's own code.
    expected: async (page: Page) =>
      itFacts((await stored<{ state: ItState }>(page, "round:it"))?.state.history ?? []),
    text: (l: Locator) => l.innerText(),
    // English the facts must never show: the first question's hint.
    english: "Does this person have blond hair?",
  },
  {
    name: "Shéi",
    path: "/zh",
    next: "Next",
    answer: (page: Page) =>
      page.getByRole("group", { name: "Your answer" }).getByRole("button").first(),
    expected: async (page: Page) =>
      zhFacts((await stored<{ state: ZhState }>(page, "round:zh"))?.state.history ?? []).map((f) =>
        f.map((s) => s.hanzi).join(""),
      ),
    text: chineseText,
    english: "Is this person a man?",
  },
];

// A list on the phone, Shéi's groups by verb on desktop.
const questions = (page: Page) =>
  page.locator('[aria-label="Questions to ask"]').getByRole("button", { disabled: false });
const facts = (scope: Page | Locator) => scope.getByRole("list", { name: "What you know" });

// One whole Level 1 turn: ask the first question still open, answer the computer.
async function turn(page: Page, game: { next: string; answer: (page: Page) => Locator }) {
  await questions(page).first().click();
  await page.getByRole("button", { name: game.next, exact: true }).click();
  await game.answer(page).click();
  await page.getByRole("button", { name: game.next, exact: true }).click();
}

for (const game of games) {
  test.describe(`${game.name}: What you know`, () => {
    test("phone: a button in the sheet opens the facts, newest first, with no English", async ({
      page,
    }, info) => {
      test.skip(info.project.name.startsWith("desktop"), "phone profiles");
      await page.goto(`${game.path}/play?seed=1`);
      const button = page.getByRole("button", { name: /^What you know/ });
      await expect(button).toHaveCount(0); // nothing found out yet
      await turn(page, game);
      await turn(page, game);
      await expect(button).toHaveText(/What you know \(2\)/);

      // It rebuilds from the saved round after a reload, once the last turn is saved.
      await expect.poll(async () => (await game.expected(page)).length).toBe(2);
      await page.reload();
      await button.click();
      const dialog = page.getByRole("dialog", { name: "What you know" });
      const items = facts(dialog).getByRole("listitem");
      await expect(items).toHaveCount(2);
      const expected = await game.expected(page);
      expect(await game.text(items.nth(0))).toBe(expected[0]);
      expect(await game.text(items.nth(1))).toBe(expected[1]);
      await expect(dialog).not.toContainText(game.english);
      await dialog.getByRole("button", { name: "Close" }).click();
      await expect(dialog).toBeHidden();
    });

    test("desktop: beside the board on your turn, at 1440 × 900", async ({ page }, info) => {
      test.skip(!info.project.name.startsWith("desktop"), "desktop profiles");
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${game.path}/play?seed=1`);
      const panel = page.getByRole("complementary", { name: "Questions" });
      await turn(page, game);
      const items = facts(panel).getByRole("listitem");
      await expect(items).toHaveCount(1);
      expect(await game.text(items.first())).toBe((await game.expected(page))[0]);
      await expect(facts(panel)).not.toContainText(game.english);
    });
  });
}

const shei = {
  next: "Next",
  answer: (page: Page) =>
    page.getByRole("group", { name: "Your answer" }).getByRole("button").first(),
};

test.describe("Shéi desktop: What you know (#132)", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "desktop profiles");
  const panel = (page: Page) => page.getByRole("complementary", { name: "Questions" });

  test("at 1024 × 640 its tab opens it over the questions; Esc gives focus back", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.goto("/zh/play?seed=1");
    await turn(page, shei);
    const tab = panel(page).locator('[data-tab="facts"]');
    await expect(tab).toHaveText(/What you know \(1\)/);
    await expect(facts(panel(page))).toHaveCount(0);
    await tab.click();
    await expect(facts(panel(page)).getByRole("listitem")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(facts(panel(page))).toHaveCount(0);
    await expect(tab).toBeFocused();
  });

  test("at Level 2 it stays in place while you build, without pinyin or glosses", async ({
    page,
  }) => {
    await page.goto("/zh/play?level=2&seed=8"); // 1440 × 900
    await build(page, "他", "有", "狗", "吗");
    await panel(page).getByRole("button", { name: "Ask", exact: true }).click();
    await panel(page).getByRole("button", { name: "Next" }).click();
    await page.getByRole("group", { name: "Your answer" }).getByRole("button").first().click();
    await panel(page).getByRole("button", { name: "Next" }).click();
    await expect(panel(page)).toContainText("Your turn: ask a question, or guess.");

    // The log is closed (ZD17); the facts are not.
    await expect(panel(page).getByRole("tab", { name: "What you know (1)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const item = facts(panel(page)).getByRole("listitem").first();
    expect(await chineseText(item)).toMatch(/^他(有|没有)狗。$/);
    await expect(item.locator("rt")).toHaveCount(0); // pinyin is off at Level 2
    await item.hover();
    await page.waitForTimeout(400);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });
});
