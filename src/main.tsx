import { reactErrorHandler } from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "./index.css";
import { router } from "./routes.tsx";
import { initErrors } from "./core/services/errors.ts";
import { startAccountSync } from "./core/store/account.ts";
import { useAuthStore } from "./core/store/authStore.ts";
import { useGameStore } from "./languages/it/store/gameStore.ts";
import { useProgressStore } from "./core/store/progressStore.ts";

// Before anything renders, so startup errors are caught too.
const reporting = initErrors();

// Load saved progress and resume a saved round, if any, while the first screen renders.
startAccountSync();
void useAuthStore.getState().init();
void useProgressStore.getState().hydrate();
void useGameStore.getState().hydrate();

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
