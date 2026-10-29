// Chi è stato? GS 6: Ispettrice Bassi's questions, after every 4th accepted
// question. She asks again a question already in the notebook, about the person
// in the third person, with three options from the notebook: a place, a time or
// companion, and a thing or person. She skips her turn when the notebook cannot
// answer any question.
import { pickOne, seeded, shuffled } from "../../engine/random.ts";
import type { Frame } from "../content/schemas.ts";
import { caseById } from "./start.ts";
import type { CaseState, EngineContent, InspectorQuestion, NotebookEntry } from "./types.ts";

export const inspectorEvery = 4;

export type AskInspector = (
  state: CaseState,
  content: EngineContent,
) => InspectorQuestion | undefined;

// The three kinds of answer, by the question word that asked for them. Choosing
// needs the question word, not the content. Other question words are not asked.
export const kinds: readonly (readonly string[])[] = [
  ["q.dove", "q.da_dove"], // a place
  ["q.quando", "q.a_che_ora", "q.con_chi"], // a time or companion
  ["q.cosa", "q.chi", "q.di_chi"], // a thing or person
];

const kindOf = (qword: string) => kinds.findIndex((k) => k.includes(qword));

// The question, as the inspector says it: [prep] [form] [body], with the person's
// name after the body's first nameAt words, or "Secondo {name}, …" without it.
// An elided form joins the body with no space (GS 5.3, Joining).
export function inspectorText(
  entry: NotebookEntry,
  frame: Frame,
  state: CaseState,
  content: EngineContent,
): string {
  const c = caseById(content, state.caseId);
  const { built } = entry;
  const person = content.characters.find((x) => x.id === state.cast[built.to]);
  const name = person?.name ?? built.to;
  const qword = content.lexicon.find((x) => x.id === built.qword);
  const prep = content.lexicon.find((x) => x.id === (qword?.pos === "qword" && qword.prep));
  const forms = qword?.pos === "qword" ? qword.forms.filter((f) => !f.distractor) : [];
  const form =
    (frame.vowelStart ? forms.find((f) => f.elided) : undefined) ??
    forms.find((f) => !f.elided) ??
    forms[0];

  const slot = built.slot === undefined ? "" : (c.slots[built.slot] ?? "");
  const words = frame.body[person?.attrs.gender === "n.donna" ? "f" : "m"]
    .replace("{slot}", slot)
    .replace(/\?$/, "")
    .split(" ");
  if (frame.nameAt !== undefined) words.splice(frame.nameAt, 0, name);
  const body = `${words.join(" ")}?`;

  const start = [prep?.pos === "prep" ? prep.text : undefined, form?.text]
    .filter(Boolean)
    .join(" ");
  const question = form?.elided ? `${start}${body}` : `${start} ${body}`;
  if (frame.nameAt === undefined) return `Secondo ${name}, ${question}`;
  return question.charAt(0).toUpperCase() + question.slice(1);
}

export const inspectorQuestion: AskInspector = (state, content) => {
  // Only real answers: the case's default ("Non lo so.") answers nothing.
  const answered = state.notebook.filter((e) => e.key !== null && kindOf(e.built.qword) >= 0);
  const textsOf = (kind: number, except: readonly string[]) => [
    ...new Set(
      answered
        .filter((e) => kindOf(e.built.qword) === kind && !except.includes(e.answer))
        .map((e) => e.answer),
    ),
  ];
  // She can ask about an entry when the notebook has an answer of each other kind.
  const askable = answered.filter((entry) =>
    kinds.every((_, k) => k === kindOf(entry.built.qword) || textsOf(k, [entry.answer]).length),
  );
  if (!askable.length) return undefined;

  const random = seeded(state.seed + state.notebook.length);
  const entry = pickOne(random, askable);
  const frame = content.frames.find((f) => f.id === entry.built.frame);
  if (!frame) return undefined;
  // One option of each kind, each with a text of its own.
  const options = [entry.answer];
  for (const k of kinds.keys()) {
    if (k === kindOf(entry.built.qword)) continue;
    const texts = textsOf(k, options);
    if (!texts.length) return undefined;
    options.push(pickOne(random, texts));
  }
  return {
    qword: entry.built.qword,
    text: inspectorText(entry, frame, state, content),
    options: shuffled(random, options),
    answer: entry.answer,
  };
};
