import type { Character } from "../../content/schemas.ts";
import type { GameState } from "../../engine/index.ts";
import { Logo } from "../../../../core/ui/Logo.tsx";
import { Face } from "../Face.tsx";

const whoseTurn: Record<GameState["phase"], string> = {
  setup: "",
  playerTurn: "Your turn",
  playerReview: "Your turn",
  cpuTurn: "Computer's turn",
  cpuReview: "Computer's turn",
  over: "Round over",
};

// Spec 8.1: turn, whose turn, and the player's own secret card, always visible.
// The card fills the bar's height in an amber frame so it stands out (#131);
// clicking it opens the detail view to check it.
export function TopBar({
  game,
  secret,
  onZoom,
  menu,
}: {
  game: GameState;
  secret: Character;
  onZoom: () => void;
  menu?: React.ReactNode;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-stone-200 bg-white px-3">
      {/* Platform spec 8.4: the logo first; the bubble alone on phones. */}
      <div className="flex min-w-0 items-center gap-2 lg:gap-4">
        <Logo compact />
        <div className="leading-tight">
          <p className="text-xs text-stone-600">Turn {game.turn}</p>
          <p className="font-semibold" aria-live="polite">
            {whoseTurn[game.phase]}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <figure className="flex items-center gap-2 rounded-lg bg-amber-50 pl-2 ring-1 ring-amber-300">
          <figcaption className="text-right text-xs leading-tight text-stone-600">
            You are
            <br />
            <span lang="zh-Hans" className="text-sm font-semibold text-stone-900">
              {secret.name}
            </span>
            <br />
            <span lang="zh-Latn-pinyin">{secret.namePinyin}</span>
          </figcaption>
          <button
            type="button"
            onClick={onZoom}
            title="Zoom your card"
            className="flex min-w-11 justify-center rounded-r-lg hover:ring-2 hover:ring-stone-400 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:outline-none"
          >
            <Face
              character={secret}
              label={`Your card: ${secret.name}`}
              className="h-12 rounded-r-lg"
            />
            <span className="sr-only">Zoom your card</span>
          </button>
        </figure>
        {menu}
      </div>
    </header>
  );
}

// Desktop (#131): a larger copy of the player's card at the top of the side panel,
// big enough to read details like eye colour. Only on screens at least 800px
// tall, so at 1024 × 640 the panel keeps its height budget (ZS 6.3) and the board
// keeps its size. The bar's card stays the one to click and the one a screen
// reader hears, so this copy is hidden from assistive technology.
export function PanelCard({ secret }: { secret: Character }) {
  return (
    <figure
      aria-hidden="true"
      className="hidden shrink-0 items-center gap-4 border-b border-amber-200 bg-amber-50 px-5 py-3 [@media(min-height:50rem)]:flex"
    >
      <Face character={secret} className="h-32 rounded-lg ring-1 ring-amber-300" />
      <figcaption className="leading-tight">
        <span className="text-sm text-stone-600">You are</span>
        <br />
        <span lang="zh-Hans" className="text-2xl font-bold text-stone-900">
          {secret.name}
        </span>
        <br />
        <span lang="zh-Latn-pinyin" className="text-base text-stone-700">
          {secret.namePinyin}
        </span>
      </figcaption>
    </figure>
  );
}
