/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { contentCheck } from "./scripts/content-check.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), contentCheck()],
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      // Spec 10.3: engine/ line coverage, in every language, at or above 90%, or the test run fails.
      include: ["src/languages/*/engine/**/*.ts"],
      thresholds: { lines: 90 },
      exclude: ["src/languages/*/engine/**/*.test.ts"],
      reporter: ["text", "html", "lcov"],
    },
  },
});
