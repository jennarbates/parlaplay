import { expect, test } from "@playwright/test";
import { hasSupabase, newEmail } from "../inbox.ts";
import { signIn } from "../signin.ts";
import { mistakeAndQuit, mistakes } from "./game.ts";

// Two devices on one account merge their Chinese review logs (spec 7.3). CI only.
test.skip(!hasSupabase, "needs the local Supabase (CI starts it)");

test("a mistake made on one device shows on the other", async ({ browser }) => {
  const email = newEmail();
  const phone = await (await browser.newContext()).newPage();
  const laptop = await (await browser.newContext()).newPage();

  await signIn(phone, email);
  await mistakeAndQuit(phone, "是", "狗"); // 狗: 是 → 有

  await signIn(laptop, email);
  await mistakeAndQuit(laptop, "有", "学校"); // 学校: 有 → 在
  await laptop.goto("/zh/progress");
  await expect(mistakes(laptop)).toContainText("是 → 有");
  await expect(mistakes(laptop)).toContainText("有 → 在");

  // The phone picks up the laptop's mistake on its next sync (app start).
  await phone.goto("/zh/progress");
  await expect(mistakes(phone)).toContainText("有 → 在");
  await expect(mistakes(phone)).toContainText("是 → 有");
});
