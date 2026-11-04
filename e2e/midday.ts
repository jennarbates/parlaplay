import type { Page } from "@playwright/test";

// A card rated "again" comes back a minute later. In the last minutes before local
// midnight that is tomorrow, so a spec expecting it under "Due today" would fail
// then. These specs start at midday instead. Time still passes from there.
export function startAtMidday(page: Page) {
  const midday = new Date();
  midday.setHours(12, 0, 0, 0);
  return page.clock.install({ time: midday });
}
