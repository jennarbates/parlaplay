// Chi è stato? GS 3 and GS 4: the giallo's content is complete and every id it
// refers to exists. The case logic (lies, proofs, a 10-question solution) is
// checked by the solver's invariants (GS 5.4), not here.
import { describe, expect, test } from "vitest";
import { allIds, content, missingReleasedIds, releasedIds } from "./index.ts";
import { Answer, Case, contentFiles, Frame, QWord, type Frame as FrameT } from "./schemas.ts";
import { allIds as chieIds, content as chieContent } from "../../content/index.ts";
import { content as zhContent } from "../../../zh/content/index.ts";

const { lexicon, frames, cases, messages } = content;
const qwords = lexicon.filter((e) => e.pos === "qword");
const byId = new Map(lexicon.map((e) => [e.id, e]));
const frameById = new Map(frames.map((f) => [f.id, f]));

describe("lexicon (GS 3.1, GS 4.1)", () => {
  test("has the 12 question words, the 4 prepositions and ora", () => {
    expect(qwords.map((q) => q.id)).toEqual([
      "q.chi",
      "q.cosa",
      "q.dove",
      "q.quando",
      "q.perche",
      "q.come",
      "q.quale",
      "q.quanto",
      "q.con_chi",
      "q.di_chi",
      "q.a_che_ora",
      "q.da_dove",
    ]);
    expect(lexicon.filter((e) => e.pos === "prep").map((e) => e.text)).toEqual([
      "con",
      "di",
      "a",
      "da",
    ]);
    expect(lexicon.filter((e) => e.pos === "word").map((e) => e.text)).toEqual(["ora"]);
  });

  test("the forms are the tile texts of GS 3.1", () => {
    const texts = Object.fromEntries(qwords.map((q) => [q.id, q.forms.map((f) => f.text)]));
    expect(texts["q.cosa"]).toEqual(["che cosa", "cosa", "cos'", "che"]);
    expect(texts["q.quale"]).toEqual(["quale", "quali", "qual", "qual'"]);
    expect(texts["q.quanto"]).toEqual(["quanto", "quanta", "quanti", "quante", "quant'"]);
  });

  test("elided forms end in an apostrophe, and only qual' is a distractor", () => {
    for (const q of qwords)
      for (const f of q.forms) {
        if (f.elided) expect(f.text, f.text).toMatch(/'$/);
        expect(!!f.distractor, f.text).toBe(f.text === "qual'");
      }
  });

  test("a word's preposition is a preposition", () => {
    for (const q of qwords.filter((q) => q.prep))
      expect(byId.get(q.prep ?? "")?.pos, q.id).toBe("prep");
    expect(qwords.filter((q) => q.prep).map((q) => q.id)).toEqual([
      "q.con_chi",
      "q.di_chi",
      "q.a_che_ora",
      "q.da_dove",
    ]);
  });
});

describe("frames (GS 4.2)", () => {
  test("every frame of GS 4.2 is there", () => {
    expect(frames.map((f) => f.id)).toEqual([
      "f.at.slot",
      "f.doing.slot",
      "f.saw.slot",
      "f.arrive",
      "f.stolen.torta",
      "f.from",
      "f.job",
      "f.shoes",
      "f.people.cucina.slot",
      "f.age",
      "f.time.garden",
      "f.cake",
      "f.owner.umbrella",
      "f.owner.keys",
    ]);
  });

  test.each(frames.map((f) => [f.id, f] as const))("%s refers only to what exists", (_, f) => {
    for (const { qword } of f.asks) expect(byId.get(qword)?.pos, qword).toBe("qword");
    for (const { built, rule } of f.teaches ?? []) {
      expect(byId.get(built)?.pos, built).toBe("qword");
      expect(messages[rule], rule).toBeDefined();
    }
  });

  test.each(frames.map((f) => [f.id, f] as const))("%s is consistent with its body", (_, f) => {
    for (const body of [f.body.m, f.body.f]) {
      expect(/^[aeiouèé]/i.test(body), body).toBe(f.vowelStart);
      expect(body.includes("{slot}"), body).toBe(f.slotParam);
      expect(body, body).toMatch(/\?$/);
    }
    expect(new Set(f.asks.map((a) => a.qword)).size).toBe(f.asks.length);
  });

  test("quanto and quale have a form for every noun they ask about", () => {
    const keyFor = (f: FrameT, qword: string) =>
      qword === "q.quanto"
        ? `${f.noun?.gender}${f.noun?.number === "sg" ? "s" : "p"}`
        : f.noun?.number === "sg"
          ? f.body.m.startsWith("è")
            ? "trunc" // qual è
            : "sg"
          : "pl";
    for (const f of frames)
      for (const { qword } of f.asks.filter((a) => ["q.quanto", "q.quale"].includes(a.qword))) {
        expect(f.noun, f.id).toBeDefined();
        const q = byId.get(qword);
        const keys = q?.pos === "qword" ? q.forms.map((x) => x.key) : [];
        expect(keys, f.id).toContain(keyFor(f, qword));
      }
  });
});

describe("cases (GS 4.3)", () => {
  test.each(cases.map((c) => [c.id, c] as const))("%s refers only to what exists", (_, c) => {
    const roles = new Set(c.roles);
    const jobs = new Set(c.jobs.map((j) => j.id));
    const rooms = new Set(c.rooms.map((r) => r.id));
    const caseFrames = new Set(c.frames);

    for (const s of c.suspects) expect(roles.has(s), s).toBe(true);
    expect(c.jobs).toHaveLength(c.suspects.length);
    for (const r of c.hidePlaces) expect(rooms.has(r), r).toBe(true);
    for (const f of [...c.frames, ...c.evidence]) expect(frameById.has(f), f).toBe(true);
    for (const f of c.evidence) expect(caseFrames.has(f), f).toBe(true);

    const keys = new Set(c.answers.map((a) => `${a.who}:${a.frame}:${a.slot ?? "-"}:${a.qword}`));
    expect(keys.size, "answer keys are unique").toBe(c.answers.length);
    for (const a of c.answers) {
      const key = `${a.who}:${a.frame}:${a.slot ?? "-"}:${a.qword}`;
      expect(a.who === "*" || roles.has(a.who) || jobs.has(a.who), key).toBe(true);
      expect(caseFrames.has(a.frame), key).toBe(true);
      const frame = frameById.get(a.frame);
      expect(
        frame?.asks.map((x) => x.qword),
        key,
      ).toContain(a.qword);
      expect(a.slot !== undefined, key).toBe(frame?.slotParam);
      for (const other of [
        ...(a.contradictedBy ?? []),
        ...(a.proves ?? []).flatMap((p) => p.requires ?? []),
      ])
        expect(keys.has(other), `${key} → ${other}`).toBe(true);
      for (const p of a.proves ?? []) if (p.kind === "clears") expect(roles.has(p.role)).toBe(true);
    }
  });
});

describe("messages (GS 3.2)", () => {
  test("every rule with feedback has a message", () => {
    for (const rule of [
      "agree.quanto",
      "agree.quale",
      "trunc.qualE",
      "elide.consonant",
      "prep.diChi",
      "prep.aCheOra",
      "prep.daDove",
      "nonsense",
    ])
      expect(messages[rule], rule).toBeDefined();
  });
});

describe("ids (GS 4.4)", () => {
  test("are unique within the giallo", () => {
    expect(new Set(allIds(content)).size).toBe(allIds(content).length);
  });

  test("are disjoint from Chi è?'s and Shéi's (platform spec 3.4.3)", () => {
    const others = new Set([...chieIds(chieContent), ...zhContent.lexicon.map((e) => e.id)]);
    expect(allIds(content).filter((id) => others.has(id))).toEqual([]);
  });

  test("released-ids.json lists every giallo id, and none is missing", () => {
    expect([...releasedIds].sort()).toEqual([...allIds(content)].sort());
    expect(missingReleasedIds(releasedIds, content)).toEqual([]);
  });
});

describe("schemas are strict (GS 4)", () => {
  const qword = qwords[0];
  const frame = frames[0];
  const theCase = cases[0];
  if (!qword || !frame || !theCase) throw new Error("no content");

  test("the real files pass", () => {
    for (const [file, schema] of Object.entries(contentFiles)) {
      const data = { "lexicon.json": lexicon, "frames.json": frames, "cases.json": cases }[file];
      if (data) expect(schema.safeParse(data).success, file).toBe(true);
    }
  });

  test("a misspelled key fails", () => {
    expect(QWord.safeParse({ ...qword, glos: "x" }).success).toBe(false);
    expect(Frame.safeParse({ ...frame, vowelstart: true }).success).toBe(false);
    expect(Case.safeParse({ ...theCase, titel: "x" }).success).toBe(false);
  });

  test("a lie without contradictedBy fails", () => {
    const lie = { who: "r.culprit", frame: "f.at.slot", slot: "crime", qword: "q.dove" };
    expect(Answer.safeParse({ ...lie, text: "Ero in cucina.", lie: true }).success).toBe(false);
    expect(
      Answer.safeParse({ ...lie, text: "Ero in cucina.", lie: true, contradictedBy: ["k"] })
        .success,
    ).toBe(true);
  });

  test("a case needs exactly three slots, and ids keep their prefixes", () => {
    expect(Case.safeParse({ ...theCase, slots: theCase.slots.slice(0, 2) }).success).toBe(false);
    expect(QWord.safeParse({ ...qword, id: "chi" }).success).toBe(false);
  });
});
