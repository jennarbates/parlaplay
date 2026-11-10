// Chi è stato? GS 9.1, Level 2: the builder's tiles for one person, the question its
// slots make, and the feedback for what step() said about it. The builder asks
// through the same step() as the picker, so every check is the engine's (GS 5.3).
import type { Feedback } from "../../engine/types.ts";
import type { Frame } from "../content/schemas.ts";
import { genderOf, tileText } from "./ask.ts";
import { joinQuestion, lemmaOf, qwordById } from "./question.ts";
import { caseById } from "./start.ts";
import type { Built, CaseState, EngineContent, Event, SlotError } from "./types.ts";

// What the learner has put in the slots so far: a preposition id, a question-word
// form's text, a frame and a slot.
export type Draft = { prep?: string; form?: string; frame?: string; slot?: number };

export type BodyTile = { frame: string; text: string; slotParam: boolean };

export type BuilderTiles = {
  preps: { id: string; text: string }[]; // con di a da
  forms: string[]; // every question-word form once, qual' included (GS 3.1)
  words: string[]; // ora: added after a form to make a longer one (che → che ora)
  bodies: BodyTile[]; // the case's frames, for the gender of the person asked
  slots: string[]; // the case's three time slots
};

// The body as a tile: "era …", with the slot left open and no question mark.
const bodyTile = (body: string) => body.replace("{slot}", "…").replace(/\?$/, "");

const bodyOf = (state: CaseState, frame: Frame, role: string, content: EngineContent) =>
  frame.body[genderOf(state, role, content)];

export function builderTiles(state: CaseState, role: string, content: EngineContent): BuilderTiles {
  const c = caseById(content, state.caseId);
  const live = content.lexicon.filter((x) => !x.retired);
  const frames = c.frames.flatMap((id) => content.frames.find((f) => f.id === id) ?? []);
  // A lemma with a preposition lists only what follows it, which the plain lemmas'
  // tiles already spell (chi, dove), except che ora, which is che plus ora.
  const forms = [
    ...new Set(
      live
        .flatMap((x) => (x.pos === "qword" && x.prep === undefined ? x.forms : []))
        .map((f) => f.text),
    ),
  ];
  // GS 3.1: ora is a tile only where the case has a frame that asks a che ora.
  const asked = frames.flatMap((f) =>
    f.asks.flatMap((a) => qwordById(content.lexicon, a.qword)?.forms ?? []),
  );
  const words = live.flatMap((x) =>
    x.pos === "word" && asked.some((f) => f.text.endsWith(` ${x.text}`)) ? [x.text] : [],
  );
  return {
    preps: live.flatMap((x) => (x.pos === "prep" ? [{ id: x.id, text: x.text }] : [])),
    forms,
    words,
    bodies: frames.map((f) => ({
      frame: f.id,
      text: bodyTile(bodyOf(state, f, role, content)),
      slotParam: f.slotParam,
    })),
    slots: c.slots,
  };
}

// A word tile after a form makes a longer form (che + ora = che ora), if some
// lemma has it. undefined when it doesn't.
export function withWord(
  form: string | undefined,
  word: string,
  content: EngineContent,
): string | undefined {
  if (form === undefined) return undefined;
  const longer = `${form} ${word}`;
  const exists = content.lexicon.some(
    (x) => x.pos === "qword" && x.forms.some((f) => f.text === longer),
  );
  return exists ? longer : undefined;
}

export type Missing = "qword" | "body" | "slot";

// The question the slots make, or the first slot still empty. A slot left over
// from a body that took one is dropped.
export function builtOf(
  draft: Draft,
  role: string,
  content: EngineContent,
): Built | { missing: Missing } {
  if (draft.form === undefined) return { missing: "qword" };
  const frame = content.frames.find((f) => f.id === draft.frame);
  if (!frame) return { missing: "body" };
  if (frame.slotParam && draft.slot === undefined) return { missing: "slot" };
  const qword = lemmaOf(content.lexicon, draft.form, draft.prep);
  if (qword === undefined) return { missing: "qword" };
  return {
    ...(draft.prep !== undefined && { prep: draft.prep }),
    qword,
    form: draft.form,
    frame: frame.id,
    ...(frame.slotParam && draft.slot !== undefined && { slot: draft.slot }),
    to: role,
  };
}

// The question so far, joined as the engine joins it (dov' + era = Dov'era), with
// … for a slot still open. Empty until a question word or a body is in.
export function previewOf(
  state: CaseState,
  draft: Draft,
  role: string,
  content: EngineContent,
): string {
  const c = caseById(content, state.caseId);
  const frame = content.frames.find((f) => f.id === draft.frame);
  if (draft.form === undefined && !frame) return "";
  const body = frame
    ? bodyOf(state, frame, role, content).replace(
        "{slot}",
        (draft.slot !== undefined && c.slots[draft.slot]) || "…",
      )
    : "…?";
  return joinQuestion([tileText(draft.prep, content), draft.form ?? "…", body]);
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The words a rule's message needs (messages.json): the forms, and the frame's noun
// for agreement.
function paramsFor(error: SlotError, frame: Frame | undefined): Record<string, string> {
  const noun = frame?.noun;
  return {
    given: error.given,
    expected: error.expected,
    full: error.expected,
    noun: capital(noun?.text ?? ""),
    number: noun?.number === "pl" ? "plural" : "singular",
    genderNumber: `${noun?.gender === "f" ? "feminine" : "masculine"} ${
      noun?.number === "pl" ? "plural" : "singular"
    }`,
  };
}

// GS 3.2 and GS 5.3: what to tell the learner about an ASK, as message keys. A
// grammar rejection names every rule broken; a slip names its rule beside the
// answer; a question that makes no sense, or no shape, gets Non capisco la domanda.
// A duplicate and an empty budget are the screen's to say.
export function feedbackFor(
  built: Built,
  events: readonly Event[],
  content: EngineContent,
): Feedback {
  const frame = content.frames.find((f) => f.id === built.frame);
  const say = (e: SlotError) => ({ messageKey: e.rule, params: paramsFor(e, frame) });
  const first = events[0];
  if (first?.type === "asked") return first.slip ? [say(first.slip)] : [];
  if (first?.type !== "rejected") return [];
  if (first.reason === "nonsense" || first.reason === "shape")
    return [{ messageKey: "nonsense", params: {} }];
  return first.reason === "grammar" ? (first.errors ?? []).map(say) : [];
}
