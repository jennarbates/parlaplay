// Spec 4.3: the player's ASK. Checks run in order and the first failure rejects:
// phase (in step.ts), unknown ids, shape, grammar (every error collected), off
// board, duplicate. Level 1 builds its tokens from the picker, so it always
// passes steps 3 to 5.
import type { LexiconEntry, Noun, Pronoun, Verb } from "../content/schemas.ts";
import { he, indexContent, ma, need, she } from "./content.ts";
import { evaluate, questionKey } from "./predicate.ts";
import { rate, type Rated } from "./ratings.ts";
import { renderAnswer, renderQuestion, tokensText } from "./render.ts";
import type {
  EngineContent,
  Feedback,
  GameEvent,
  GameState,
  RejectReason,
  ShapeError,
  SlotError,
  StepResult,
} from "./types.ts";

type Token = Extract<LexiconEntry, { pos: "pronoun" | "verb" | "noun" | "particle" }>;
const kinds = ["pronoun", "verb", "noun", "particle"] as const;

const genderOf = { "n.nande": "m", "n.nvde": "f" } as const;
const genderQuestions = [questionKey("v.shi", "n.nande"), questionKey("v.shi", "n.nvde")];

export function ask(state: GameState, tokenIds: string[], content: EngineContent): StepResult {
  const index = indexContent(content);
  const level2 = state.level === 2;

  // 2. Every token is a known pronoun, verb, noun or particle.
  const tokens: Token[] = [];
  for (const id of tokenIds) {
    const e = index.entry.get(id);
    if (!e || !(kinds as readonly string[]).includes(e.pos)) return reject(state, "unknownId");
    tokens.push(e as Token);
  }

  // 3. Shape: one of each kind and at most one 吗. Nothing logged.
  const shape = shapeError(tokens);
  if (shape) {
    return reject(state, "shape", {
      shape,
      feedback: [{ messageKey: `shape.${shape.kind}`, params: {} }],
    });
  }
  const pron = tokens.find((t): t is Pronoun => t.pos === "pronoun") as Pronoun;
  const verb = tokens.find((t): t is Verb => t.pos === "verb") as Verb;
  const noun = tokens.find((t): t is Noun => t.pos === "noun") as Noun;
  const hasMa = tokens.some((t) => t.id === ma);

  // 4. Grammar. The correct question keeps the player's pronoun, except 你.
  const fixedPron = pron.gender ? pron.id : he;
  const expectedVerb = need(index.verb, noun.verb);
  const correct = renderQuestion(content, fixedPron, noun.verb, noun.id).hanzi;
  const given = tokensText(content, tokenIds);
  const errors: SlotError[] = [];
  if (!pron.gender)
    errors.push({ slot: "pron", given: pron.hanzi, expected: "他 / 她", rule: "gp.pron.you" });
  if (verb.id !== noun.verb && !noun.offBoardVerbs?.includes(verb.id as Noun["verb"]))
    errors.push({
      slot: "verb",
      given: verb.hanzi,
      expected: expectedVerb.hanzi,
      rule: `verb.${noun.verb.slice(2)}`,
    });
  if (!hasMa) errors.push({ slot: "ma", given, expected: correct, rule: "gp.ma" });
  const order = tokens.map((t) => t.pos).join();
  const wanted = ["pronoun", "verb", "noun", ...(hasMa ? ["particle"] : [])].join();
  if (order !== wanted) errors.push({ slot: "order", given, expected: correct, rule: "gp.order" });

  if (errors.length) {
    let rated: Rated = { events: [], ratedThisTurn: state.ratedThisTurn };
    for (const e of errors) {
      if (e.slot === "verb") {
        if (level2) rated = rate(rated, noun.id, "produce", "again", e);
      } else {
        rated = slip(rated, e.rule, e.given, e.expected);
      }
    }
    const objParams = { pron: need(index.pronoun, fixedPron).hanzi, obj: noun.hanzi };
    const feedback: Feedback = errors.map((e) => {
      const params: Record<string, string> =
        e.slot === "verb" ? objParams : e.slot === "order" ? { expected: e.expected } : {};
      return { messageKey: e.rule, params };
    });
    return reject(state, "grammar", { errors, feedback, rated });
  }

  // 5. Off board: real Chinese the board can't answer (D11). Nothing logged.
  if (noun.offBoardVerbs?.includes(verb.id as Noun["verb"])) {
    return reject(state, "offBoard", {
      feedback: [
        {
          messageKey: "offBoard.youJob",
          params: { given: `${given}？`, gloss: noun.gloss, pron: pron.hanzi, obj: noun.hanzi },
        },
      ],
    });
  }

  // 6. Duplicate, with either pronoun.
  const key = questionKey(verb.id, noun.id);
  const previous = state.history.find((h) => h.by === "player" && h.key === key);
  if (previous) {
    return reject(state, "duplicate", {
      feedback: [{ messageKey: "duplicate", params: { answerText: previous.answerText } }],
    });
  }

  // Accepted: answer truthfully about cpuSecret, with the player's pronoun.
  const secret = need(index.character, state.cpuSecret);
  const answer = evaluate(noun, secret.attrs);
  const text = renderQuestion(content, pron.id, verb.id, noun.id).hanzi;
  const answerText = renderAnswer(content, pron.id, verb.id, noun.id, answer).hanzi;

  let rated: Rated = {
    events: [{ type: "asked", by: "player", key, answer }],
    ratedThisTurn: state.ratedThisTurn,
  };
  if (level2) rated = rate(rated, noun.id, "produce", "good");

  // The soft check (D7): once a gender question has been asked, the pronoun
  // should match. At both levels, because the Level 1 switch is a real choice.
  let feedback: Feedback | undefined;
  const genderKnown = state.history.some(
    (h) => h.by === "player" && genderQuestions.includes(h.key),
  );
  const secretGender = genderOf[secret.attrs.gender];
  if (genderKnown && pron.gender !== secretGender) {
    const expected = need(index.pronoun, secretGender === "m" ? he : she).hanzi;
    rated = slip(rated, "gp.pron.gender", pron.hanzi, expected);
    feedback = [
      {
        messageKey: "gp.pron.gender",
        params: { genderGloss: secretGender === "m" ? "a man" : "a woman", expected },
      },
    ];
  }

  return {
    state: {
      ...state,
      phase: "playerReview",
      history: [...state.history, { by: "player", key, pron: pron.id, text, answer, answerText }],
      ratedThisTurn: rated.ratedThisTurn,
      lastFeedback: feedback,
    },
    events: rated.events,
  };
}

// Missing kinds first, in the order the spec lists them, then anything doubled.
function shapeError(tokens: Token[]): ShapeError | undefined {
  if (tokens.length === 0) return { kind: "empty" };
  const count = (pos: Token["pos"]) => tokens.filter((t) => t.pos === pos).length;
  if (count("pronoun") === 0) return { kind: "noPron" };
  if (count("verb") === 0) return { kind: "noVerb" };
  if (count("noun") === 0) return { kind: "noObj" };
  if (kinds.some((k) => count(k) > 1)) return { kind: "extra" };
  return undefined;
}

function slip(rated: Rated, point: string, given: string, expected: string): Rated {
  const event: GameEvent = { type: "grammarSlip", point, given, expected };
  return { ...rated, events: [...rated.events, event] };
}

// Spec 4.5 invariant 4: a rejection changes nothing but lastFeedback and ratedThisTurn.
export function reject(
  state: GameState,
  reason: RejectReason,
  extra: { errors?: SlotError[]; shape?: ShapeError; feedback?: Feedback; rated?: Rated } = {},
): StepResult {
  const { errors, shape, feedback, rated } = extra;
  const event: GameEvent = {
    type: "rejected",
    reason,
    ...(errors && { errors }),
    ...(shape && { shape }),
  };
  return {
    state: {
      ...state,
      ...(feedback && { lastFeedback: feedback }),
      ...(rated && { ratedThisTurn: rated.ratedThisTurn }),
    },
    events: [event, ...(rated?.events ?? [])],
  };
}
