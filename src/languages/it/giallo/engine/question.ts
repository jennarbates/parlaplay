// Chi è stato? GS 3: question words. Which lemma the learner's tiles make, the form
// a frame's noun needs, the GS 3.2 errors of a form, and the question as one string.
// Pure: no React, DOM or time (GS 5).
import type { Frame, LexiconEntry, QWord } from "../content/schemas.ts";
import type { SlotError } from "./types.ts";

export const qwordById = (lexicon: readonly LexiconEntry[], id: string): QWord | undefined => {
  const entry = lexicon.find((x) => x.id === id);
  return entry?.pos === "qword" ? entry : undefined;
};

// GS 3.1, Level 2 builder: the lemma a preposition tile and a question-word tile
// make. The lemma that takes this preposition wins, then one that takes none, so
// `di` + `chi` is q.di_chi, `chi` alone is q.chi, and `che ora` alone is still
// q.a_che_ora (for prep.aCheOra to catch).
export function lemmaOf(
  lexicon: readonly LexiconEntry[],
  form: string,
  prep?: string,
): string | undefined {
  const lemmas = lexicon.filter(
    (x): x is QWord => x.pos === "qword" && x.forms.some((f) => f.text === form),
  );
  return (
    lemmas.find((q) => q.prep === prep) ??
    lemmas.find((q) => q.prep === undefined) ??
    lemmas[0]
  )?.id;
}

// GS 3.2 agree.*: the lemmas that agree with the frame's noun.
const agreeRules: Record<string, string> = { "q.quanto": "agree.quanto", "q.quale": "agree.quale" };

const formText = (q: QWord, key: string) => q.forms.find((f) => f.key === key)?.text;

// The form the frame's noun needs: quante persone, quanti anni, quali scarpe, and
// qual before a vowel (qual è). undefined when the lemma doesn't agree.
export function agreedForm(q: QWord, frame: Frame): string | undefined {
  const { noun } = frame;
  if (!noun || !agreeRules[q.id]) return undefined;
  if (q.id === "q.quale")
    return formText(q, noun.number === "pl" ? "pl" : frame.vowelStart ? "trunc" : "sg");
  return formText(q, `${noun.gender}${noun.number === "sg" ? "s" : "p"}`);
}

// The usual spelling of a lemma in a frame, for questions the learner didn't build
// (the Level 1 picker, the case end): the agreed form, else the elided form before
// a vowel (GD5), else the first.
export function usualForm(q: QWord, frame: Frame): string {
  const elided = frame.vowelStart ? q.forms.find((f) => f.elided)?.text : undefined;
  return agreedForm(q, frame) ?? elided ?? q.forms[0]?.text ?? "";
}

// GS 5.3 step 6, agreement and truncation: a wrong form of the right lemma is a
// slip. null when the form fits; an unelided `quale è` fits as `dove era` does (GD5),
// and an elided form fits a singular noun (elision is step 2's).
export function agreementError(q: QWord, given: string, frame: Frame): SlotError | null {
  const expected = agreedForm(q, frame);
  const rule = agreeRules[q.id];
  if (expected === undefined || rule === undefined || given === expected) return null;
  const singular = frame.noun?.number === "sg";
  const form = q.forms.find((f) => f.text === given);
  if (singular && form?.elided) return null;
  if (q.id === "q.quale" && singular && frame.vowelStart && form?.key === "sg") return null;
  // qual' where qual is right is the truncation error; anywhere else, agreement.
  const trunc = form?.distractor && expected === formText(q, "trunc");
  return { slot: "qword", given, expected, rule: trunc ? "trunc.qualE" : rule };
}

// GS 5.3 step 2, elision: an elided form only goes before a vowel. expected is the
// full form: the agreed one if the lemma agrees (quante), else the one the elided
// form shortens (dov' → dove).
export function elisionError(q: QWord, given: string, frame: Frame): SlotError | null {
  const form = q.forms.find((f) => f.text === given);
  if (!form?.elided || frame.vowelStart) return null;
  const stem = given.replace(/'$/, "");
  const full =
    agreedForm(q, frame) ??
    q.forms.find((f) => !f.elided && !f.distractor && f.text.startsWith(stem))?.text ??
    q.forms[0]?.text ??
    "";
  return { slot: "qword", given, expected: full, rule: "elide.consonant" };
}

// GS 5.3, Joining: an elided form joins what follows with no space, everything else
// with one space, and the first letter is capitalised. Words are the tiles' texts in
// order: [prep?] [qword form] [body].
export function joinQuestion(words: readonly string[]): string {
  const text = words
    .filter((w) => w !== "")
    .reduce(
      (joined, w) => (joined === "" || joined.endsWith("'") ? joined + w : `${joined} ${w}`),
      "",
    );
  return text.charAt(0).toUpperCase() + text.slice(1);
}
