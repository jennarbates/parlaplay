import { expect, test } from "@playwright/test";

// CHI-092: the privacy note.

test("the privacy note covers storage, services, Safari and deletion", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  const note = page.getByRole("article");
  await expect(note.getByRole("heading", { name: "Privacy" })).toBeVisible();

  // Each service and what it sees (spec 9).
  const services = note.getByRole("region", { name: "Services that handle data" });
  const seen: [string, string][] = [
    ["Supabase", "database and sign-in"],
    ["Cloudflare", "IP address"],
    ["Amazon SES", "email address"],
    ["Resend", "email address"],
    ["Sentry", "Personal data is removed"],
  ];
  for (const [name, sees] of seen) {
    await expect(services.getByRole("listitem").filter({ hasText: name })).toContainText(sees);
  }

  // Safari can clear guest data (spec 7.3).
  await expect(note).toContainText(
    "Safari on iPhone and iPad clears a site's storage after 7 days",
  );
  // No analytics.
  await expect(note).toContainText("no analytics and no trackers");

  // Deletion by email within one month.
  const email = note.getByRole("link", { name: /@parlaplay\.games$/ });
  await expect(email).toHaveAttribute("href", "mailto:privacy@parlaplay.games");
  await expect(note).toContainText("within one month");
  await expect(note).toContainText("There is no delete button in the app yet");
});

test("/privacy loads directly", async ({ page }) => {
  const res = await page.goto("/privacy");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
});
