// Platform spec 3.2: Shéi as the shell sees it. Loaded with import() the first
// time a /zh route is visited (D17).
import type { Label, LanguageModule } from "../../core/language-module.ts";
import { useRounds } from "../../core/store/rounds.ts";
import { cardIds } from "./cards.ts";
import { contentVersion } from "./content/index.ts";
import { inProgress, isResumable, useGameStore } from "./store/gameStore.ts";
import { DeviceSettings, useSettings } from "./store/settings.ts";
import { Game } from "./ui/Game.tsx";
import { Home } from "./ui/Home.tsx";
import { Progress } from "./ui/Progress.tsx";
import { labelFor as wordLabel } from "./ui/words.ts";

function labelFor(id: string): Label | undefined {
  const l = wordLabel(id);
  if (!l) return undefined;
  return l.kind === "noun"
    ? { kind: "word", text: l.hanzi, reading: l.pinyin, gloss: l.gloss, lang: "zh-Hans" }
    : l;
}

// Resume a saved round and this device's settings, and let the shell start or
// clear a round (core/store/rounds.ts).
void useGameStore.getState().hydrate();
void useSettings.getState().hydrate();
useRounds.getState().register("zh", {
  newRound(level) {
    const { status, game, start } = useGameStore.getState();
    if (status === "ready" && !inProgress(game)) start(level);
  },
  clearRound() {
    useGameStore.setState({ game: null, gameId: null, lastAction: null, lastEvents: [] });
  },
});

// Shéi has no desktop layout of its own: every screen keeps the phone's width.
const width = "lg:max-w-md";

const chinese: LanguageModule = {
  code: "zh",
  contentVersion,
  routes: [
    { index: true, Component: Home, handle: { width } },
    { path: "play", Component: Game, handle: { width, game: true } },
    { path: "progress", Component: Progress, handle: { width } },
  ],
  cardIds,
  labelFor,
  isResumable,
  deviceSettings: DeviceSettings,
};

export default chinese;
