// Platform spec 3.2: Chi è? as the shell sees it. Loaded with import() the first
// time an /it route is visited (D17).
import { z } from "zod";
import type { Label, LanguageModule } from "../../core/language-module.ts";
import { useRounds } from "../../core/store/rounds.ts";
import { cardIds } from "./cards.ts";
import { content, contentVersion } from "./content/index.ts";
import { inProgress, isResumable, useGameStore } from "./store/gameStore.ts";
import { Game } from "./ui/Game.tsx";
import { Home } from "./ui/Home.tsx";
import { Progress } from "./ui/Progress.tsx";

const labels = new Map<string, Label>(
  content.lexicon.flatMap((e) =>
    e.pos === "noun"
      ? [[e.id, { kind: "word", text: e.text, gloss: e.gloss, lang: "it" }] as const]
      : e.pos === "adj"
        ? [[e.id, { kind: "word", text: e.forms.ms, gloss: e.gloss, lang: "it" }] as const]
        : [],
  ),
);

// Resume a saved round, and let the shell start or clear one (core/store/rounds.ts).
void useGameStore.getState().hydrate();
useRounds.getState().register("it", {
  newRound(level) {
    const { status, game, start } = useGameStore.getState();
    if (status === "ready" && !inProgress(game)) start(level);
  },
  clearRound() {
    useGameStore.setState({ game: null, gameId: null, lastAction: null, lastEvents: [] });
  },
});

const italian: LanguageModule = {
  code: "it",
  contentVersion,
  // Desktop spec DS 5: each screen's width at lg; the game takes the whole window.
  routes: [
    { index: true, Component: Home, handle: { width: "lg:max-w-5xl" } },
    { path: "play", Component: Game, handle: { width: "lg:max-w-none", game: true } },
    { path: "progress", Component: Progress, handle: { width: "lg:max-w-6xl" } },
  ],
  cardIds,
  labelFor: (id) => labels.get(id),
  isResumable,
  deviceSettings: z.strictObject({}), // Chi è? has none
};

export default italian;
