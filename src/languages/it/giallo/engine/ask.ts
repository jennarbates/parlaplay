// Chi è stato? GS 5.3: the learner's ASK. Checks run in order and the first
// failure rejects; a rejected question costs nothing. A grammar rejection (steps 2
// and 3) still checks step 6, so feedback shows every problem at once.
import type { Frame } from "../content/schemas.ts";
import { answerKey, fill, jobText, lookup } from "./answers.ts";
import { shortestSolution } from "./invariants.ts";
import { agreementError, elisionError, joinQuestion, qwordById, usualForm } from "./question.ts";
import { caseById, variantOf } from "./start.ts";
import type {
  Built,
  CaseState,
  EngineContent,
  Event,
  NotebookEntry,
  RejectReason,
  SlotError,
  StepResult,
} from "./types.ts";

const reject = (state: CaseState, reason: RejectReason, earlier?: NotebookEntry): StepResult => ({
  state,
  events: [{ type: "rejected", reason, ...(earlier && { earlier }) }],
});

// GS 7, as it.md 6: at most one rating per card per turn, so a card that failed and
// was then fixed keeps its again. A turn ends when a question is accepted.
function rate(state: CaseState, events: Event[], lexiconId: string, rating: "again" | "good") {
  const card = `${lexiconId}|produce`;
  if (state.level !== 2 || state.ratedThisTurn.includes(card)) return state;
  events.push({ type: "rating", lexiconId, direction: "produce", rating });
  return { ...state, ratedThisTurn: [...state.ratedThisTurn, card] };
}

const genderOf = (state: CaseState, role: string, content: EngineContent): "m" | "f" =>
  content.characters.find((x) => x.id === state.cast[role])?.attrs.gender === "n.donna" ? "f" : "m";

const sameQuestion = (a: Built, b: Built) =>
  a.to === b.to && a.frame === b.frame && a.slot === b.slot && a.qword === b.qword;

// GS 4.3: the answer the person gives, with names, job, hiding place and crime
// slot filled in for the speaker's gender.
export function answerFor(state: CaseState, built: Built, content: EngineContent): NotebookEntry {
  const c = caseById(content, state.caseId);
  const v = variantOf(state);
  const answer = lookup(c, v, {
    to: built.to,
    frame: built.frame,
    qword: built.qword,
    ...(built.slot !== undefined && { slot: built.slot }),
  });
  const name = (id: string | undefined) => content.characters.find((x) => x.id === id);
  const gender = genderOf(state, built.to, content);
  const names = Object.fromEntries(
    Object.entries(state.cast).map(([role, id]) => [role, name(id)?.name ?? role]),
  );
  const text = fill(c, v, answer?.text ?? c.default, {
    names,
    gender,
    job: jobText(c, v, built.to, gender),
  });
  return { built, key: answer ? answerKey(answer) : null, answer: text };
}

// The fewest questions that solve the case, with their answers: what the case
// end shows, solved or not (GS 2, Accusing).
export function solution(state: CaseState, content: EngineContent): NotebookEntry[] {
  const c = caseById(content, state.caseId);
  const questions = shortestSolution(c, content.frames, variantOf(state)) ?? [];
  // Built with each question word's usual form, for the case end to show.
  const formOf = (qword: string, frameId: string) => {
    const q = qwordById(content.lexicon, qword);
    const frame = content.frames.find((f) => f.id === frameId);
    return q && frame ? usualForm(q, frame) : "";
  };
  return questions.map((q) =>
    answerFor(
      state,
      { ...q, form: formOf(q.qword, q.frame), ...prepOf(q.qword, content) },
      content,
    ),
  );
}

const prepOf = (qword: string, content: EngineContent) => {
  const prep = qwordById(content.lexicon, qword)?.prep;
  return prep ? { prep } : {};
};

const tileText = (id: string | undefined, content: EngineContent) => {
  const entry = content.lexicon.find((x) => x.id === id);
  return entry && entry.pos !== "qword" ? entry.text : "";
};

// GS 5.3, Joining: the question as the learner built it, with the body for the
// gender of the person asked and the slot filled in. "Dov'era tra le otto e le nove?"
export function questionFor(state: CaseState, built: Built, content: EngineContent): string {
  const c = caseById(content, state.caseId);
  const frame = content.frames.find((f) => f.id === built.frame);
  const body = (frame?.body[genderOf(state, built.to, content)] ?? "").replace(
    "{slot}",
    built.slot === undefined ? "" : (c.slots[built.slot] ?? ""),
  );
  return joinQuestion([tileText(built.prep, content), built.form, body]);
}

// GS 5.3 step 3, known errors: the frame teaches this lemma built without its
// preposition. The lemma to rate again is the one the learner should have built:
// the frame's lemma with a preposition that shares a form with this one (`chi` →
// q.di_chi, `dov'` → q.da_dove).
function knownError(built: Built, frame: Frame, content: EngineContent) {
  if (built.prep !== undefined) return null;
  const taught = frame.teaches?.find((t) => t.built === built.qword);
  if (!taught) return null;
  const own = qwordById(content.lexicon, built.qword);
  const texts = new Set(own?.forms.map((f) => f.text));
  const target =
    frame.asks
      .map((a) => qwordById(content.lexicon, a.qword))
      .find((q) => q?.prep && q.forms.some((f) => texts.has(f.text))) ?? own;
  const error: SlotError = {
    slot: "prep",
    given: "",
    expected: tileText(target?.prep, content),
    rule: taught.rule,
  };
  return { error, lemma: target?.id ?? built.qword };
}

export function ask(state: CaseState, built: Built, content: EngineContent): StepResult {
  if (state.budget <= 0) return reject(state, "noBudget");
  const c = caseById(content, state.caseId);
  const frame = content.frames.find((f) => f.id === built.frame);
  const qword = qwordById(content.lexicon, built.qword);

  // 1. Shape: the person and frame are in the case, the slot is given when the
  // frame takes one, the form is one of the lemma's and the preposition is a tile.
  const slotOk = frame?.slotParam
    ? built.slot !== undefined && Number.isInteger(built.slot) && built.slot in c.slots
    : built.slot === undefined;
  const prepOk =
    built.prep === undefined ||
    content.lexicon.some((x) => x.id === built.prep && x.pos === "prep");
  if (
    !frame ||
    !qword ||
    !c.frames.includes(frame.id) ||
    !c.roles.includes(built.to) ||
    !slotOk ||
    !prepOk ||
    !qword.forms.some((f) => f.text === built.form)
  )
    return reject(state, "shape");

  // 2. Elision and 3. known errors reject, with again for the card the learner
  // should have built. 6 is checked too, so every problem shows at once.
  const slip = agreementError(qword, built.form, frame);
  const elision = elisionError(qword, built.form, frame);
  const known = knownError(built, frame, content);
  if (elision || known) {
    const events: Event[] = [];
    let s = state;
    if (elision) s = rate(s, events, qword.id, "again");
    if (known) s = rate(s, events, known.lemma, "again");
    const errors = [elision, known?.error, slip].filter((e): e is SlotError => !!e);
    return { state: s, events: [{ type: "rejected", reason: "grammar", errors }, ...events] };
  }

  // 4. Meaning: the frame asks this lemma, with the lemma's own preposition.
  if (!frame.asks.some((a) => a.qword === built.qword) || built.prep !== qword.prep)
    return reject(state, "nonsense");

  // 5. Duplicate: same person, frame, slot and lemma; the earlier answer is shown.
  const earlier = state.notebook.find((e) => sameQuestion(e.built, built));
  if (earlier) return reject(state, "duplicate", earlier);

  // 6. A slip is accepted with the correct form; the card isn't rated, a slip row is.
  const entry = answerFor(state, slip ? { ...built, form: slip.expected } : built, content);
  const events: Event[] = [{ type: "asked", entry, ...(slip && { slip }) }];
  const rated = slip ? state : rate(state, events, built.qword, "good");
  if (slip) events.push({ type: "slip", error: slip });

  return {
    state: {
      ...rated,
      budget: state.budget - 1,
      notebook: [...state.notebook, entry],
      ratedThisTurn: [],
    },
    events,
  };
}
