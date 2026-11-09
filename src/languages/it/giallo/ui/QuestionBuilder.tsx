import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Feedback } from "../../engine/types.ts";
import { FeedbackText } from "../../ui/game/FeedbackText.tsx";
import { content } from "../content/index.ts";
import { questionFor } from "../engine/ask.ts";
import {
  builderTiles,
  builtOf,
  feedbackFor,
  previewOf,
  withWord,
  type Draft,
  type Missing,
} from "../engine/builder.ts";
import { engineContent } from "../engine/content.ts";
import type { Person } from "../engine/people.ts";
import type { Built, CaseState, Event, NotebookEntry } from "../engine/types.ts";

// What the last Chiedi got: an answer (with a slip's correction), the engine's
// feedback, the earlier answer to a duplicate, or the slot still empty.
type Outcome =
  | { kind: "asked"; entry: NotebookEntry; feedback: Feedback }
  | { kind: "rejected"; feedback: Feedback }
  | { kind: "duplicate"; earlier: NotebookEntry }
  | { kind: "missing"; missing: Missing };

const missingText: Record<Missing, string> = {
  qword: "Pick a question word.",
  body: "Pick how the question goes on.",
  slot: "Pick a time.",
};

// Chi è stato? GS 9.1, Level 2: three slots (preposition, question word, body) and
// the time when the body takes one, filled from rows of tiles with no English.
// Chiedi asks through step(), and the engine's feedback shows here. The draft is the
// case screen's, so it stays for the next person: the same question to someone else
// is a new one (GS 2). Key it by person, so their feedback doesn't follow.
export function QuestionBuilder({
  state,
  person,
  draft,
  onDraft,
  disabled,
  onAsk,
}: {
  state: CaseState;
  person: Person;
  draft: Draft;
  onDraft: (draft: Draft) => void;
  disabled: boolean; // out of questions (GS 2)
  onAsk: (built: Built) => Event[];
}) {
  const [outcome, setOutcome] = useState<Outcome>();
  const heading = useRef<HTMLHeadingElement>(null);
  // The sheet keeps its scroll, so a new person's builder would open partway down.
  useEffect(() => {
    heading.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const role = person.role;
  const tiles = builderTiles(state, role, engineContent);
  const body = tiles.bodies.find((b) => b.frame === draft.frame);
  const preview = previewOf(state, draft, role, engineContent);

  const change = (next: Draft) => {
    setOutcome(undefined);
    onDraft(next);
  };
  const without = (key: keyof Draft): Draft =>
    Object.fromEntries(Object.entries(draft).filter(([k]) => k !== key));
  // Tapping the tile that's in a slot takes it out again.
  const toggle = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    change(draft[key] === value ? without(key) : { ...draft, [key]: value });
  // The form's tile without a word after it: che for che ora.
  const word = tiles.words.find((w) => draft.form?.endsWith(` ${w}`));
  const baseForm = word ? draft.form?.slice(0, -word.length - 1) : draft.form;

  const submit = () => {
    const built = builtOf(draft, role, engineContent);
    if ("missing" in built) {
      setOutcome({ kind: "missing", missing: built.missing });
      return;
    }
    const events = onAsk(built);
    const first = events[0];
    const feedback = feedbackFor(built, events, engineContent);
    if (first?.type === "asked") setOutcome({ kind: "asked", entry: first.entry, feedback });
    else if (first?.type === "rejected" && first.earlier)
      setOutcome({ kind: "duplicate", earlier: first.earlier });
    else if (feedback.length > 0) setOutcome({ kind: "rejected", feedback });
    else setOutcome(undefined);
  };

  const prepText = tiles.preps.find((p) => p.id === draft.prep)?.text;
  const slots: { key: keyof Draft; label: string; value: string | undefined }[] = [
    { key: "prep", label: "Preposition", value: prepText },
    { key: "form", label: "Question word", value: draft.form },
    { key: "frame", label: "Question", value: body?.text },
    ...(body?.slotParam
      ? [
          {
            key: "slot" as const,
            label: "Time",
            value: draft.slot === undefined ? undefined : tiles.slots[draft.slot],
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3 py-2">
      <h2 ref={heading} className="font-semibold">
        Ask {person.character.name}
      </h2>
      <div role="group" aria-label="Your question" className="flex flex-wrap items-center gap-1.5">
        {slots.map(({ key, label, value }) => (
          <button
            key={key}
            type="button"
            onClick={() => change(without(key))}
            aria-label={value ? `${label}: ${value}. Tap to clear` : `${label}: empty`}
            lang={value ? "it" : undefined}
            className={`min-h-11 min-w-16 rounded-lg border-2 px-2 ${
              value
                ? "border-stone-900 bg-white font-semibold"
                : "border-dashed border-stone-400 text-sm text-stone-600"
            }`}
          >
            {value ?? label}
          </button>
        ))}
      </div>

      <TileRow label="Preposition">
        {tiles.preps.map((p) => (
          <Tile key={p.id} selected={draft.prep === p.id} onClick={() => toggle("prep", p.id)}>
            {p.text}
          </Tile>
        ))}
      </TileRow>
      <TileRow label="Question word">
        {tiles.forms.map((form) => (
          <Tile
            key={form}
            selected={baseForm === form}
            onClick={() => (baseForm === form ? change(without("form")) : toggle("form", form))}
          >
            {form}
          </Tile>
        ))}
        {tiles.words.map((w) => {
          const on = w === word;
          const form = on ? baseForm : withWord(draft.form, w, engineContent);
          return (
            <Tile
              key={w}
              selected={on}
              disabled={form === undefined}
              onClick={() => form !== undefined && change({ ...draft, form })}
            >
              {w}
            </Tile>
          );
        })}
      </TileRow>
      <TileRow label="Question">
        {tiles.bodies.map((b) => (
          <Tile
            key={b.frame}
            selected={draft.frame === b.frame}
            onClick={() => toggle("frame", b.frame)}
          >
            {b.text}
          </Tile>
        ))}
      </TileRow>
      {body?.slotParam && (
        <TileRow label="Time">
          {tiles.slots.map((text, i) => (
            <Tile key={text} selected={draft.slot === i} onClick={() => toggle("slot", i)}>
              {text}
            </Tile>
          ))}
        </TileRow>
      )}

      {/* By Chiedi, which the sheet scrolls down to: what it got is in view. */}
      {preview && (
        <p lang="it" className="text-lg font-medium">
          {preview}
        </p>
      )}
      <Result outcome={outcome} state={state} />
      <button
        type="button"
        lang="it"
        disabled={disabled}
        onClick={submit}
        className="min-h-12 rounded-xl bg-stone-900 font-semibold text-white enabled:active:bg-stone-700 disabled:bg-stone-300 disabled:text-stone-600"
      >
        Chiedi
      </button>
    </div>
  );
}

function Result({ outcome, state }: { outcome: Outcome | undefined; state: CaseState }) {
  if (!outcome) return null;
  const messages = content.messages;
  switch (outcome.kind) {
    case "missing":
      return (
        <p role="status" className="text-sm text-stone-700">
          {missingText[outcome.missing]}
        </p>
      );
    case "rejected":
      return <FeedbackText feedback={outcome.feedback} messages={messages} />;
    case "duplicate":
      return (
        <div role="status" className="rounded-lg bg-stone-100 px-3 py-2 text-sm">
          <p>You asked that already. It costs nothing.</p>
          <Asked entry={outcome.earlier} state={state} />
        </div>
      );
    case "asked":
      // The answer itself is announced with the case screen's status; a slip is
      // shown here, with the question as the engine corrected it (GS 2).
      return (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg bg-stone-100 px-3 py-2 text-sm">
            <Asked entry={outcome.entry} state={state} />
          </div>
          <FeedbackText feedback={outcome.feedback} tone="info" messages={messages} />
        </div>
      );
  }
}

function Asked({ entry, state }: { entry: NotebookEntry; state: CaseState }) {
  return (
    <p lang="it">
      <span className="font-medium">{questionFor(state, entry.built, engineContent)}</span>{" "}
      {entry.answer}
    </p>
  );
}

function TileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {children}
    </div>
  );
}

function Tile({
  selected,
  disabled = false,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      lang="it"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 min-w-11 rounded-lg px-3 font-medium ring-1 ${
        selected
          ? "bg-stone-900 text-white ring-stone-900"
          : "bg-white ring-stone-300 enabled:hover:bg-stone-100 enabled:active:bg-stone-100 disabled:text-stone-400"
      }`}
    >
      {children}
    </button>
  );
}
