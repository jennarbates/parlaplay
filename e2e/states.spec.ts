import { expect, test } from "@playwright/test";
import { content } from "../src/content/index.ts";
import { startGame } from "../src/engine/start.ts";
import { answerCpu, guessCard } from "./game.ts";

// CHI-091: the states in spec 8.2 that are not covered elsewhere.

test("losing the connection mid-round keeps the round playable to the end", async ({
  page,
  context,
}) => {
  const g = startGame(5, 1, content);
  await page.goto("/play?seed=5");
  await expect(page.getByRole("list", { name: "Board" }).locator("img").first()).toBeVisible();
  // Every art layer this board needs is already loaded.
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);

  await page.getByRole("list", { name: "Questions to ask" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Next" }).click();
  await answerCpu(page, true, g.playerSecret);
  await page.getByRole("button", { name: "Next" }).click();
  // Flip a card and look at it large: the art is still there.
  const name = content.characters.find((c) => c.id === g.cpuSecret)?.name ?? "";
  const broken = await page.evaluate(
    () => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
  );
  expect(broken).toBe(0);
  await page.getByRole("button", { name: "Guess", exact: true }).click();
  await guessCard(page, name).click();
  await page.getByRole("dialog").getByRole("button", { name: "Guess", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You won!" })).toBeVisible();
  await context.setOffline(false);
});
