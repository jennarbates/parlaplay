// Chi è stato? GS 4.3: which answer a question gets, and its text once the
// variant's names, job, hiding place and crime slot are filled in. Pure: no React,
// DOM or time (GS 5).
import type { Answer, Case, Frame } from "../content/schemas.ts";

export type Gender = "m" | "f";

// One way a case can play out: the seed picks a hiding room and a crime slot, and
// gives each suspect a job (GS 4.3, Seeded variants).
export type Variant = {
  hide: number; // index into case.rooms
  crime: number; // index into case.slots
  jobs: Record<string, string>; // suspect role → job id
};

// A question to one person: [prep?] [qword] [frame body], about a slot if the
// frame takes one.
export type Question = { to: string; frame: string; slot?: number; qword: string };

// GS 4.3: an answer's key, "who:frame:slot:qword", with "-" for no slot. Proofs and
// contradictions name answers by it.
export const answerKey = (a: Pick<Answer, "who" | "frame" | "slot" | "qword">): string =>
  `${a.who}:${a.frame}:${a.slot ?? "-"}:${a.qword}`;

// GS 4.3, Lookup: the first answer whose who is the person's role, then their job,
// then "*". undefined means the case's default.
export function lookup(c: Case, v: Variant, q: Question): Answer | undefined {
  const slot = q.slot === undefined ? undefined : q.slot === v.crime ? "crime" : "other";
  const fits = c.answers.filter(
    (a) => a.frame === q.frame && a.qword === q.qword && a.slot === slot,
  );
  const job = v.jobs[q.to];
  for (const who of [q.to, ...(job ? [job] : []), "*"]) {
    const answer = fits.find((a) => a.who === who);
    if (answer) return answer;
  }
  return undefined;
}

// Every question the case can be asked: each person, each of the case's frames,
// each question word it accepts, and each slot when the frame takes one.
export function allQuestions(c: Case, frames: readonly Frame[]): Question[] {
  const byId = new Map(frames.map((f) => [f.id, f]));
  return c.roles.flatMap((to) =>
    c.frames.flatMap((id) => {
      const frame = byId.get(id);
      if (!frame) return [];
      const slots = frame.slotParam ? c.slots.map((_, i) => i) : [undefined];
      return frame.asks.flatMap(({ qword }) =>
        slots.map((slot): Question => ({
          to,
          frame: id,
          qword,
          ...(slot !== undefined && { slot }),
        })),
      );
    }),
  );
}

// What fills an answer's placeholders: each role's name, the speaker's gender and job.
export type Speaker = { names: Record<string, string>; gender: Gender; job: string };

// GS 4.3, Placeholders: {r.*} a role's name, {job} the speaker's job, {hide} the
// hiding room's "in" form, {crime} the crime slot. Anything else is left as it is,
// for the invariants to find.
export function fill(c: Case, v: Variant, text: Answer["text"], s: Speaker): string {
  const raw = typeof text === "string" ? text : text[s.gender];
  return raw.replace(/\{([^}]+)\}/g, (whole, name: string) => {
    if (name === "job") return s.job;
    if (name === "hide") return c.rooms[v.hide]?.in ?? whole;
    if (name === "crime") return c.slots[v.crime] ?? whole;
    return s.names[name] ?? whole;
  });
}

// A job's text for a gender; the witness has the case's witnessJob instead.
export function jobText(c: Case, v: Variant, role: string, gender: Gender): string {
  const job = c.jobs.find((j) => j.id === v.jobs[role])?.text ?? c.witnessJob;
  return typeof job === "string" ? job : job[gender];
}
