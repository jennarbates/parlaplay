# Chi è?: MVP Spec

| | |
|---|---|
| Status | v0.5 draft (2026-10-06). Becomes `v1` after the review in section 10.1 |
| Product name | **Chi è?** ("Who is it?"). Never use "Guess Who" or "Indovina chi?" in public branding (Hasbro trademarks) |
| Audience for this doc | Whoever builds, reviews, or tests the MVP |

Conventions: each section leads with the decision, then the reason. `TBD:` marks an open question. Italian strings in this doc are the exact strings the app must produce.

---

## 1. Scope and non-goals

**Goal.** A browser game where an A1 Italian learner plays a Guess-Who style round against the computer, and every move (asking, answering) is a small, checked piece of Italian.

**Target user.** Adult learner at CEFR A1, on a phone, who can read basic Italian and knows the alphabet and pronunciation basics. UI chrome is in English; game content is in Italian.

**Success criteria for the MVP.**

1. Live URL that plays a full round on an iPhone (Safari) and an Android phone (Chrome).
2. `engine/` tests pass in CI with at least 90% line coverage.
3. Every item in the definition of done (10.3) is checked.
4. README explains how to run, test, and add a character.

**In and out of the MVP.**

| In MVP | Out of MVP (future, see section 11) |
|---|---|
| 24 characters, 8 attributes, 3 question templates | Themed decks (family, food, city), jobs, more attributes |
| Level 1: tap pre-built questions with English hints | Level 3: free-typed questions |
| Level 2: build questions from tiles, no English | Level 4: audio-only CPU questions |
| Player asks; CPU answers in Italian text | Audio of any kind (TTS, recordings, speech input) |
| CPU asks simple yes/no questions; player answers Sì/No | CPU choosing questions from the learner's weak words (SRS-weighted) |
| Mistake log and "due words" list | Flashcard review mode |
| Card detail view: long-press shows the face large, no text | Colorblind mode (Italian labels on cards) |
| Spaced repetition scheduling stored per user | Any LLM feature (hints, free chat, grading) |
| Guest play (local only) and email sign-in (6-digit code) with sync | Multiplayer (live or async) |
| | Teacher-made decks, classrooms, leaderboards |
| | Native apps |
| Account deletion on request by email (7.3) | Account deletion in the app, Google sign-in |
| | Championship mode (first to 5 wins), Easy CPU setting |
| | Offline play and installable PWA |
| | Daily new-card limit (comes back with SRS-weighted CPU questions) |

Anything not in the left column is out. When a new idea comes up, it goes into section 11, not into the build.

---

## 2. Game rules

**Setup.**
- Both sides use the same 24 characters.
- The engine draws two secret characters from the seed: `cpuSecret` (the player must find it) and `playerSecret` (the CPU must find it). They are drawn independently and may be the same character.
- The player sees their own secret card. The board shows all 24 characters face up; it is the player's notes about who the CPU's secret could be.
- The player always goes first.

**A turn.** On their turn, a side does exactly one of:
- **Ask** one yes/no question, or
- **Guess** one character.

Then the turn passes to the other side.

**Answers.** All questions are yes/no. Answers are full Italian sentences:
- Yes: `Sì, ` + question body with its first letter lowercased + `.` e.g. `Ha i capelli biondi?` becomes `Sì, ha i capelli biondi.`
- No: `No, non ` + question body with its first letter lowercased + `.` e.g. `No, non ha i capelli biondi.`, `No, non è un uomo.`

The answer repeats the player's own words. If the player asked with `castani` for eyes, the answer says `castani`; with `marroni`, it says `marroni` (3.3).

The CPU always answers truthfully.

**Player answering the CPU.** The player taps Sì or No. If the player answers wrongly, the app shows the correct answer, logs a mistake, and the CPU receives the correct answer. There is no other penalty. (Reason: a wrong answer from a learner should teach, not break the CPU's logic.)

**Flipping.** The player can flip any board card down or back up at any time during a round, including the card that is actually the CPU's secret. Flipping is free, reversible, and never ends a turn.

**Winning and losing.**
- Player guesses `cpuSecret` correctly: player wins.
- Player guesses wrongly: the player loses. This is the official board game rule (see decision D3), so every guess goes through a confirm dialog.
- CPU guesses `playerSecret`: player loses. The CPU only guesses when one candidate remains, so its guess is always right.

**Edge cases.**

| Situation | Rule |
|---|---|
| Player asks a question already asked by the player this round | Rejected, turn not used, previous answer shown again |
| Player asks a question the CPU already asked | Allowed (different side, different secret) |
| Player uses the wrong verb or article (Level 2) | Rejected, turn not used, mistake logged, feedback names the rule |
| Player's only error is adjective agreement (Level 2, e.g. `bionde` for `biondi`) | Accepted and answered; the correct form is shown with the answer and the slip goes to the Mistakes tab (soft feedback, see 3.4) |
| Player builds a grammatical but meaningless question (`Ha gli occhi biondi?`) | Rejected, turn not used, no mistake logged |
| Player asks about brown eyes with `castani` or `marroni` | Both accepted; they mean the same thing, so asking one after the other is a duplicate |
| Player builds `capelli marroni` | Rejected, turn not used, no mistake logged; feedback says "For *capelli*, Italians say *castani*" (3.7) |
| Player flips all 24 cards down | Allowed. An "Unflip all" button appears. Game continues |
| Player guesses a card that is flipped down | Allowed, with a confirm dialog that says it is flipped |
| Player taps "Quit round", or starts a new round while one is saved | The old round is recorded as `abandoned` and its saved state discarded. Ratings already logged are kept |
| App reloads mid-round | Round resumes from saved state (state is saved after every action), unless the content version changed (3.6) |

There is no turn limit and no timer. Each round stands alone; there is no match score across rounds.

---

## 3. Content model

All Italian lives in JSON, validated with Zod at build time (a Vite plugin checks every file in `src/content/`, so a bad file fails `pnpm build`). Every inflected form is written out as data. There is no inflection code.

### 3.1 Attributes

| Key | Values (lexicon lemma ids) | Question form |
|---|---|---|
| `gender` | `n.uomo`, `n.donna` | `È un uomo?` / `È una donna?` |
| `hairColor` | `adj.biondo`, `adj.castano`, `adj.nero`, `adj.rosso`, `adj.bianco` | `Ha i capelli castani?` |
| `hairLength` | `adj.corto`, `adj.lungo` | `Ha i capelli lunghi?` |
| `eyeColor` | `adj.azzurro`, `adj.marrone`, `adj.verde` | `Ha gli occhi verdi?` |
| `glasses` | boolean | `Ha gli occhiali?` |
| `hat` | boolean | `Ha il cappello?` |
| `beard` | boolean | `Ha la barba?` |
| `mustache` | boolean | `Ha i baffi?` |

That gives 16 possible questions. Brown eyes can be asked two ways (`Ha gli occhi castani?` and `Ha gli occhi marroni?`); both are the same question. Skin tone and name vary for variety but are never game attributes and are never asked about.

### 3.2 Characters

```ts
const Character = z.object({
  id: z.string(),                 // "c.giulia"
  name: z.string(),               // "Giulia"
  attrs: z.object({
    gender: z.enum(["n.uomo", "n.donna"]),
    hairColor: z.enum(["adj.biondo", "adj.castano", "adj.nero", "adj.rosso", "adj.bianco"]),
    hairLength: z.enum(["adj.corto", "adj.lungo"]),
    eyeColor: z.enum(["adj.azzurro", "adj.marrone", "adj.verde"]),
    glasses: z.boolean(),
    hat: z.boolean(),
    beard: z.boolean(),
    mustache: z.boolean(),
  }),
  skin: z.string(),               // art layer only, never asked
});
```

```json
[
  { "id": "c.giulia", "name": "Giulia",
    "attrs": { "gender": "n.donna", "hairColor": "adj.castano", "hairLength": "adj.lungo",
               "eyeColor": "adj.verde", "glasses": true, "hat": false, "beard": false, "mustache": false },
    "skin": "s3" },
  { "id": "c.marco", "name": "Marco",
    "attrs": { "gender": "n.uomo", "hairColor": "adj.nero", "hairLength": "adj.corto",
               "eyeColor": "adj.marrone", "glasses": false, "hat": true, "beard": true, "mustache": true },
    "skin": "s2" },
  { "id": "c.elena", "name": "Elena",
    "attrs": { "gender": "n.donna", "hairColor": "adj.biondo", "hairLength": "adj.corto",
               "eyeColor": "adj.azzurro", "glasses": false, "hat": true, "beard": false, "mustache": false },
    "skin": "s1" }
]
```

**Content invariants (checked by a test, not by hand).**
- No two characters have the same 8 attribute values. This guarantees the CPU can always find a splitting question.
- Women have `beard: false` and `mustache: false`.
- 12 men, 12 women.
- Every one of the 16 questions gets "yes" from at least 3 and at most 15 of the 24 characters. (`TBD:` tune after playtesting.)

**How characters are made.** `scripts/generate-characters.ts` takes a seed and picks 24 attribute combinations that pass every invariant above, retrying until they do. It runs once by hand, not at build time. Its output is reviewed, given Italian names, and committed as `content/characters.json`. After release, characters change only by editing that file, and ids stay permanent (3.6). The MVP set is seed 5152: among seeds 1 to 20,000 it had the most natural spread (each hair color on 3 to 6 people, half long hair and half short for both men and women, 7 of 12 men bearded, 4 or 6 people on each skin layer). Ids are `c.` plus the lowercased name.

### 3.3 Lexicon

```ts
const Article = z.object({
  id: z.string(),                       // "art.i"
  pos: z.literal("article"),
  text: z.string(),                     // "i"
});

const Verb = z.object({
  id: z.string(),                       // "v.ha"
  pos: z.literal("verb"),
  text: z.string(),                     // "ha"
});

const Noun = z.object({
  id: z.string(),                       // "n.capelli"
  pos: z.literal("noun"),
  text: z.string(),                     // "capelli"
  gloss: z.string(),                    // "hair"
  gender: z.enum(["m", "f"]),
  number: z.enum(["sg", "pl"]),
  defArt: z.string(),                   // "art.i"
  indefArt: z.string().optional(),      // "art.un" (only nouns used with essere)
  template: z.string(),                 // which template this noun is asked with
  artRule: z.string(),                  // feedback message key for its article (3.7), e.g. "art.mpl.consonant"
  attr: z.string().optional(),          // boolean attribute it tests ("glasses")
  adjAttrs: z.array(z.string()).optional(), // attributes its adjectives may describe
  level: z.enum(["A1", "A2"]),         // from the Profilo check (3.3)
  retired: z.boolean().optional(),      // see 3.6
});

const Adjective = z.object({
  id: z.string(),                       // "adj.biondo"
  pos: z.literal("adj"),
  gloss: z.string(),                    // "blond"
  attr: z.string(),                     // "hairColor"
  alsoMeans: z.array(z.object({         // extra meanings on other attributes
    attr: z.string(),                   // "eyeColor"
    value: z.string(),                  // "adj.marrone"
  })).optional(),
  wordChoice: z.array(z.object({        // nouns this word sounds wrong with
    noun: z.string(),                   // "n.capelli"
    use: z.string(),                    // "adj.castano"
  })).optional(),
  forms: z.object({ ms: z.string(), fs: z.string(), mp: z.string(), fp: z.string() }),
  level: z.enum(["A1", "A2"]),
  retired: z.boolean().optional(),
});
```

`lexicon.json` is one array of all four kinds, told apart by `pos`. In the code every object schema is strict, so an unknown or misspelled key fails the build.

A specific form of an adjective is referenced as `<lemmaId>#<formKey>`, e.g. `adj.biondo#mp` is `biondi`.

```json
[
  { "id": "n.capelli", "pos": "noun", "text": "capelli", "gloss": "hair",
    "gender": "m", "number": "pl", "defArt": "art.i", "artRule": "art.mpl.consonant",
    "template": "t.have.adj", "adjAttrs": ["hairColor", "hairLength"], "level": "A1" },
  { "id": "n.occhiali", "pos": "noun", "text": "occhiali", "gloss": "glasses",
    "gender": "m", "number": "pl", "defArt": "art.gli", "artRule": "art.mpl.vowel",
    "template": "t.have", "attr": "glasses", "level": "A1" },
  { "id": "n.donna", "pos": "noun", "text": "donna", "gloss": "woman",
    "gender": "f", "number": "sg", "defArt": "art.la", "indefArt": "art.una", "artRule": "art.indef.f",
    "template": "t.be", "level": "A1" },
  { "id": "adj.biondo", "pos": "adj", "gloss": "blond", "attr": "hairColor",
    "forms": { "ms": "biondo", "fs": "bionda", "mp": "biondi", "fp": "bionde" }, "level": "A1" },
  { "id": "adj.castano", "pos": "adj", "gloss": "brown (hair, eyes)", "attr": "hairColor",
    "alsoMeans": [{ "attr": "eyeColor", "value": "adj.marrone" }],
    "forms": { "ms": "castano", "fs": "castana", "mp": "castani", "fp": "castane" }, "level": "A1" },
  { "id": "adj.marrone", "pos": "adj", "gloss": "brown (eyes)", "attr": "eyeColor",
    "wordChoice": [{ "noun": "n.capelli", "use": "adj.castano" }],
    "forms": { "ms": "marrone", "fs": "marrone", "mp": "marroni", "fp": "marroni" }, "level": "A1" }
]
```

Full MVP lexicon: 8 nouns (`capelli`, `occhi`, `occhiali`, `cappello`, `barba`, `baffi`, `uomo`, `donna`), 10 adjectives (`biondo`, `castano`, `nero`, `rosso`, `bianco`, `corto`, `lungo`, `azzurro`, `marrone`, `verde`), articles (`il`, `la`, `l'`, `i`, `gli`, `un`, `una`), verbs (`ha`, `è`). `l'` is there because every noun needs a definite article and `uomo`'s is `l'`; no question uses it, since `uomo` is only asked with `È un uomo?`.

Vocabulary choice: `castani` for brown hair and `azzurri` for blue eyes, the standard textbook forms. For brown eyes, both `castani` and `marroni` are accepted: `castani` is the traditional form and `marroni` is very common in everyday speech, and A1 exams (CILS, CELI) publish no word list that picks one. `capelli marroni` is not natural Italian, so it is rejected with a hint. The Italian review in 10.1 confirms all strings.

`TBD:` which brown-eyes word is the default, used in the Level 1 picker and in CPU questions. The Italian reviewer decides on day 1.

**Level check.** The words were chosen for what the board can show, not taken from an A1 list, so each of the 18 lemmas is checked against the *Profilo della lingua italiana* (Spinelli and Parizzi, 2010), the CEFR reference level description for Italian. The Italian-speaking reviewer does this check. A word found above A1 is swapped for an A1 alternative if one exists; otherwise it stays, marked `level: "A2"`. Likely safe: `capelli`, `occhi`, `uomo`, `donna`, the colors, `lungo`, `corto`. Most likely to need a decision: `baffi`, `barba`, `castano`, `occhiali`, `cappello`.

### 3.4 Question templates

Templates are declarative data. The predicate is a named operation, not a function, so templates can live in JSON and be tested exhaustively.

```ts
const Template = z.object({
  id: z.string(),
  pattern: z.string(),                          // "Ha {art} {noun} {adj}?"
  verb: z.enum(["v.ha", "v.e"]),
  article: z.enum(["def", "indef"]),
  needsAdj: z.boolean(),
  predicate: z.enum(["hasFeature", "featureIs", "genderIs"]),
});
```

| Id | Pattern | Article | Predicate (yes when...) | Example |
|---|---|---|---|---|
| `t.have` | `Ha {art} {noun}?` | def | `attrs[noun.attr] === true` | `Ha la barba?` |
| `t.have.adj` | `Ha {art} {noun} {adj}?` | def | `attrs[m.attr] === m.value`, where `m` is the adjective's meaning for this noun (4.3) | `Ha gli occhi azzurri?` |
| `t.be` | `È {art} {noun}?` | indef | `attrs.gender === noun.id` | `È una donna?` |

**Rendering.** `render(template, fill)` substitutes the form texts, always using the adjective the player chose (so `castani` and `marroni` each render as themselves). Answers follow the rule in section 2. One template definition therefore produces the question, the answer, the truth value, and the grammar check.

**Grammar check (Level 2).** Given the noun, the expected tiles are:
- verb: the template's verb (`ha` for `t.have*`, `è` for `t.be`). Wrong verb is the avere/essere error.
- article: `noun.defArt` or `noun.indefArt` per the template.
- adjective form: `adj.forms[noun.gender + noun.number]` (`m` + `pl` → `mp`). The given form is compared by its text, not its form key, because some forms are identical (`marrone` is both `ms` and `fs`).

**Tile builder shape.** The Level 2 builder has fixed slots in order: verb, article, noun, adjective. A slot left empty is a shape error (`noVerb`, `noArt`, `noNoun`, `needsAdj`), as is an adjective on a noun that takes none (`noAdjAllowed`). Shape errors show a message and log nothing. A filled slot with the wrong word is a grammar error.

**Hard and soft errors.** A wrong verb or article rejects the question. A wrong adjective form does not: the question is accepted, rendered with the correct form, and the slip is shown and logged without an `again` rating. Reason: A1 syllabi disagree on agreement. CELI A1 expects noun-adjective agreement, while other A1 syllabi do not require learners to produce it. Showing the fix every time teaches it without punishing it.

Every mismatch is reported separately (`{ slot, given, expected, rule }`, where `rule` is a message key from 3.7) so feedback can say, for example: "*capelli* is masculine plural and starts with a consonant: use *i*."

### 3.5 Art manifest

Characters are SVG built from stacked layers, chosen from the attributes, so the picture can never disagree with the data. The MVP ships with simple placeholder layers (flat shapes and colors) made in code. Final art replaces them later by dropping in files with the same names; no code changes.

| z | Layer | Driven by | Files |
|---|---|---|---|
| 0 | background | fixed | `bg.svg` |
| 1 | body + shirt | `gender` | `body-m.svg`, `body-f.svg` |
| 2 | face | `skin` | `face-s1.svg` ... `face-s5.svg` |
| 3 | eyes | `eyeColor` | `eyes-azzurro.svg`, `eyes-marrone.svg`, `eyes-verde.svg` |
| 4 | beard | `beard` + `hairColor` | `beard-{color}.svg` (5) |
| 5 | mustache | `mustache` + `hairColor` | `mustache-{color}.svg` (5) |
| 6 | hair | `hairColor` + `hairLength` | `hair-{color}-{length}.svg` (10) |
| 7 | glasses | `glasses` | `glasses.svg` |
| 8 | hat | `hat` | `hat.svg` (drawn high on the head, so short hair always shows a visible band below it and long hair still shows) |

Placeholder rule: each layer must make its attribute obvious at card size (about 80 px wide), e.g. a hat is a solid block on top, glasses are two clear rings, eyes are drawn larger than life so their color reads, and a beard without a mustache leaves a visible gap under the nose. If a placeholder is ambiguous, the game is unfair, so this gets checked in the device test.

**Detail view.** Long-pressing a card (or its "Zoom" control for keyboard users) shows that face large, with no text, so small details like eye color are easy to check. A colorblind mode that adds Italian labels is future work (section 11).

### 3.6 Content ids and versions

Ids (`n.capelli`, `adj.biondo`, `c.giulia`, `t.have.adj`) are permanent. They are never renamed or reused, because the review log refers to them forever. A word that leaves the game stays in the lexicon with `retired: true`, so old history still resolves.

`content/version.json` holds an integer `contentVersion`, bumped whenever content changes. Each saved game stores the version it started with (also the `content_version` column in 7.1). An unfinished saved game with an older version is discarded on load instead of resumed. `content/released-ids.json` lists every id in the last production release and is updated as part of each release. A content test fails if any id in that file is missing from the current content.

### 3.7 Feedback messages

Every feedback string lives in `content/messages.json`, keyed by rule id, with `{placeholders}`. UI chrome is English, with Italian words in italics. The list below is a draft; the Italian reviewer checks it in 10.1.

| Key | When | Message (draft) |
|---|---|---|
| `verb.avere` | Used `è` where `ha` is needed | Use *ha* (avere) for things someone has: *Ha {art} {noun}?* |
| `verb.essere` | Used `ha` where `è` is needed | Use *è* (essere) for what someone is: *È {art} {noun}?* |
| `art.msg.consonant` | Wrong article on `cappello` | *{noun}* is masculine singular and starts with a consonant: use *il*. |
| `art.fsg` | Wrong article on `barba` | *{noun}* is feminine singular: use *la*. |
| `art.mpl.consonant` | Wrong article on `capelli`, `baffi` | *{noun}* is masculine plural and starts with a consonant: use *i*. |
| `art.mpl.vowel` | Wrong article on `occhi`, `occhiali` | *{noun}* is masculine plural and starts with a vowel: use *gli*. |
| `art.indef.m` | Wrong article on `uomo` | *{noun}* is masculine: use *un*. |
| `art.indef.f` | Wrong article on `donna` | *{noun}* is feminine: use *una*. |
| `agreement` | Adjective form slip (soft) | *{expected}*, not *{given}*: *{noun}* is {genderNumber}. |
| `meaning.mismatch` | Adjective can't describe the noun | *{noun}* can't be *{given}*. Try a word for {allowed}. |
| `meaning.wordChoice` | `capelli marroni` | For *{noun}*, Italians say *{use}*. |
| `duplicate` | Question already asked | You already asked that. The answer was: {answerText} |
| `shape.noVerb`, `shape.noArt`, `shape.noNoun` | Empty slot | Add a verb. / Add an article. / Add a noun. |
| `shape.needsAdj` | `capelli` or `occhi` with no adjective | *{noun}* needs a description: add a color or length. |
| `shape.noAdjAllowed` | Adjective on `barba` etc. | Just ask *Ha {art} {noun}?* |
| `answer.wrong` | Wrong Sì/No to a CPU question | Not quite: {answerText} |

---

## 4. Engine contract

`engine/` is pure TypeScript with no React, DOM, or time access. One function moves the game forward: `step(state, action, content) → { state, events }`. Randomness comes only from the seed.

### 4.1 Types

```ts
type Phase = "setup" | "playerTurn" | "playerReview" | "cpuTurn" | "cpuReview" | "over";

type Fill = { verb: string; art: string; noun: string; adj?: string }; // ids, adj as "adj.biondo#mp"

type QuestionKey = string; // `${templateId}|${nounId}|${value ?? ""}`, value = the attribute value tested ("adj.marrone" for both castani and marroni eyes)

type SlotError = {
  slot: "verb" | "art" | "adj" | "answer";
  given: string;           // text the player chose ("gli", "bionde", "Sì")
  expected: string;        // correct text ("i", "biondi", "No")
  rule: string;            // message key from 3.7
};

type ShapeError = { kind: "noVerb" | "noArt" | "noNoun" | "needsAdj" | "noAdjAllowed" };

type Feedback = { messageKey: string; params: Record<string, string> }[]; // rendered with content/messages.json

type AskedQuestion = {
  by: "player" | "cpu";
  key: QuestionKey;
  text: string;            // "Ha i capelli biondi?"
  answer: boolean;         // the truth
  answerText: string;      // "No, non ha i capelli biondi."
  playerAnswer?: boolean;  // CPU questions only
};

type GameState = {
  phase: Phase;
  seed: number;
  level: 1 | 2;
  turn: number;
  playerSecret: string;
  cpuSecret: string;
  flipped: string[];               // player's board, ids face down
  cpuCandidates: string[];         // who the CPU still thinks playerSecret could be
  cpuQuestionOrder: QuestionKey[]; // seeded shuffle of the 16 questions, fixed at START
  pendingCpuQuestion?: QuestionKey;
  history: AskedQuestion[];
  ratedThisTurn: string[];         // "lexiconId|direction", at most one rating per card per turn; cleared when `turn` increments
  lastFeedback?: Feedback;         // what the UI shows after the last action
  result?: "won" | "lost";
};

type Action =
  | { type: "START"; seed: number; level: 1 | 2 }
  | { type: "ASK"; templateId: string; fill: Fill }
  | { type: "GUESS"; characterId: string }
  | { type: "FLIP"; characterId: string }       // toggles
  | { type: "ANSWER"; value: boolean; hintShown: boolean }
  | { type: "END_TURN" };

type GameEvent =
  | { type: "rejected"; reason: "wrongPhase" | "unknownId" | "grammar" | "nonsense" | "duplicate"; errors?: SlotError[] }
  | { type: "asked"; by: "player" | "cpu"; key: QuestionKey; answer: boolean }
  | { type: "rating"; lexiconId: string; direction: "recognize" | "produce"; rating: "again" | "hard" | "good"; detail?: SlotError }
  | { type: "agreementSlip"; lexiconId: string; given: string; expected: string }
  | { type: "gameOver"; result: "won" | "lost" };
```

The engine emits `rating` events but never timestamps them. The progress store adds time and day (section 6).

Level 2 tiles are turned into `{ templateId, fill }` by the pure function `parseTiles(tiles)`. The noun picks the template. Shape problems (an empty slot, a missing adjective for `capelli`, an adjective on `barba`) return a `ShapeError` that the UI shows; no action is dispatched and nothing is logged.

Quitting is not an engine action. The game store records the round as `abandoned` and discards the saved state (section 2).

### 4.2 Transition table

`R` = rejected with `wrongPhase`.

| Phase | START | ASK | GUESS | FLIP | ANSWER | END_TURN |
|---|---|---|---|---|---|---|
| setup | → playerTurn | R | R | R | R | R |
| playerTurn | R | see 4.3 | right → over (won); wrong → over (lost) | toggle | R | R |
| playerReview | R | R | R | toggle | R | CPU moves (section 5): → cpuTurn, or → over (lost) |
| cpuTurn | R | R | R | toggle | → cpuReview | R |
| cpuReview | R | R | R | toggle | R | → playerTurn, `turn + 1`, `ratedThisTurn` cleared |
| over | → playerTurn (new game) | R | R | R | R | R |

### 4.3 ASK validation order

Checks run in this order; the first failure rejects:

1. Phase is `playerTurn`.
2. Template and all fill ids exist (`unknownId`).
3. Grammar: verb and article (`grammar`). Emits an `again` rating for the noun (section 6). A wrong adjective form does not reject here; it becomes an agreement slip on success. If step 3 fails, the adjective form is still checked and any mismatch is added to `errors` with `rule: "agreement"`, so feedback shows every problem at once. Only the noun's `again` rating is emitted: no `agreementSlip` and no slip row, because the question was not accepted.
4. Meaning (`nonsense`). The adjective's meaning for this noun is its own `attr` if that is in `noun.adjAttrs`, otherwise the first `alsoMeans` entry whose `attr` is in `noun.adjAttrs` (so `castani` on `occhi` means `eyeColor: adj.marrone`). If neither exists, the question is rejected; if the adjective has a `wordChoice` entry for this noun, the feedback is `meaning.wordChoice`, otherwise `meaning.mismatch`.
5. Not already asked by the player this round (`duplicate`).

On success: evaluate the predicate against `cpuSecret`, render question and answer using the correct adjective form, append to `history`, emit `asked`, and move to `playerReview`. At level 2 only, also emit the produce ratings and any `agreementSlip` (section 6). At level 1 the question comes from the picker, so steps 3 and 4 always pass and no produce rating is emitted.

### 4.4 Invariants (each becomes a test)

1. `playerSecret` and `cpuSecret` never change after START.
2. `cpuCandidates` always contains `playerSecret`.
3. Every `AskedQuestion.answer` equals the predicate evaluated on the asked side's secret.
4. A rejected action changes no field except `lastFeedback` and `ratedThisTurn`.
5. `history` only grows within a round.
6. `over` accepts only START.
7. Same seed + same action sequence produces the same state and events (determinism).
8. At most one `rating` event per `lexiconId|direction` per turn.
9. `ratedThisTurn` is empty at the start of every player turn.

### 4.5 Traced example turn

Level 2, CPU secret is Giulia (castano, lungo, verde, glasses). The same question at level 1 emits only `asked`.

1. Player taps tiles `Ha` `i` `capelli` `biondi`. UI calls `parseTiles` → `{ templateId: "t.have.adj", fill: { verb: "v.ha", art: "art.i", noun: "n.capelli", adj: "adj.biondo#mp" } }`.
2. UI dispatches `ASK` with that payload.
3. Engine: phase is `playerTurn` (ok). Ids exist (ok). Grammar: `capelli` is m pl, expected verb `v.ha`, article `art.i`, form `mp` (all match). Meaning: `hairColor` is in `capelli.adjAttrs` (ok). Key `t.have.adj|n.capelli|adj.biondo` not in player history (ok).
4. Predicate `featureIs`: `attrs.hairColor` is `adj.castano`, not `adj.biondo` → `false`.
5. Render: question `Ha i capelli biondi?`, answer `No, non ha i capelli biondi.`
6. Returns state with `phase: "playerReview"`, the new `AskedQuestion` in `history`, `ratedThisTurn: ["n.capelli|produce", "adj.biondo|produce"]`, and events:
   - `asked { by: "player", key, answer: false }`
   - `rating { n.capelli, produce, good }`
   - `rating { adj.biondo, produce, good }`
7. UI shows the answer and the progress store writes two review-log rows. The player flips the blond characters down and taps "Avanti" (END_TURN).

Same tiles but with `bionde`: steps 3 to 5 pass (the verb and article are right). The question is accepted and rendered correctly as `Ha i capelli biondi?`, the feedback says "*biondi*, not *bionde*: *capelli* is masculine plural", and the events are `asked`, `rating { n.capelli, produce, good }` and `agreementSlip { adj.biondo, given: "bionde", expected: "biondi" }`. `adj.biondo` gets no rating this turn.

Same tiles but with `gli` instead of `i`: step 3 fails, the engine returns `rejected { reason: "grammar", errors: [{ slot: "art", given: "gli", expected: "i", rule: "art.mpl.consonant" }] }` and `rating { n.capelli, produce, again }`, and the phase stays `playerTurn`.

Same tiles but with `gli` and `bionde`: step 3 fails, the engine returns `rejected { reason: "grammar", errors: [{ slot: "art", given: "gli", expected: "i", rule: "art.mpl.consonant" }, { slot: "adj", given: "bionde", expected: "biondi", rule: "agreement" }] }` and `rating { n.capelli, produce, again }`, and nothing else: no `agreementSlip`, no rating for `adj.biondo`.

---

## 5. CPU behavior

The CPU plays smart and deterministic: it always asks the question that best splits its remaining candidates.

CPU questions always use the default wording (for brown eyes, the word picked in the Italian review, 3.3).

**Choosing a move** (runs inside END_TURN from `playerReview`):
1. If `cpuCandidates` has one id, the CPU guesses it → `over`, `lost`.
2. Otherwise, among the questions it has not asked, it picks the one whose "yes" count among `cpuCandidates` is closest to half. Ties go to the question that comes first in `cpuQuestionOrder` (seeded shuffle of the 16 questions, set at START), so games vary but stay reproducible. The content invariant in 3.2 guarantees a question that splits the candidates always exists.
3. It sets `pendingCpuQuestion` and moves to `cpuTurn`. The UI shows it.

**Answering the player's questions:** truthfully, by evaluating the predicate on `cpuSecret`.

**Updating after the player answers:** the CPU filters `cpuCandidates` using the true answer, not the player's answer.

Measured length (`node scripts/simulate.ts`, 1,000 games): the CPU needs 4.7 questions on average and never more than 5 to find the player's character, close to the best possible (log2 24 ≈ 4.6). A player who asks questions as well as the CPU wins about 78% of games, because both sides need the same number of questions and the player goes first; real learners will ask less efficient questions and win less. If playtesting shows learners lose too often, the planned fix is an Easy setting (section 11), not a weaker default.

---

## 6. Learning model

Spaced repetition with FSRS (proposed library: `ts-fsrs`, default parameters, desired retention 0.9). In the MVP, scheduling is computed and stored, and shown on the Progress screen. Nothing in gameplay reads it yet.

**Card.** One card per `(lexiconId, direction)` for nouns and adjectives (18 lemmas × 2 = 36 cards).
- `recognize`: Italian → meaning. Exercised when the player answers a CPU question.
- `produce`: meaning → Italian. Exercised when the player builds a question at Level 2.

Articles and verbs are not cards. An article error is rated against the noun (choosing the article means knowing the noun's gender and number). A verb error (avere/essere) is also rated against the noun.

**Event → rating.**

| Game event | Cards | Rating |
|---|---|---|
| Level 2 question accepted, adjective in the right form | produce: noun, adjective | good |
| Level 2 question accepted with an agreement slip | produce: noun good; adjective not rated | slip row logged for the Mistakes tab |
| Level 2 question rejected for grammar (verb or article) | produce: the noun | again |
| Level 1 pre-built question tapped | none | none (exposure only) |
| Question rejected as `nonsense` or `duplicate`, or a `shapeError` | none | none |
| CPU question answered correctly, hint not shown | recognize: noun, adjective | hard |
| CPU question answered wrongly | recognize: noun, adjective | again, with `detail` `{ slot: "answer", given, expected, rule: "answer.wrong" }` for the Mistakes tab |
| Hint shown before answering | none | none |

`easy` is never produced by the game.

**Guess-proofing.** A Sì/No answer is right half the time by luck, so a correct answer is capped at `hard`. Only producing the form (Level 2) can earn `good`.

**One rating per card per turn.** If a learner fails and then fixes a question in the same turn, the fixed card keeps its `again`.

**Review log.** Append-only, and the source of truth. Card state is a cache that can always be rebuilt by replaying the log in `created_at` order.

```ts
type ReviewLogRow = {
  id: string;            // uuid generated on the client
  gameId: string;
  lexiconId: string;
  direction: "recognize" | "produce";
  rating: "again" | "hard" | "good" | "slip"; // "slip" rows feed the Mistakes tab; FSRS replay skips them
  detail?: SlotError;    // { given, expected } for the mistake log
  localDay: string;      // "2026-10-06" in the learner's timezone at the time
  createdAt: string;     // ISO timestamp
};
```

**No daily new-card limit in the MVP.** Every counted rating is scheduled. A limit only matters once gameplay follows the schedule, so it returns together with SRS-weighted CPU questions (section 11). `localDay` is still stored so a future limit can be replayed the same way on any device.

---

## 7. Data and backend

Supabase (Postgres + Auth) with Row Level Security. No custom server code in the MVP. Guests' data stays in IndexedDB and is never sent to a server.

**Environments.**

| Environment | Supabase | Used by |
|---|---|---|
| Local | Supabase CLI in Docker; catches sign-in emails in a local inbox | Development, Vitest sync tests, Playwright, CI |
| Staging | Free cloud project | Pull request preview deploys |
| Production | Free cloud project, upgraded to Pro at launch | `main` deploys at `chie.parlaplay.games` |

That uses both free cloud projects. Schema changes are SQL files in `supabase/migrations/`, applied locally, then to staging, then to production with the CLI, before merging any code that needs them. The app only ever holds the public key (called the publishable key in newer Supabase projects, the anon key in older ones); the service role or secret key is never in the app or the repo.

### 7.1 Tables

```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  level smallint not null default 1 check (level in (1, 2)),
  created_at timestamptz not null default now()
);

-- every new auth user gets a profile row
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.games (
  id uuid primary key,                                   -- generated on the client
  user_id uuid not null references auth.users (id) on delete cascade,
  seed bigint not null,
  level smallint not null check (level in (1, 2)),
  content_version int not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  result text check (result in ('won', 'lost', 'abandoned'))
);

create table public.review_log (
  id uuid primary key,                                   -- generated on the client, makes sync idempotent
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id uuid references public.games (id) on delete set null,
  lexicon_id text not null,
  direction text not null check (direction in ('recognize', 'produce')),
  rating text not null check (rating in ('again', 'hard', 'good', 'slip')),
  detail jsonb,
  local_day date not null,
  created_at timestamptz not null
);

create index review_log_user_created on public.review_log (user_id, created_at);

create table public.cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  lexicon_id text not null,
  direction text not null check (direction in ('recognize', 'produce')),
  state jsonb not null,                                  -- FSRS card state
  due timestamptz not null,
  log_count int not null,                                -- review_log rows the state was built from
  updated_at timestamptz not null default now(),
  primary key (user_id, lexicon_id, direction)
);

-- a device with an older copy of the log can never overwrite newer card state
create function public.cards_keep_newest() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.log_count < old.log_count then
    return null;  -- skip this stale update
  end if;
  return new;
end;
$$;

create trigger cards_keep_newest
  before update on public.cards
  for each row execute function public.cards_keep_newest();
```

### 7.2 RLS policies

```sql
alter table public.profiles   enable row level security;
alter table public.games      enable row level security;
alter table public.review_log enable row level security;
alter table public.cards      enable row level security;

-- profiles: read, create, and update your own row
create policy profiles_select on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_insert on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- games: read, create, and update (to set ended_at/result) your own games
create policy games_select on public.games for select to authenticated
  using ((select auth.uid()) = user_id);
create policy games_insert on public.games for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy games_update on public.games for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- review_log: append-only. No update or delete policy exists, so both are denied.
create policy review_log_select on public.review_log for select to authenticated
  using ((select auth.uid()) = user_id);
create policy review_log_insert on public.review_log for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (game_id is null or exists (
      select 1 from public.games g
      where g.id = game_id and g.user_id = (select auth.uid())
    ))
  );

-- cards: derived cache, fully owned by the user. Kept on the server for future
-- features such as "words due today" emails; the app itself rebuilds cards from the log.
create policy cards_select on public.cards for select to authenticated
  using ((select auth.uid()) = user_id);
create policy cards_insert on public.cards for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy cards_update on public.cards for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
```

The `anon` role has no policies, so it can read and write nothing.

### 7.3 Auth and sync rules

- Sign-in: a 6-digit code sent by email, typed into the same tab; Google sign-in is future work. There is no magic link, because on phones the email often opens in another app or browser, which would sign the user in somewhere without their guest data. The app calls `signInWithOtp` to send the code and `verifyOtp` (type `email`) to check it. The Supabase email template shows `{{ .Token }}` and no link. The sheet offers "Resend code" after Supabase's cooldown.
- Sending email: Supabase's built-in sender is for testing only (about 2 emails an hour, delivered only to the project team), so production sends through **AWS SES** set as Supabase's custom SMTP, from the domain `chie.parlaplay.games`. Setup: verify the domain in SES (SPF, DKIM and DMARC records), then request production access to leave the SES sandbox. Approval can take a day or more, so it is requested on day 2. **Fallback:** if SES access is slow or refused, Resend is used as the custom SMTP instead, with the same domain. Staging uses the built-in sender, which is enough for the team.
- Guest: data lives in IndexedDB under the key `guest` and is never uploaded unless the guest signs in. The app calls `navigator.storage.persist()` to ask the browser to keep it. Safari on iOS can still delete a site's storage after 7 days of Safari use without a visit, so after each finished guest round the app shows a quiet "Sign in to keep your progress safe" nudge, and the privacy note says so. The app needs a connection to load (online only in the MVP, see 11.1); once loaded, a round keeps working if the connection drops.
- Guest → account (any sign-in while guest data exists on this device): ask "Save your progress to this account?" (default Yes).
  - Yes: rewrite `user_id` on local rows, upload `games` first, then `review_log` with `insert ... on conflict (id) do nothing`.
  - No: delete guest data.
- Signed in, normal play: every write goes to an IndexedDB outbox first, then flushes to Supabase. The `games` row enters the outbox at START and is upserted again at round end with `ended_at` and `result`. A flush always sends `games` rows before `review_log` rows, because each log row must point at an existing game. Flush on each round end, on app start, and on the `online` event. A failed flush keeps rows in the outbox and shows a quiet banner.
- Merging across devices: the review log is append-only with client uuids, so a merge is a union with no conflicts. After each sync the client downloads the full log, replays it to rebuild card state, and upserts `cards` with `log_count` set to the number of log rows it replayed. The trigger in 7.1 ignores an upsert with a smaller `log_count` than the stored one.
- Sign-out: clears the local copy of that user's data (shared devices). If the outbox still has unsynced rows, the app first warns: "Some progress hasn't synced yet. Sign out anyway?" with "Sign out" and "Wait" buttons.
- Account deletion: by request. The privacy note gives an email address; the owner deletes the user in the Supabase dashboard, and the `on delete cascade` foreign keys remove all of their rows. Requests are handled within one month (the GDPR deadline). An in-app button is future work (section 11).

---

## 8. UX

Mobile-first, portrait, styled with Tailwind CSS. The full 24-card board must fit without scrolling in the space a 360 × 640 phone actually shows after the browser's own toolbars (roughly 360 × 560; layout uses `dvh` units, and this is checked on real phones). The question builder (or the CPU's question) lives in a bottom sheet over the board that collapses to a one-line bar, so the board never shrinks.

Desktop (1024px and wider) has its own spec, [`spec-desktop.md`](spec-desktop.md). Nothing below 1024px changes.

### 8.1 Screens and flow

```
Home ──► Game ──► Round end ──► Game (play again)
  │                    └──────► Home
  ├──► Progress (Mistakes | Due)
  └──► Settings ──► Sign-in sheet
                └─► Privacy note
```

| Screen | Contents |
|---|---|
| Home | Play (or "Continue round" when one is saved), level picker (1 or 2), Progress, Settings, sign-in status |
| Game | Top bar (turn, whose turn). Your secret card (small; tap it for the detail view, 3.5). Board: 4 columns × 6 rows. Bottom sheet: question picker (Level 1) or tile builder (Level 2) on your turn; CPU question with Sì / No on its turn; feedback after each action. Collapsed, the sheet shows one line (e.g. the last answer). "Indovina" (guess) button. "Avanti" (end turn) button. A menu with "Quit round" (asks to confirm). Long-press a card for the detail view (3.5) |
| Round end | Result, both secrets revealed, question history with answers, this round's mistakes, Play again |
| Progress | Mistakes tab: grouped by word, showing what was given and what was expected. Due tab: words due today and their next review date |
| Settings | Default level, account (sign in or out, with the unsynced warning from 7.3), link to the privacy note |
| Sign-in sheet | Email field, then a 6-digit code field with "Resend code" |
| Privacy note | What is stored, the services in section 9 (Privacy) and what each sees, that guest data can be cleared by Safari, and the email address for account deletion |

**Level 1 question picker:** a list of the 16 questions, each with its English gloss. Questions already asked this round are greyed out and show their answer.
**Level 2 tile builder:** four slots in order (verb, article, noun, adjective) above rows of verb tiles, article tiles, noun tiles, and adjective lemma tiles. Tapping a tile fills its slot. Tapping an adjective opens its forms, each distinct text shown once (`marrone`, `marroni`). Built question previews in the slots. "Chiedi" submits.
**Guessing:** tap "Indovina", tap a card, confirm.
**CPU questions at Level 1:** a "Show hint" button reveals the English. Revealing it removes the rating for that answer (section 6).

**Routes (React Router).** `/` Home, `/play` Game (the round-end view is part of it), `/progress`, `/settings`, `/privacy`. Sign-in is a sheet, not a route, since the code is typed in the same tab.

### 8.2 States

| State | Where | Behavior |
|---|---|---|
| Loading | App start, content load | Skeleton board; content is bundled so this should be under a second |
| Empty | Progress with no data | "Play a round to see your words here." |
| Error: sync failed | Any screen when signed in | Small banner "Saved on this device, will sync later." Play is never blocked |
| Error: code wrong or expired | Sign-in sheet | Inline message; "Resend code" |
| Error: email failed to send | Sign-in sheet | Inline message with retry |
| Unsynced sign-out | Settings | Confirm dialog from 7.3 |
| Guest nudge | Round end, as a guest | Quiet "Sign in to keep your progress safe" line (7.3) |
| Connection lost | Mid-round | Play continues (everything is already loaded); signed-in sync waits in the outbox |
| Resume | App reopened mid-round | Offer "Continue round" on Home |

---

## 9. Non-functional

**Browsers.** Current and previous major version of: Safari on iOS, Chrome on Android, desktop Chrome, Firefox, Safari, Edge.

**Stack.** React + TypeScript (strict) + Vite, React Router, Zustand, Tailwind CSS, Zod, `ts-fsrs`, Supabase JS client, a small IndexedDB wrapper (e.g. `idb`). Tests: Vitest, fast-check, Playwright. Tooling: pnpm, ESLint, Prettier.

**Folder structure.**

```
src/
  engine/      pure TS: types, step, questions, grammar, cpu (no React, DOM or time)
  content/     characters.json, lexicon.json, templates.json, messages.json, version.json, released-ids.json
  services/    storage (IndexedDB), sync (Supabase), srs (FSRS replay), errors (Sentry)
  store/       gameStore, progressStore (Zustand)
  ui/          Board, CardDetail, BottomSheet, QuestionPicker, TileBuilder, RoundEnd, Progress, Settings, SignInSheet, Privacy
  routes.tsx
public/art/    SVG layers named as in 3.5
scripts/       generate-characters.ts
supabase/      migrations/ (tables and RLS from section 7)
e2e/           Playwright tests
docs/spec.md   this file
```

**Repo and delivery.** Code lives on GitHub. GitHub Actions runs typecheck, lint, Vitest and Playwright on every push and pull request; `main` is protected and merges need green CI. CI starts a local Supabase first (`supabase start`, the Supabase CLI command that launches the local stack in Docker) so the sync tests and Playwright sign-in test have a backend. Cloudflare's GitHub integration builds every pull request to its own preview URL, built with the staging Supabase URL and key; merging to `main` deploys production with the production URL and key.

**Error reporting.** Sentry browser SDK, errors only: no session replay, no performance tracing, no session tracking, every `dataCollection` category off (Sentry 11's replacement for `sendDefaultPii: false`), and the user's email is never sent. A `beforeSend` and `beforeBreadcrumb` hook strips query strings and hashes from every URL, and the Sentry project setting that prevents storing IP addresses is turned on. Each release is tagged with its git commit.

**Accessibility.** Target WCAG 2.2 AA.
- Every card is a button with an accessible name listing the name and attributes in Italian (e.g. "Giulia: capelli castani lunghi, occhi verdi, occhiali"). This gives screen reader users the same information the picture gives everyone else, and doubles as reading practice.
- Fully playable by keyboard. Visible focus. The card detail view opens from a "Zoom" control on the focused card, as well as by long-press.
- Flipped state is shown by more than color (card face hidden, icon).
- `prefers-reduced-motion` disables the flip animation.
- Touch targets at least 44 × 44 px.

**Performance.**
- Initial JS under 250 KB gzipped, including the Supabase client and Sentry.
- LCP under 2.5 s in Lighthouse mobile.
- `step()` under 5 ms per action.

**Privacy.**
- Guests' game data and progress never leave the device.
- Accounts store email, profile, games, review log, cards. No analytics or trackers. The services that process data:
  - Supabase: database and sign-in. Stores everything listed above.
  - Cloudflare: hosting. Sees each visitor's IP address and requests, guests included.
  - AWS SES (or Resend if the fallback is used): sends the sign-in email. Sees the email address.
  - Sentry: error reports, with personal data stripped (see Error reporting).
- The Supabase region is chosen deliberately when the projects are created (EU if EU users are expected), and each provider's data processing agreement is accepted.
- There is no in-app account deletion in the MVP. The privacy note says so plainly and gives the email address for deletion requests (7.3).

**Cheating.** The CPU's secret is in the page's memory, so a determined player can find it with developer tools. Accepted: single player, nothing at stake.

**Hosting.** Cloudflare, deploying the Vite build as Workers static assets (Cloudflare's recommended path for new projects; requests to static assets are free and unlimited, and commercial use is allowed), served at `chie.parlaplay.games`. The Wrangler config sets `assets.not_found_handling = "single-page-application"` so deep links such as `/play` load the app instead of a 404. Supabase free tier for the backend. Chosen over Vercel because Vercel's free plan is non-commercial only and this app may make money later. Chosen over GitHub Pages for the same reason (its terms forbid running an online business or SaaS on it), and because Pages has no preview per pull request and no single-page-app fallback. Supabase's free tier pauses a project after 7 days without activity and allows 2 active free projects (staging and production use both). Accepted until launch: guests are unaffected and signed-in sync waits in the outbox until the project is resumed. Upgrade production to Supabase Pro ($25/month) at public launch; staging stays free and may pause.

---

## 10. Test plan and definition of done

### 10.1 Spec sign-off (before building)

1. Trace one full game on paper using only this doc. Every point where you had to guess becomes a `TBD:` or a fix.
2. The Italian-speaking reviewer goes through section 3 and every rendered string (17 questions, counting both brown-eyes wordings, their 34 answers, and every message in 3.7), checks all 18 words against the *Profilo della lingua italiana* (3.3), and picks the default brown-eyes word.
3. A developer reviews sections 4 and 7.
4. Tag the doc `v1`. After that, every change adds a dated line to the changelog at the bottom.

### 10.2 Tests

| Layer | Tool | What |
|---|---|---|
| Content | Vitest | All JSON passes Zod; every invariant in 3.2; every lexicon id and message key referenced exists; no id in `released-ids.json` is missing (3.6) |
| Engine | Vitest | Every cell of the transition table; every invariant in 4.4; the traced turns in 4.5 as tests; a level 1 ASK emits no `rating` or `agreementSlip` events, while CPU-question recognize ratings fire at both levels |
| Engine | fast-check | Random action sequences never break the invariants |
| Rendering | Vitest snapshot | All 17 question strings and 34 answers as golden strings, reviewed by the Italian speaker; answers lowercase the first letter |
| Grammar | Vitest | Each wrong verb and article is rejected with the right `SlotError`; each wrong adjective form is accepted as a slip with the right correction; a question with both an article error and an agreement error returns both `SlotError`s and logs only the noun's `again`; `occhi castani` and `occhi marroni` are both accepted and count as one question; `capelli marroni` is rejected with `meaning.wordChoice`; each `ShapeError` kind is returned by `parseTiles` |
| CPU | Vitest | Always finds a splitting question; never guesses wrong; same seed gives the same game |
| SRS | Vitest | Event → rating table; rebuild from log equals incremental state |
| Sync | Vitest + local Supabase | Guest upload is idempotent; games flush before review rows; two-device merge converges; a `cards` upsert with a smaller `log_count` is ignored; a new user gets a profile row; RLS blocks reading another user's rows |
| E2E | Playwright (Chromium, WebKit) | Full seeded round to a win; wrong guess loses; quitting records `abandoned`; sign-in with a code from the local inbox; reload mid-round resumes; `/play` loads directly |
| Manual | Real iPhone + Android phone | Board fits the visible area with browser toolbars showing, bottom sheet works, detail view opens by long-press, a full round is playable one-handed |
| Playtest | 3 or more A1 learners | Each plays 3 rounds; note rounds lost, minutes per round, and every confusing string |

### 10.3 Definition of done

- [ ] Deployed URL loads on an iPhone and plays a full round.
- [ ] Deployed URL loads on an Android phone and plays a full round.
- [ ] All 24 characters render with art that matches their attributes (spot check against data for every character).
- [x] Level 1 and Level 2 both playable to a win and a loss.
- [x] A grammar mistake at Level 2 shows feedback naming the rule and appears in the Mistakes tab; an agreement slip shows the correct form and also appears there.
- [ ] Every lexicon entry has a `level` from the Profilo check.
- [x] Guest progress survives a reload.
- [x] Signing in with guest progress uploads it; signing in on a second browser shows the same Progress.
- [x] RLS test proves user A cannot read user B's `review_log`.
- [ ] A sign-in code email reaches an address outside the team (SES out of the sandbox, or Resend as the fallback).
- [ ] The privacy note is live and gives the account deletion email; one deletion has been tested on staging.
- [ ] A pull request preview signs in against staging, never production.
- [ ] Sentry receives a test error from production, with no personal data in it.
- [ ] At least 3 A1 learners have playtested, and their findings are logged and triaged.
- [x] `engine/` coverage at or above 90%; CI green.
- [x] Lighthouse mobile: LCP under 2.5 s, accessibility score at least 95.
- [ ] Every `TBD:` in this doc is resolved or explicitly moved to section 11.
- [x] README covers run, test, deploy, and adding a character.

### 10.4 Milestones

Full time on weekdays, starting Wednesday, October 7, 2026, the target launch is **Thursday, October 29**. Steps that wait on other people (Italian review, SES approval, playtests) are the likeliest to slip, so they are started early. Playtests are on day 12, leaving four working days to fix what they find.

| Day | Date | Deliverable | Done when |
|---|---|---|---|
| 1 | Wed Oct 7 | Spec review: section 3, the messages in 3.7, the Profilo vocabulary check and the brown-eyes default to the Italian speaker; sections 4 and 7 to a developer; paper-trace one game. Add DNS for `chie.parlaplay.games` | Reviews requested; trace gaps logged; subdomain resolves |
| 2 | Thu Oct 8 | Repo scaffold: pnpm, Vite, React Router, Tailwind, ESLint, Prettier, Vitest, Playwright, GitHub Actions (with local Supabase), Cloudflare previews and SPA fallback, Sentry with URL scrubbing. Create the staging and production Supabase projects. Verify the domain in SES and request production access; open a Resend account as the fallback | CI green on an empty app; a pull request gets a preview URL pointing at staging |
| 3 | Fri Oct 9 | Character generator, content JSON, messages, placeholder SVG layers (high hat, large eyes); fold in review feedback | Content tests pass; all 24 characters render; spec tagged `v1` |
| 4-5 | Mon Oct 12 to Tue Oct 13 | Engine: types, `step`, templates, grammar, smart CPU | All engine tests pass, coverage at 90% |
| 6 | Wed Oct 14 | Board UI, flipping, secret card, SVG composer, bottom sheet, card detail view | 24 cards fit a real phone's visible area with the sheet collapsed |
| 7 | Thu Oct 15 | Level 1 picker, Level 2 tile builder, feedback messages | Can ask and read answers on a real iPhone |
| 8 | Fri Oct 16 | CPU turn, Sì/No, guessing, round end, Quit round, Continue round | Full round playable to win and loss; quitting records `abandoned` |
| 9 | Mon Oct 19 | Progress store, review log, FSRS, Progress screen | SRS tests pass; Mistakes and Due tabs show real data |
| 10 | Tue Oct 20 | Supabase migrations (tables, RLS, triggers), sign-in code through SES or Resend, sync, outbox, sign-out warning, guest nudge | Sync and RLS tests pass; a code email reaches an outside address |
| 11 | Wed Oct 21 | Accessibility, states from 8.2, privacy note, real device pass, playtest build on staging | Manual checklist done; playtest build ready |
| 12 | Thu Oct 22 | Playtests with 3 or more A1 learners | Findings logged and triaged |
| 13-15 | Fri Oct 23, Mon Oct 26, Tue Oct 27 | Fix playtest findings | Every must-fix finding fixed |
| 16 | Wed Oct 28 | Production setup (Supabase Pro, final SES or Resend check), README, DoD sweep | Every 10.3 box checked |
| 17 | Thu Oct 29 | Launch | Production URL live at `chie.parlaplay.games` |

---

## 11. Future work and decision log

### 11.1 Future work

**LLM features.** An LLM could explain why an answer was wrong in friendlier language, generate new characters and themed decks, or grade free-typed questions. It stays out of the MVP because the template engine already gives exact, testable feedback, and an LLM adds cost, latency, and the risk of teaching wrong Italian. If added, it should only explain or generate content that is then validated by the engine, never decide truth.

**Free typing (Level 3).** Players type questions; the input is normalized (case, accents, punctuation) and matched against the 16 templates' rendered forms, with near misses mapped to `SlotError`s. This needs a tolerant tokenizer and careful accent handling (`e` vs `è`). The template system was built so this is an added parser, not a rewrite.

**Multiplayer.** Two humans play live (WebSocket via Supabase Realtime) or asynchronously (turns stored in a table). The engine's `step` moves to the server as the authority, and clients send the same `Action` types. Secrets must never be sent to the opposing client, so state needs a per-player view.

**Account deletion.** An in-app "Delete my account" button that calls a small server-side function with the service role to delete the auth user; the cascading foreign keys remove everything else. Replaces the manual email process the MVP launches with (7.3).

**Colorblind mode.** A setting that adds Italian labels to each card (e.g. "capelli castani lunghi, occhi verdi"), so hair and eye color never depend on seeing color. Regular mode stays label-free to keep the reading challenge.

**SRS-weighted CPU and the daily new-card limit.** When the CPU starts choosing questions from the learner's due words, bring back a daily limit on new cards (replayed per `localDay`, see section 6), since gameplay will then follow the schedule.

**Audio.** The game only ever says 17 questions and 34 answers, so the first step is 51 clips generated once with a high-quality TTS voice and shipped as files. That avoids the uneven browser voices on iOS. Level 4 (audio only) and speech input build on it.

**Offline.** A service worker that caches the app and content, making it an installable PWA that guests can play with no connection.

Also queued: final character art, colorblind mode, Easy CPU setting, championship mode (first to 5 wins, from the official rules), Google sign-in, SRS-weighted CPU questions, Level 4 audio-only, speech input, themed decks, flashcard review mode.

### 11.2 Decision log

| Id | Decision | Reason |
|---|---|---|
| D1 | Questions come only from templates; no free typing in MVP | Grammar checking stays exact and fully testable |
| D2 | Every inflected form is stored as data; no inflection code | Small vocabulary; data is easier to review than rules |
| D3 | A wrong guess loses the round | It is the official board game rule; a confirm dialog guards against accidental guesses |
| D4 | The CPU always uses the true answer, even if the player answered wrongly | The CPU never makes an impossible guess; the mistake is still logged |
| D5 | The review log is append-only and the source of truth; cards are a cache | Sync becomes a conflict-free union, and scheduling can be rebuilt |
| D6 | Guest mode is local only (no anonymous Supabase accounts) | No server rows or cost for people who never sign up |
| D7 | Correct Sì/No answers are capped at `hard` | A yes/no answer can be right by luck |
| D8 | The CPU plays smart (best split every time) | A real opponent makes the player's questions matter; Easy mode can come later |
| D9 | Placeholder SVG art for the MVP | Unblocks the build; final art drops in by file name |
| D10 | A 6-digit email code is the only sign-in (changed from magic link in v0.4) | No passwords; works when the email opens in another app or browser, and guest data stays in the tab that asked |
| D11 | Host on Cloudflare (Workers static assets) | Free tier allows commercial use, static requests are unlimited |
| D12 | Single rounds, no match score | Keeps the MVP small; championship mode is future work |
| D13 | No audio in the MVP | Browser voices are uneven; reading practice comes first |
| D14 | Online only, no service worker | Less to build and debug; offline is future work |
| D15 | Sign-in emails sent through AWS SES, with Resend as the fallback | Supabase's built-in sender is for testing only; SES approval can be slow or refused |
| D16 | Local Supabase for dev and tests, a staging project for previews, a production project | Tests run without the network; previews never touch real data; free tier allows 2 projects |
| D17 | Accept free-tier pausing until launch | Guests are unaffected; Pro costs $25/month |
| D18 | Tailwind CSS and a bottom-sheet layout | Fast mobile layouts; the board never shrinks |
| D19 | Sentry for errors only | See real crashes without tracking people |
| D20 | Characters come from a seeded generator script | Balance rules are met by construction |
| D21 | Content ids are permanent; games store a content version | Review history never points at missing words |
| D22 | pnpm, ESLint, Prettier, React Router, GitHub Actions, a preview per pull request | Closest to the industry standard for this stack |
| D23 | Vocabulary is checked against the *Profilo della lingua italiana* | It is the CEFR word-level reference for Italian; fitting the board does not make a word A1 |
| D24 | Adjective agreement errors are soft at Level 2 | A1 syllabi disagree on whether learners must produce agreement; showing the fix teaches without punishing |
| D25 | `occhi castani` and `occhi marroni` are both accepted; `capelli marroni` gets a word-choice hint | Both are common for eyes and exams name neither; rejecting either would mark real Italian wrong |
| D26 | Hats are drawn high so short hair always shows | Every attribute must be visible or the game is unfair |
| D27 | Long-press detail view with no text; colorblind mode with labels is future work | Small details become visible without giving away the Italian |
| D28 | Account deletion by email request at launch | Meets data-protection duties with no code; in-app deletion later |
| D29 | Hosting stays on Cloudflare, not GitHub Pages | Pages forbids running a business or SaaS, has no previews and no SPA fallback |
| D30 | App and email on `chie.parlaplay.games` | A studio domain bought for this and future language games, each on its own subdomain; its DNS is on Cloudflare, so the Worker custom domain and the SES records live in one place |
| D31 | Keep the server `cards` table, guarded by `log_count` | Ready for server features like due-word emails; stale devices can't overwrite newer state |
| D32 | No daily new-card limit in the MVP | Gameplay doesn't follow the schedule yet, so a limit would only discard data |
| D33 | "Quit round" button; starting a new round abandons the saved one | Every round ends in a recorded result |
| D34 | The `games` row is written at START | Review rows always have a game to point to |
| D35 | Unsynced sign-out warns and lets the user choose | Shared devices still work; progress isn't lost silently |
| D36 | Launch moved to October 29 | Four working days to fix playtest findings |

---

## References

- Spinelli, B. and Parizzi, F. (2010). *Profilo della lingua italiana. Livelli di riferimento del QCER A1, A2, B1, B2*. La Nuova Italia.
- Università per Stranieri di Perugia, CELI required competences: https://www.unistrapg.it/sites/default/files/docs/certificazioni/celi-i-competenze-richieste.pdf
- Istituto Italiano di Cultura di Buenos Aires, A1 content: https://iicbuenosaires.esteri.it/wp-content/uploads/2025/05/Contenuti-Livello-A1.pdf
- Guess Who official rules summary: https://www.geekyhobbies.com/guess-who-board-game-rules-and-instructions-for-how-to-play/
- Daily Italian Words, castano vs marrone: https://dailyitalianwords.com/castano-vs-marrone-in-italian/
- GitHub Pages limits and prohibited uses: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

---

## Changelog

- 2026-10-06: v0 draft.
- 2026-10-06: v0.1. Named the game Chi è?; wrong guess loses (official rule); smart CPU; placeholder art; magic link only; no account deletion in MVP; Cloudflare hosting; resolved vocabulary, guess-proofing and screen reader TBDs.
- 2026-10-06: v0.2. No audio; online only; AWS SES for magic links; local plus one production Supabase; Tailwind and bottom sheet; Sentry errors only; character generator; permanent content ids; stack, folders, CI and deploy flow; calendar milestones to October 22; playtest plan.
- 2026-10-06: v0.3. Vocabulary checked against the Profilo with a `level` field per word; adjective agreement errors at Level 2 become soft slips; `slip` rows in the review log; references section.
- 2026-10-06: v0.4. Spec review fixes. Both `castani` and `marroni` accepted for eyes; high hats, large eyes and a long-press detail view; 6-digit email code replaces the magic link; Resend as SES fallback; staging Supabase for previews; `chie.1412labs.com`; account deletion by email and a privacy note; Quit round; games row at START and ordered outbox flush; unsynced sign-out warning; guest storage persistence and nudge; `cards` stale-write guard and profile trigger; no daily new-card limit; feedback message catalogue (3.7); `SlotError`, `ShapeError` and `Feedback` types; slot-based tile builder; answers lowercase the first letter; `ratedThisTurn` reset; released-ids snapshot; SPA fallback; Sentry URL scrubbing; board fit measured after browser toolbars; launch moved to October 29.
- 2026-10-06: v0.5. App and email domain is `chie.parlaplay.games` (D30); `1412labs.com` was not ours.
- 2026-10-07: Desktop layout split out into `spec-desktop.md` (v0.1 draft); 8 links to it.
