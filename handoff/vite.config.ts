import { defineConfig } from "vite";

// The handoff page (platform spec 5.3), built on its own into handoff/dist:
//   pnpm build:handoff
// VITE_PARLAPLAY_URL, read from the environment, points a staging or test build at
// somewhere other than https://parlaplay.games.
export default defineConfig({
  root: import.meta.dirname,
  envDir: false,
  build: { outDir: "dist", emptyOutDir: true },
});
