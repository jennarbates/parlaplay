// Platform spec 3.2: Shéi as the shell sees it. Loaded with import() the first
// time a /zh route is visited (D17).
import { gameEntries } from "../../core/games.ts";
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
useRounds.getState().register("shei", {
  newRound(level) {
    const { status, game, start } = useGameStore.getState();
    if (status === "ready" && !inProgress(game)) start(level);
  },
  clearRound() {
    useGameStore.setState({ game: null, gameId: null, lastAction: null, lastEvents: [] });
  },
});

const chinese: LanguageModule = {
  code: "zh",
  games: gameEntries("zh"),
  contentVersions: { shei: contentVersion },
  routes: [
    // zh-desktop.md ZS 5.1: each screen's width at lg; the game takes the whole window.
    { index: true, Component: Home, handle: { width: "lg:max-w-5xl" } },
    { path: "play", Component: Game, handle: { width: "lg:max-w-none", game: true } },
    { path: "progress", Component: Progress, handle: { width: "lg:max-w-6xl" } },
  ],
  cardIds,
  labelFor,
  isResumable: (saved, game) => game === "shei" && isResumable(saved),
  deviceSettings: DeviceSettings,
};

export default chinese;
