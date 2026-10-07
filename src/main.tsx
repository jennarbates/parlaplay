import { reactErrorHandler } from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "./index.css";
import { createRouter } from "./routes.tsx";
import { initErrors } from "./core/services/errors.ts";
import { startAccountSync } from "./core/store/account.ts";
import { useAuthStore } from "./core/store/authStore.ts";
import { useProgressStore } from "./core/store/progressStore.ts";
import { useRounds } from "./core/store/rounds.ts";
import { connectRouter, hydrateShell } from "./core/store/shell.ts";

// Before anything renders, so startup errors are caught too.
const reporting = initErrors();

// Load saved progress while the first screen renders. Each language resumes its own
// saved round when its module loads (platform spec 3.2).
startAccountSync();
void useAuthStore.getState().init();
void useProgressStore.getState().hydrate();
void useRounds.getState().hydrate();

// Platform spec 4: the shell sees every navigation, then the last language.
const router = createRouter();
connectRouter(router);
void hydrateShell();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// Without Sentry, React's own handlers keep logging to the console.
createRoot(
  root,
  reporting
    ? {
        onUncaughtError: reactErrorHandler(),
        onCaughtError: reactErrorHandler(),
        onRecoverableError: reactErrorHandler(),
      }
    : {},
).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
