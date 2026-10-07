import { defineConfig, devices } from "@playwright/test";

const port = 4173;

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

// Shéi's specs (e2e/zh/) are from its own repo, where it was served at /. They
// run again once /zh is routed (PLAY-017, PLAY-019) and the platform suite
// (PLAY-038) points them there.
const shei = "**/zh/**";

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
    { name: "chromium", use: { ...devices["Pixel 7"] }, testIgnore: ["desktop.spec.ts", shei] },
    { name: "webkit", use: { ...devices["iPhone 15"] }, testIgnore: ["desktop.spec.ts", shei] },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: desktop },
      testIgnore: [...phoneOnly, shei],
    },
    {
      name: "desktop-webkit",
      use: { ...devices["Desktop Safari"], viewport: desktop },
      testIgnore: [...phoneOnly, shei],
    },
  ],
  // Test the production build, not the dev server.
  webServer: {
    command: `pnpm build && pnpm preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
