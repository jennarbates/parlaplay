import { reactErrorHandler } from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "./index.css";
import { router } from "./routes.tsx";
import { initErrors } from "./services/errors.ts";
import { startAccountSync } from "./store/account.ts";
import { useAuthStore } from "./store/authStore.ts";
import { useGameStore } from "./store/gameStore.ts";
import { usePrefs } from "./store/prefs.ts";
import { useProgressStore } from "./store/progressStore.ts";

// Before anything renders, so startup errors are caught too.
const reporting = initErrors();

// Load saved progress and resume a saved round, if any, while the first screen renders.
startAccountSync();
void useAuthStore.getState().init();
void useProgressStore.getState().hydrate();
void useGameStore.getState().hydrate();
void usePrefs.getState().hydrateSettings();

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
