import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const handoffPort = 4174;

// Spec 10.2: e2e runs in Chromium and WebKit. Phone profiles, since the app is
// phone-first, plus desktop profiles at 1440 × 900 for the desktop layout
// (desktop spec DS 13.3). desktop.spec.ts runs only on desktop.
const desktop = { width: 1440, height: 900 };
// Specs written for the phone's bottom sheet, list board and tabs. The desktop
// projects skip them; desktop.spec.ts covers the same ground at desktop size.
const phoneOnly = [
  "board.spec.ts",
  "level1.spec.ts",
  "level2.spec.ts",
  "progress.spec.ts",
  "round.spec.ts",
  "states.spec.ts",
];

// Shéi's phone specs (e2e/zh/) run on the phone profiles only; its desktop layout
// has its own file, e2e/zh/desktop.spec.ts, run on the desktop profiles only, as
// Chi è?'s is (zh-desktop.md ZD12).
const sheiPhone = /\/zh\/(?!desktop\.spec\.ts$)/;
const desktopOnly = "**/desktop.spec.ts";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Pixel 7"] }, testIgnore: [desktopOnly] },
    { name: "webkit", use: { ...devices["iPhone 15"] }, testIgnore: [desktopOnly] },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: desktop },
      testIgnore: [...phoneOnly, sheiPhone],
    },
    {
      name: "desktop-webkit",
      use: { ...devices["Desktop Safari"], viewport: desktop },
      testIgnore: [...phoneOnly, sheiPhone],
    },
  ],
  // Test the production build, not the dev server. The handoff page (handoff/) is a
  // second origin, as chie.parlaplay.games is, built to send players to the first.
  webServer: [
    {
      command: `pnpm build && pnpm preview --port ${port} --strictPort`,
      url: `http://localhost:${port}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm build:handoff && pnpm exec vite preview --config handoff/vite.config.ts --port ${handoffPort} --strictPort`,
      url: `http://localhost:${handoffPort}`,
      env: { VITE_PARLAPLAY_URL: `http://localhost:${port}` },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
