import { expect, test, type Page } from "@playwright/test";
import { content } from "../src/languages/it/content/index.ts";
import { allQuestions } from "../src/languages/it/engine/index.ts";
import { evaluate } from "../src/languages/it/engine/meaning.ts";
import { startGame } from "../src/languages/it/engine/start.ts";

// CHI-074: the Progress screen.

// The ratings in the review log saved in IndexedDB.
function savedRatings(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open("chi-e");
        open.onsuccess = () => {
          const get = open.result.transaction("kv").objectStore("kv").get("guest");
          get.onsuccess = () => {
            open.result.close();
            resolve(
              (
                (get.result as { reviewLog?: { rating: string }[] } | undefined)?.reviewLog ?? []
              ).map((r) => r.rating),
            );
          };
        };
      }),
  );
}

const tile = (page: Page, group: string, name: string) =>
  page.getByRole("group", { name: group, exact: true }).getByRole("button", { name, exact: true });

test("with no play yet, both tabs show the empty state", async ({ page }) => {
  await page.goto("/progress");
  await expect(page.getByText("Play a round to see your words here.")).toBeVisible();
  await page.getByRole("tab", { name: "Due" }).click();
  await expect(page.getByRole("tab", { name: "Due" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Play a round to see your words here.")).toBeVisible();
});

test("after a round: mistakes grouped by word, and words due with dates", async ({ page }) => {
  const g = startGame(8, 2, content);
  await page.goto("/play?level=2&seed=8");

  // Two article mistakes on barba (one repeated), then a slip on biondi.
  await tile(page, "Verb", "ha").click();
  await tile(page, "Article", "il").click();
  await tile(page, "Noun", "barba").click();
  await page.getByRole("button", { name: "Chiedi" }).click();
  await page.getByRole("button", { name: "Chiedi" }).click(); // the same mistake again, same turn: one rating
  await tile(page, "Article", "la").click();
  await page.getByRole("button", { name: "Chiedi" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();

  // Answer the CPU wrongly.
  const text = await page.evaluate(
    () => document.querySelector('section[aria-label="Questions"] p[lang="it"]')?.textContent ?? "",
  );
  const q = allQuestions(content).find((x) => x.text === text);
  const attrs = content.characters.find((c) => c.id === g.playerSecret)?.attrs;
  if (!q || !attrs) throw new Error("no CPU question");
  await page
    .getByRole("button", { name: evaluate(q.asked, attrs) ? "No" : "Sì", exact: true })
    .click();
  await page.getByRole("button", { name: "Avanti" }).click();

  // Turn 2: a slip.
  await tile(page, "Verb", "ha").click();
  await tile(page, "Article", "i").click();
  await tile(page, "Noun", "capelli").click();
  await page
    .getByRole("group", { name: "Adjective", exact: true })
    .getByRole("button", { name: "biondo…" })
    .click();
  await tile(page, "Forms", "bionde").click();
  await page.getByRole("button", { name: "Chiedi" }).click();
  await expect(page.getByRole("button", { name: "Avanti" })).toBeVisible();

  // Wait for the review log to reach IndexedDB before leaving the page.
  await expect.poll(() => savedRatings(page)).toContain("slip");
  await page.goto("/progress");
  const mistakes = page.getByRole("list", { name: "Mistakes by word" });
  await expect(mistakes).toContainText("barba");
  await expect(mistakes).toContainText("il → la");
  await expect(mistakes).toContainText("biondo");
  await expect(mistakes).toContainText("bionde → biondi");
  await expect(mistakes).toContainText(q.fill.noun.replace("n.", ""));
  // Newest first: the slip on biondo came last.
  await expect(mistakes.getByRole("listitem").first()).toContainText("biondo");

  await page.getByRole("tab", { name: "Due" }).click();
  // barba was rated again (due now); the CPU question's words were rated again too.
  const dueToday = page.getByRole("region", { name: "Due today" });
  await expect(dueToday).toContainText("barba");
  await expect(dueToday).toContainText("Say");
  await expect(dueToday).toContainText("Understand");
  // capelli was rated good. FSRS's learning steps bring a new card back within
  // minutes, so it is due later today, and every card shows its next review time.
  await expect(dueToday).toContainText("capelli");
  for (const time of await dueToday.locator("time").all()) {
    await expect(time).toHaveAttribute("datetime", /^\d{4}-\d\d-\d\dT/);
    await expect(time).toHaveText(/\d{1,2}:\d\d/);
  }
});
