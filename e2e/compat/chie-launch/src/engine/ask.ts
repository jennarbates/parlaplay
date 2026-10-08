// Spec 4.3: the player's ASK. Checks run in order and the first failure rejects:
// phase (in step.ts), unknown ids, grammar, meaning, duplicate.
import type { Adjective, Noun, Template } from "../content/schemas.ts";
import { formKeyFor, parseAdjRef, type FormKey, type Index } from "./content.ts";
import { evaluate, keyOf, meaningFor, type Meaning } from "./meaning.ts";
import { rate, type Rated } from "./ratings.ts";
import { renderAnswer, renderQuestion } from "./render.ts";
import type {
  Feedback,
  Fill,
  GameEvent,
  GameState,
  RejectReason,
  SlotError,
  StepResult,
} from "./types.ts";

type Resolved = {
  template: Template;
  noun: Noun;
  verbText: string;
  artText: string;
  adj?: { lemma: Adjective; formKey: FormKey };
};

const genderNumber: Record<FormKey, string> = {
  ms: "masculine singular",
  fs: "feminine singular",
  mp: "masculine plural",
  fp: "feminine plural",
};

const attrNames: Record<string, string> = {
  hairColor: "hair color",
  hairLength: "hair length",
  eyeColor: "eye color",
};

export function ask(state: GameState, templateId: string, fill: Fill, index: Index): StepResult {
  const resolved = resolve(templateId, fill, index);
  if (!resolved) return reject(state, "unknownId");
  const { template, noun, adj } = resolved;
  const level2 = state.level === 2;

  // 3. Grammar. Verb and article errors reject; a wrong adjective form only slips,
  // but is still reported alongside them so feedback shows every problem at once.
  const expectedVerb = index.verb.get(template.verb);
  const expectedArtId = template.article === "def" ? noun.defArt : noun.indefArt;
  const expectedArt = expectedArtId ? index.article.get(expectedArtId) : undefined;
  if (!expectedVerb || !expectedArt) return reject(state, "unknownId");

  const errors: SlotError[] = [];
  if (fill.verb !== expectedVerb.id) {
    errors.push({
      slot: "verb",
      given: resolved.verbText,
      expected: expectedVerb.text,
      rule: template.verb === "v.ha" ? "verb.avere" : "verb.essere",
    });
  }
  if (fill.art !== expectedArt.id) {
    errors.push({
      slot: "art",
      given: resolved.artText,
      expected: expectedArt.text,
      rule: noun.artRule,
    });
  }
  const formKey = formKeyFor(noun);
  const slip: SlotError | undefined =
    adj && adj.lemma.forms[adj.formKey] !== adj.lemma.forms[formKey]
      ? {
          slot: "adj",
          given: adj.lemma.forms[adj.formKey],
          expected: adj.lemma.forms[formKey],
          rule: "agreement",
        }
      : undefined;

  if (errors.length) {
    const all = slip ? [...errors, slip] : errors;
    const feedback = all.map((e) => feedbackFor(e, noun, expectedArt.text));
    const rated = level2
      ? rate(
          { events: [], ratedThisTurn: state.ratedThisTurn },
          noun.id,
          "produce",
          "again",
          errors[0],
        )
      : { events: [], ratedThisTurn: state.ratedThisTurn };
    return reject(state, "grammar", all, feedback, rated);
  }

  // 4. Meaning.
  let meaning: Meaning | undefined;
  if (adj) {
    meaning = meaningFor(adj.lemma, noun);
    if (!meaning) {
      const choice = adj.lemma.wordChoice?.find((w) => w.noun === noun.id);
      const use = choice && index.adj.get(choice.use);
      const feedback: Feedback = use
        ? [
            {
              messageKey: "meaning.wordChoice",
              params: { noun: noun.text, use: use.forms[formKey] },
            },
          ]
        : [
            {
              messageKey: "meaning.mismatch",
              params: {
                noun: noun.text,
                given: adj.lemma.forms[formKey],
                allowed: (noun.adjAttrs ?? []).map((a) => attrNames[a] ?? a).join(" or "),
              },
            },
          ];
      return reject(state, "nonsense", undefined, feedback);
    }
  }

  // 5. Duplicate: the player already asked this (castani and marroni eyes share a key).
  const asked = { template, noun, ...(meaning && { meaning }) };
  const key = keyOf(asked);
  const previous = state.history.find((h) => h.by === "player" && h.key === key);
  if (previous) {
    return reject(state, "duplicate", undefined, [
      { messageKey: "duplicate", params: { answerText: previous.answerText } },
    ]);
  }

  // Accepted: answer truthfully about cpuSecret, rendered with the correct form.
  const cpuSecret = index.character.get(state.cpuSecret);
  if (!cpuSecret) throw new Error(`Unknown cpuSecret ${state.cpuSecret}`);
  const answer = evaluate(asked, cpuSecret.attrs);
  const corrected = adj ? { ...fill, adj: `${adj.lemma.id}#${formKey}` } : fill;
  const text = renderQuestion(template, corrected, index);
  const answerText = renderAnswer(text, answer);

  let rated: Rated = {
    events: [{ type: "asked", by: "player", key, answer }],
    ratedThisTurn: state.ratedThisTurn,
  };
  let feedback: Feedback | undefined;
  if (level2) {
    rated = rate(rated, noun.id, "produce", "good");
    if (adj && slip) {
      rated = {
        ...rated,
        events: [
          ...rated.events,
          {
            type: "agreementSlip",
            lexiconId: adj.lemma.id,
            given: slip.given,
            expected: slip.expected,
          },
        ],
      };
      feedback = [feedbackFor(slip, noun, expectedArt.text)];
    } else if (adj) {
      rated = rate(rated, adj.lemma.id, "produce", "good");
    }
  }

  return {
    state: {
      ...state,
      phase: "playerReview",
      history: [...state.history, { by: "player", key, text, answer, answerText }],
      ratedThisTurn: rated.ratedThisTurn,
      lastFeedback: feedback,
    },
    events: rated.events,
  };
}

// Step 2: every id exists and the payload fits the noun's template.
function resolve(templateId: string, fill: Fill, index: Index): Resolved | undefined {
  const template = index.template.get(templateId);
  const noun = index.noun.get(fill.noun);
  const verb = index.verb.get(fill.verb);
  const art = index.article.get(fill.art);
  if (!template || !noun || !verb || !art || noun.template !== template.id) return undefined;
  if (!template.needsAdj)
    return fill.adj === undefined
      ? { template, noun, verbText: verb.text, artText: art.text }
      : undefined;
  const ref = fill.adj ? parseAdjRef(fill.adj) : undefined;
  const lemma = ref && index.adj.get(ref.lemmaId);
  if (!ref || !lemma) return undefined;
  return {
    template,
    noun,
    verbText: verb.text,
    artText: art.text,
    adj: { lemma, formKey: ref.formKey },
  };
}

function feedbackFor(error: SlotError, noun: Noun, expectedArt: string): Feedback[number] {
  if (error.slot === "verb")
    return { messageKey: error.rule, params: { art: expectedArt, noun: noun.text } };
  if (error.slot === "adj") {
    return {
      messageKey: "agreement",
      params: {
        expected: error.expected,
        given: error.given,
        noun: noun.text,
        genderNumber: genderNumber[formKeyFor(noun)],
      },
    };
  }
  return { messageKey: error.rule, params: { noun: noun.text } };
}

// Spec 4.4 invariant 4: a rejection changes nothing but lastFeedback and ratedThisTurn.
export function reject(
  state: GameState,
  reason: RejectReason,
  errors?: SlotError[],
  feedback?: Feedback,
  rated?: Rated,
): StepResult {
  const event: GameEvent = { type: "rejected", reason, ...(errors && { errors }) };
  return {
    state: {
      ...state,
      ...(feedback && { lastFeedback: feedback }),
      ...(rated && { ratedThisTurn: rated.ratedThisTurn }),
    },
    events: [event, ...(rated?.events ?? [])],
  };
}
