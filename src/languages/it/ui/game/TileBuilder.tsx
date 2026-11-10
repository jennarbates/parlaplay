import { TileRow } from "./TileRow.tsx";
import { content } from "../../content/index.ts";
import type { Adjective, Article, Noun, Verb } from "../../content/schemas.ts";
import { parseTiles, type Fill, type ShapeError, type Tiles } from "../../engine/index.ts";
import { FeedbackText } from "./FeedbackText.tsx";

const verbs = content.lexicon.filter((e): e is Verb => e.pos === "verb");
const articles = content.lexicon.filter((e): e is Article => e.pos === "article");
const nouns = content.lexicon.filter((e): e is Noun => e.pos === "noun" && !e.retired);
const adjectives = content.lexicon.filter((e): e is Adjective => e.pos === "adj" && !e.retired);
const text = new Map<string, string>([...verbs, ...articles, ...nouns].map((e) => [e.id, e.text]));

// "adj.marrone#mp" → "marroni"
function adjText(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const [id, key] = ref.split("#");
  const adj = adjectives.find((a) => a.id === id);
  return adj && key ? adj.forms[key as keyof Adjective["forms"]] : undefined;
}

// Each distinct form text once, with the first form key that spells it.
function distinctForms(adj: Adjective): { ref: string; text: string }[] {
  const seen = new Set<string>();
  return (["ms", "fs", "mp", "fp"] as const).flatMap((k) => {
    const t = adj.forms[k];
    if (seen.has(t)) return [];
    seen.add(t);
    return [{ ref: `${adj.id}#${k}`, text: t }];
  });
}

function shapeFeedback(error: ShapeError, tiles: Tiles) {
  const noun = nouns.find((n) => n.id === tiles.noun);
  const art = noun ? text.get(noun.defArt) : undefined;
  return [
    { messageKey: `shape.${error.kind}`, params: { noun: noun?.text ?? "", art: art ?? "" } },
  ];
}

// The question being built. Game holds it, so it survives the swap between the
// phone's sheet and the desktop panel (desktop spec DS 2.2).
export type TileDraft = { tiles: Tiles; openAdj?: string; shapeError?: ShapeError };

// Spec 3.4 and 8.1, Level 2: four slots in order (verb, article, noun,
// adjective) filled by tapping tiles, with no English.
export function TileBuilder({
  draft,
  onDraft,
  onAsk,
  roving = false,
}: {
  draft: TileDraft;
  onDraft: (update: (d: TileDraft) => TileDraft) => void;
  onAsk: (templateId: string, fill: Fill) => void;
  roving?: boolean; // desktop spec DS 8.1: Tab between rows, ← → along a row
}) {
  const { tiles, openAdj, shapeError } = draft;
  const setOpenAdj = (id: string | undefined) => onDraft((d) => ({ ...d, openAdj: id }));

  const set = (slot: keyof Tiles, value: string | undefined) => {
    onDraft((d) => {
      const rest = Object.fromEntries(Object.entries(d.tiles).filter(([k]) => k !== slot)) as Tiles;
      return {
        ...d,
        shapeError: undefined,
        tiles: value === undefined ? rest : { ...rest, [slot]: value },
      };
    });
  };

  const submit = () => {
    const parsed = parseTiles(tiles, content);
    if ("shapeError" in parsed) {
      onDraft((d) => ({ ...d, shapeError: parsed.shapeError }));
      return;
    }
    onAsk(parsed.templateId, parsed.fill);
  };

  const slots: { slot: keyof Tiles; label: string; value: string | undefined }[] = [
    { slot: "verb", label: "Verb", value: tiles.verb && text.get(tiles.verb) },
    { slot: "art", label: "Article", value: tiles.art && text.get(tiles.art) },
    { slot: "noun", label: "Noun", value: tiles.noun && text.get(tiles.noun) },
    { slot: "adj", label: "Adjective", value: adjText(tiles.adj) },
  ];
  const tile = (selected: boolean) =>
    `min-h-11 min-w-11 rounded-lg px-3 font-medium ring-1 ${
      selected
        ? "bg-stone-900 text-white ring-stone-900"
        : "bg-white ring-stone-300 hover:bg-stone-100 active:bg-stone-100"
    }`;

  return (
    <div className="flex flex-col gap-3 py-2">
      <div
        aria-label="Your question"
        role="group"
        className="flex flex-wrap items-center gap-1.5 text-lg"
      >
        {slots.map(({ slot, label, value }, i) => (
          <button
            key={slot}
            type="button"
            onClick={() => set(slot, undefined)}
            aria-label={value ? `${label}: ${value}. Tap to clear` : `${label}: empty`}
            className={`min-h-11 min-w-16 rounded-lg border-2 px-2 ${
              value
                ? "border-stone-900 bg-white font-semibold"
                : "border-dashed border-stone-400 text-sm text-stone-600"
            }`}
            lang={value ? "it" : undefined}
          >
            {value ? (i === 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value) : label}
          </button>
        ))}
        <span className="text-xl font-semibold">?</span>
      </div>

      {shapeError && <FeedbackText feedback={shapeFeedback(shapeError, tiles)} />}

      <TileRow label="Verb" roving={roving}>
        {verbs.map((v) => (
          <button
            key={v.id}
            type="button"
            lang="it"
            onClick={() => set("verb", v.id)}
            className={tile(tiles.verb === v.id)}
          >
            {v.text}
          </button>
        ))}
      </TileRow>
      <TileRow label="Article" roving={roving}>
        {articles.map((a) => (
          <button
            key={a.id}
            type="button"
            lang="it"
            onClick={() => set("art", a.id)}
            className={tile(tiles.art === a.id)}
          >
            {a.text}
          </button>
        ))}
      </TileRow>
      <TileRow label="Noun" roving={roving}>
        {nouns.map((n) => (
          <button
            key={n.id}
            type="button"
            lang="it"
            onClick={() => set("noun", n.id)}
            className={tile(tiles.noun === n.id)}
          >
            {n.text}
          </button>
        ))}
      </TileRow>
      <TileRow label="Adjective" roving={roving}>
        {adjectives.map((a) => (
          <button
            key={a.id}
            type="button"
            lang="it"
            aria-expanded={openAdj === a.id}
            onClick={() => setOpenAdj(openAdj === a.id ? undefined : a.id)}
            className={tile(tiles.adj?.startsWith(`${a.id}#`) ?? false)}
          >
            {a.forms.ms}…
          </button>
        ))}
      </TileRow>
      {openAdj && (
        <div
          role="group"
          aria-label="Forms"
          className="flex flex-wrap gap-1.5 rounded-xl bg-stone-100 p-2"
        >
          {distinctForms(adjectives.find((a) => a.id === openAdj) as Adjective).map((f) => (
            <button
              key={f.ref}
              type="button"
              lang="it"
              onClick={() => {
                set("adj", f.ref);
                setOpenAdj(undefined);
              }}
              className={tile(
                adjText(tiles.adj) === f.text && tiles.adj?.startsWith(`${openAdj}#`) === true,
              )}
            >
              {f.text}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        className="min-h-12 rounded-xl bg-stone-900 font-semibold text-white active:bg-stone-700"
      >
        Chiedi
      </button>
    </div>
  );
}
