import { createBrowserRouter } from "react-router";
import { Game } from "./languages/it/ui/Game.tsx";
import { Home } from "./languages/it/ui/Home.tsx";
import { Layout } from "./core/ui/Layout.tsx";
import { Privacy } from "./core/ui/Privacy.tsx";
import { Progress } from "./languages/it/ui/Progress.tsx";
import { Settings } from "./core/ui/Settings.tsx";

// Routes from spec 8.1. Sign-in is a sheet, not a route.
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/play", element: <Game /> },
      { path: "/progress", element: <Progress /> },
      { path: "/settings", element: <Settings /> },
      { path: "/privacy", element: <Privacy /> },
    ],
  },
]);
