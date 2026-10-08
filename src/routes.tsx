import { createBrowserRouter, type RouteObject } from "react-router";
import type { RouteHandle } from "./core/language-module.ts";
import { patchLanguageRoutes } from "./core/modules.ts";
import { LanguageFailed } from "./core/ui/LanguageFailed.tsx";
import { LanguagePicker } from "./core/ui/LanguagePicker.tsx";
import { Layout } from "./core/ui/Layout.tsx";
import { NotFound } from "./core/ui/NotFound.tsx";
import { Privacy } from "./core/ui/Privacy.tsx";
import { Settings } from "./core/ui/Settings.tsx";
import { Skeleton } from "./core/ui/Skeleton.tsx";

const shared = (width: string): RouteHandle => ({ width });

// Platform spec 8.1. Sign-in is a sheet, not a route. Each language's routes are
// added under /{code} when one of them is first visited (core/modules.ts).
export const shellRoutes: RouteObject[] = [
  {
    id: "shell",
    Component: Layout,
    HydrateFallback: Skeleton,
    children: [
      { index: true, Component: Skeleton },
      { path: "languages", Component: LanguagePicker, handle: shared("lg:max-w-5xl") },
      { path: "settings", Component: Settings, handle: shared("lg:max-w-3xl") },
      { path: "privacy", Component: Privacy, handle: shared("lg:max-w-3xl") },
      { path: "*", Component: NotFound, handle: shared("lg:max-w-3xl") },
    ],
  },
];

export const patchRoutesOnNavigation = patchLanguageRoutes({
  parentId: "shell",
  notFound: { path: "*", Component: NotFound, handle: shared("lg:max-w-3xl") },
  failed: (code) => ({ path: "*", element: <LanguageFailed code={code} /> }),
});

export function createRouter() {
  return createBrowserRouter(shellRoutes, { patchRoutesOnNavigation });
}
