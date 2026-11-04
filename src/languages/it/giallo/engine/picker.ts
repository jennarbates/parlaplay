// Chi è stato? GS 9.1: what the Level 1 picker offers one person. Every question the
// case can ask them, grouped by question word in lexicon order, as the learner would
// build it, so the picker's questions go through the same step() as the builder's.
import { allQuestions } from "./answers.ts";
import { questionFor, sameQuestion, tileText } from "./ask.ts";
import { builtFor, joinQuestion, withSlotEn } from "./question.ts";
import { caseById } from "./start.ts";
import type { Built, CaseState, EngineContent, NotebookEntry } from "./types.ts";

export type PickerQuestion = {
  key: string;
  built: Built;
  text: string; // "Dov'era tra le otto e le nove?"
  hint: string; // "Where were you between eight and nine?"
  asked?: NotebookEntry; // the earlier answer, once asked
};

export type PickerGroup = {
  qword: string;
  label: string; // "Con chi"
  questions: PickerQuestion[];
};

// A question word as a heading: "Con chi".
export function qwordLabel(id: string, content: EngineContent): string {
  const entry = content.lexicon.find((x) => x.id === id);
  if (entry?.pos !== "qword") return "";
  return joinQuestion([tileText(entry.prep, content), entry.forms[0]?.text ?? ""]);
}

export function pickerGroups(
  state: CaseState,
  role: string,
  content: EngineContent,
): PickerGroup[] {
  const c = caseById(content, state.caseId);
  const questions = allQuestions(c, content.frames).filter((q) => q.to === role);
  return content.lexicon.flatMap((entry) => {
    if (entry.pos !== "qword") return [];
    const mine = questions.filter((q) => q.qword === entry.id);
    if (mine.length === 0) return [];
    const group: PickerGroup = {
      qword: entry.id,
      label: qwordLabel(entry.id, content),
      questions: mine.map((q) => {
        const built = builtFor(q, content.frames, content.lexicon);
        const asks = content.frames
          .find((f) => f.id === q.frame)
          ?.asks.find((a) => a.qword === q.qword);
        const asked = state.notebook.find((e) => sameQuestion(e.built, built));
        return {
          key: `${q.to}|${q.frame}|${q.slot ?? "-"}|${q.qword}`,
          built,
          text: questionFor(state, built, content),
          hint: withSlotEn(asks?.hint ?? "", q.slot),
          ...(asked && { asked }),
        };
      }),
    };
    return [group];
  });
}
