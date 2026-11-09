// Chi è stato? GS 9.1, Level 2: the builder's tiles, the question its slots make,
// and the feedback for each GS 3.2 rule.
import { describe, expect, test } from "vitest";
import { renderMessage } from "../../ui/messages.ts";
import { content } from "../content/index.ts";
import { genderOf } from "./ask.ts";
import { builderTiles, builtOf, feedbackFor, previewOf, withWord, type Draft } from "./builder.ts";
import { caseById, start } from "./start.ts";
import { step } from "./step.ts";
import { engineContent } from "./testing.ts";
import type { Built } from "./types.ts";

const fresh = () => start(7, "case.torta", 2, engineContent);
const role = "r.witness";
const prep = (text: string) => `prep.${text}`;

// Builds from tile texts, as the learner taps them, and asks.
function ask(draft: Draft, to = role) {
  const built = builtOf(draft, to, engineContent);
  if ("missing" in built) throw new Error(`missing ${built.missing}`);
  const { events } = step(fresh(), { type: "ASK", built }, engineContent);
  return { built, events };
}
// The feedback as the learner reads it, with the italics' asterisks.
function said(draft: Draft) {
  const { built, events } = ask(draft);
  return feedbackFor(built, events, engineContent).map((f) =>
    renderMessage(content.messages, f.messageKey, f.params)
      .map((s) => (s.italic ? `*${s.text}*` : s.text))
      .join(""),
  );
}

describe("builderTiles", () => {
  const tiles = builderTiles(fresh(), role, engineContent);

  test("every form of GS 3.1 is a tile, once, with qual' and without che ora", () => {
    expect(tiles.forms).toEqual([
      "chi",
      "che cosa",
      "cosa",
      "cos'",
      "che",
      "dove",
      "dov'",
      "quando",
      "perché",
      "come",
      "com'",
      "quale",
      "quali",
      "qual",
      "qual'",
      "quanto",
      "quanta",
      "quanti",
      "quante",
      "quant'",
    ]);
    expect(tiles.words).toEqual(["ora"]);
    expect(tiles.preps.map((p) => p.text)).toEqual(["con", "di", "a", "da"]);
  });

  test("the bodies are the case's frames, for the gender of the person asked", () => {
    const state = fresh();
    for (const r of Object.keys(state.cast)) {
      const bodies = builderTiles(state, r, engineContent).bodies;
      expect(bodies.map((b) => b.frame)).toEqual(caseById(engineContent, state.caseId).frames);
      const arrive = bodies.find((b) => b.frame === "f.arrive")?.text;
      expect(arrive).toBe(
        genderOf(state, r, engineContent) === "f"
          ? "è arrivata alla villa"
          : "è arrivato alla villa",
      );
    }
    const at = tiles.bodies.find((b) => b.frame === "f.at.slot");
    expect(at).toEqual({ frame: "f.at.slot", text: "era …", slotParam: true });
    expect(tiles.bodies.find((b) => b.frame === "f.from")?.slotParam).toBe(false);
    expect(tiles.slots).toEqual([
      "tra le sette e le otto",
      "tra le otto e le nove",
      "tra le nove e le dieci",
    ]);
  });
});

describe("withWord", () => {
  test("ora goes after che only", () => {
    expect(withWord("che", "ora", engineContent)).toBe("che ora");
    expect(withWord("chi", "ora", engineContent)).toBeUndefined();
    expect(withWord(undefined, "ora", engineContent)).toBeUndefined();
  });
});

describe("builtOf", () => {
  test("names the first empty slot", () => {
    expect(builtOf({}, role, engineContent)).toEqual({ missing: "qword" });
    expect(builtOf({ form: "dov'" }, role, engineContent)).toEqual({ missing: "body" });
    expect(builtOf({ form: "dov'", frame: "f.at.slot" }, role, engineContent)).toEqual({
      missing: "slot",
    });
  });

  test("the preposition picks the lemma, and a slot the body doesn't take is dropped", () => {
    expect(
      builtOf(
        { prep: prep("di"), form: "chi", frame: "f.owner.umbrella", slot: 1 },
        role,
        engineContent,
      ),
    ).toEqual({
      prep: "prep.di",
      qword: "q.di_chi",
      form: "chi",
      frame: "f.owner.umbrella",
      to: role,
    } satisfies Built);
    expect(builtOf({ form: "chi", frame: "f.saw.slot", slot: 0 }, role, engineContent)).toEqual({
      qword: "q.chi",
      form: "chi",
      frame: "f.saw.slot",
      slot: 0,
      to: role,
    } satisfies Built);
  });
});

describe("previewOf", () => {
  const preview = (draft: Draft) => previewOf(fresh(), draft, role, engineContent);
  test("joins as the engine does, with … for what's still open", () => {
    expect(preview({})).toBe("");
    expect(preview({ form: "dov'" })).toBe("Dov'…?");
    expect(preview({ form: "dov'", frame: "f.at.slot" })).toBe("Dov'era …?");
    expect(preview({ form: "dov'", frame: "f.at.slot", slot: 1 })).toBe(
      "Dov'era tra le otto e le nove?",
    );
    expect(preview({ prep: prep("a"), form: "che ora", frame: "f.arrive" })).toMatch(
      /^A che ora è arrivat[ao] alla villa\?$/,
    );
    expect(preview({ frame: "f.from" })).toBe("… viene?");
  });
});

describe("feedbackFor: every GS 3.2 rule says its message", () => {
  test("agree.quanto: a slip, accepted, naming the noun and the form", () => {
    const { events } = ask({ form: "quanti", frame: "f.people.cucina.slot", slot: 1 });
    expect(events[0]?.type).toBe("asked");
    expect(said({ form: "quanti", frame: "f.people.cucina.slot", slot: 1 })).toEqual([
      "*Persone* is feminine plural, so *quante*.",
    ]);
    expect(said({ form: "quanto", frame: "f.age" })).toEqual([
      "*Anni* is masculine plural, so *quanti*.",
    ]);
  });

  test("agree.quale and trunc.qualE: slips", () => {
    expect(said({ form: "quale", frame: "f.shoes" })).toEqual(["*Scarpe* is plural, so *quali*."]);
    expect(said({ form: "qual'", frame: "f.shoes" })).toEqual(["*Scarpe* is plural, so *quali*."]);
    expect(said({ form: "quali", frame: "f.job" })).toEqual(["*Lavoro* is singular, so *qual*."]);
    expect(said({ form: "qual'", frame: "f.job" })).toEqual([
      "*Qual è* never takes an apostrophe.",
    ]);
  });

  test("elide.consonant: rejected, with the full form", () => {
    expect(ask({ form: "dov'", frame: "f.saw.slot", slot: 0 }).events[0]).toMatchObject({
      type: "rejected",
      reason: "grammar",
    });
    expect(said({ form: "dov'", frame: "f.saw.slot", slot: 0 })).toEqual([
      "Use *dove* here: *dov'* only goes before a vowel.",
    ]);
    expect(said({ form: "cos'", frame: "f.doing.slot", slot: 0 })).toEqual([
      "Use *cosa* here: *cos'* only goes before a vowel.",
    ]);
  });

  test("the preposition rules: di chi, a che ora, da dove", () => {
    expect(said({ form: "chi", frame: "f.owner.umbrella" })).toEqual([
      "To ask whose, Italian says *di chi*.",
    ]);
    expect(said({ form: "che ora", frame: "f.arrive" })).toEqual([
      "To ask what time, Italian says *a che ora*.",
    ]);
    expect(said({ form: "dove", frame: "f.from" })).toEqual([
      "To ask where from, Italian says *da dove*.",
    ]);
  });

  test("every problem at once: dov' before viene is two", () => {
    expect(said({ form: "dov'", frame: "f.from" })).toEqual([
      "Use *dove* here: *dov'* only goes before a vowel.",
      "To ask where from, Italian says *da dove*.",
    ]);
  });

  test("prep.conChi and word.choice: nonsense, in Italian", () => {
    expect(said({ form: "chi", frame: "f.at.slot", slot: 1 })).toEqual([
      "*Non capisco la domanda.*",
    ]);
    expect(said({ form: "quanto", frame: "f.arrive" })).toEqual(["*Non capisco la domanda.*"]);
    expect(said({ prep: prep("di"), form: "quando", frame: "f.arrive" })).toEqual([
      "*Non capisco la domanda.*",
    ]);
    // a + che is che, q.cosa, which arrival doesn't ask.
    expect(said({ prep: prep("a"), form: "che", frame: "f.arrive" })).toEqual([
      "*Non capisco la domanda.*",
    ]);
  });

  test("right questions say nothing, and get their answer", () => {
    for (const draft of [
      { prep: prep("di"), form: "chi", frame: "f.owner.umbrella" },
      { prep: prep("a"), form: "che ora", frame: "f.arrive" },
      { prep: prep("da"), form: "dove", frame: "f.from" },
      { prep: prep("con"), form: "chi", frame: "f.at.slot", slot: 1 },
      { form: "dov'", frame: "f.at.slot", slot: 1 },
      { form: "dove", frame: "f.at.slot", slot: 1 }, // unelided is right too (GD5)
      { form: "che", frame: "f.doing.slot", slot: 0 },
      { form: "quante", frame: "f.people.cucina.slot", slot: 2 },
      { form: "qual", frame: "f.job" },
    ] satisfies Draft[]) {
      const { events } = ask(draft);
      expect(events[0]?.type, JSON.stringify(draft)).toBe("asked");
      expect(said(draft), JSON.stringify(draft)).toEqual([]);
    }
  });
});
