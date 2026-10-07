import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "playwright-report", "test-results", ".wrangler"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  // engine/ stays pure: no React, DOM or app code (spec section 4)
  {
    files: ["src/engine/**/*.ts"],
    ignores: ["src/engine/**/*.test.ts"], // tests may time things
    languageOptions: { globals: {} },
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: ["react", "react-*", "zustand", "../ui/*", "../store/*", "../services/*"] },
      ],
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "localStorage",
        "indexedDB",
        "Date",
        "performance",
        "setTimeout",
        "setInterval",
        "fetch",
        "crypto",
      ],
      // Randomness comes only from the seed (spec 4).
      "no-restricted-properties": ["error", { object: "Math", property: "random" }],
    },
  },
  // core/state/ is the shell's pure decisions (platform spec 4): only type imports
  // from outside it, and no DOM, network, timers or clock.
  {
    files: ["src/core/state/**/*.ts"],
    ignores: ["src/core/state/**/*.test.ts"],
    languageOptions: { globals: {} },
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              allowTypeImports: true,
              message: "Only type imports from outside core/state.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "navigator",
        "localStorage",
        "indexedDB",
        "Date",
        "performance",
        "setTimeout",
        "setInterval",
        "fetch",
        "crypto",
      ],
      "no-restricted-properties": ["error", { object: "Math", property: "random" }],
    },
  },
  // The shortcut logic is pure too (desktop spec DS 4.6): only type imports, and
  // no DOM, timers or clock.
  {
    files: ["src/ui/game/shortcuts.ts"],
    languageOptions: { globals: {} },
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [{ group: ["*"], allowTypeImports: true, message: "Only type imports here." }],
        },
      ],
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "navigator",
        "localStorage",
        "Date",
        "performance",
        "setTimeout",
        "setInterval",
        "requestAnimationFrame",
      ],
    },
  },
  prettier,
);
