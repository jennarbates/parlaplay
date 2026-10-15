# Chi è stato?: Spec

| | |
|---|---|
| Status | v0.1 draft (2026-10-15). Becomes `v1` after the Italian review and paper trace in GS 11.1 |
| Product name | **Chi è stato?** ("Who did it?"). Written `Chi è stato?` in the app and `giallo` in code (a *giallo* is an Italian mystery story). Never use "Cluedo", "Clue" or any other Hasbro title in public branding, as with Chi è? |
| Audience for this doc | Whoever builds, reviews, or tests Chi è stato? |
| Builds on | `it.md` (Chi è?'s MVP spec) for the engine pattern, the learning model, the backend and the Level 1 and Level 2 split; `it-desktop.md` (cited as "DS") for desktop; `docs/spec.md` (the platform spec) for accounts, storage and sync. GS 8 lists every platform change this game needs |

Conventions: each section leads with the decision, then the reason. `TBD:` marks an open question. Italian strings in this doc are the exact strings the app must produce. Sections here are `GS n` and decisions `GD n`, so they never clash with `it.md` sections, DS sections or platform decisions. Backlog cards are in `planning/backlog.md`, epic **Chi è stato?**.

---

## GS 1. Scope and non-goals

**Goal.** A second Italian game at `/it/giallo` where the learner solves a small theft by questioning suspects, and every question is a checked piece of Italian built around an interrogative: choosing the right question word for what they want to know, and changing it to fit the sentence (agreement, a preposition in front, elision).

**Why a second game.** Chi è? only ever asks yes/no questions, so a learner who finishes it has never produced *dove*, *quando*, *con chi* or *quante*. Open questions need answers that are facts, not Sì or No, and a mystery is a natural reason to ask them.

**Target user.** The adult A1 to A2 learner of `it.md` §1, on a phone (portrait) or a laptop, in 5 to 15 minute sessions. UI chrome is in English; game content is in Italian.

**Success criteria.**

1. `/it/giallo/play` plays case 1 to a solved accusation on an iPhone (Safari), an Android phone (Chrome) and a laptop at 1024 × 640.
2. Every question word form in GS 3 can be produced at Level 2, and every wrong form in the GS 3.2 table gets the feedback it names.
3. The content invariants of GS 5.4 pass for every case and every seeded variant.
4. Chi è?'s tests pass without being edited, and a Chi è? round saved before this ships still resumes.
5. Every item in the definition of done (GS 11.3) is checked.

**In and out.**

| In | Out (future, GS 12.1) |
|---|---|
| 3 cases, each with seeded variants (GS 4.3) | A case editor, user-made cases, a daily case |
| Level 1: tap ready-made questions with English hints | Free-typed questions |
| Level 2: build questions from tiles | Audio of any kind |
| The 12 question-word lemmas of GS 3.1 | Indirect questions (*Mi sa dire dove…*), *quale* vs *che* as a determiner |
| The inspector's recognition questions (GS 6) | Questions to the learner in the past tense they must produce |
| FSRS cards for question words, shared with Chi è?'s Progress | Stored star scores, streaks, a case leaderboard |
| Phone and desktop layouts, keyboard play | Multiplayer, hints that cost questions |

Anything not in the left column is out. New ideas go to GS 12.1, not into the build.

---

## GS 2. Game rules

**The case.** Each case has a setting (*Villa Rosa*), a stolen thing (*la torta*), 4 suspects, 1 witness and a scene with 1 or 2 pieces of evidence. Hidden facts: **chi** (which suspect took it), **dove** (which room it was hidden in) and **quando** (which of three time slots it was taken in). The slots are always `tra le sette e le otto`, `tra le otto e le nove` and `tra le nove e le dieci`.

**A turn.** The learner selects one person (a suspect or the witness) and asks them one question. The person answers in a full first-person Italian sentence, and the answer goes into the notebook under that person. Everyone is addressed with formal *Lei*, so every question uses the third person singular (`Dov'era…?`, `Che cosa ha visto…?`).

**Question budget.** A case allows **15 accepted questions**. A question that is rejected (GS 5.3) costs nothing. A duplicate costs nothing and shows the earlier answer again. At 0 the learner must accuse.

**Truth.** The witness and innocent suspects always tell the truth. The culprit lies on the frames the case marks as lies (usually their alibi for the crime slot) and tells the truth everywhere else. Every lie is contradicted by at least one truthful answer (GS 5.4).

**The inspector's questions.** After every 4th accepted question, Ispettrice Bassi asks the learner one question about the case in Italian (GS 6). It is free and never uses the budget.

**Accusing.** At any time, the learner taps **Accusa**, picks one suspect, one room and one slot, and confirms. The confirm sheet shows the sentence it will say, e.g. `È stata Marta, in biblioteca, tra le otto e le nove.`

- All three right: case solved. Stars: 3 if 9 or fewer questions were used, 2 if 10 to 12, 1 if 13 to 15.
- Any of the three wrong: case closed unsolved, and the solution is shown with the answers that proved it.

**Notebook.** Every answer is kept, grouped by person and in order. The learner can mark any suspect as cleared (struck through) and unmark them. Marking is free, reversible and never checked, like flipping in Chi è?.

**Edge cases.**

| Situation | Rule |
|---|---|
| Learner asks a question already asked of the same person | Rejected, budget unchanged, the earlier answer shown again |
| Same question to a different person | Allowed, a new question |
| `che cosa`, `cosa` and `che` for the same frame | One question; asking with another of the three is a duplicate (GD4) |
| Grammatical but meaningless (`Quanti era tra le otto e le nove?`) | Rejected, budget unchanged, no mistake logged, feedback `Non capisco la domanda.` |
| A known learner error from GS 3.2 (`Chi è questo ombrello?`) | Rejected, budget unchanged, mistake logged, feedback names the rule |
| Agreement or `qual'` slip (`Quanti persone…?`) | Accepted and answered; the correct form is shown with the answer and the slip goes to the Mistakes tab (as `it.md` §2) |
| Budget reaches 0 | Only Accusa is available; the sheet says `Hai finito le domande. Chi è stato?` |
| Accusing a suspect the learner marked cleared | Allowed; the confirm sheet says they are marked cleared |
| Quit case, or starting another case while one is saved | The saved case is recorded as `abandoned` and discarded, as Chi è?'s Quit round |
| Reload mid-case | Resumes from the saved state, unless the giallo content version changed (GS 4.4) |
| An inspector question is pending | Asking and accusing wait until it is answered |

There is no timer. Each case stands alone.

---

## GS 3. Question words

This section is the grammar the game teaches. The Italian reviewer signs off on every string in it (GS 11.1).

### GS 3.1 Lemmas and forms

Each lemma is a lexicon entry with `pos: "qword"` (GS 4.1) and is one FSRS card per direction (GS 7).

| Id | Forms (tile texts) | Asks for | Example |
|---|---|---|---|
| `q.chi` | `chi` | a person | `Chi ha visto tra le otto e le nove?` |
| `q.cosa` | `che cosa`, `cosa`, `cos'`, `che` | a thing or an action | `Che cosa faceva tra le otto e le nove?` |
| `q.dove` | `dove`, `dov'` | a place | `Dov'era tra le otto e le nove?` |
| `q.quando` | `quando` | a time | `Quando è arrivata alla villa?` |
| `q.perche` | `perché` | a reason | `Perché è arrivata alla villa?` |
| `q.come` | `come`, `com'` | a manner or means | `Com'è arrivato alla villa?` |
| `q.quale` | `quale`, `quali`, `qual` | which one(s) | `Qual è il Suo lavoro?`, `Quali scarpe portava?` |
| `q.quanto` | `quanto`, `quanta`, `quanti`, `quante`, `quant'` | how much, how many | `Quante persone c'erano in cucina?` |
| `q.con_chi` | `con` + `chi` | a companion | `Con chi era tra le otto e le nove?` |
| `q.di_chi` | `di` + `chi` | an owner | `Di chi è questo ombrello?` |
| `q.a_che_ora` | `a` + `che` + `ora` | a clock time | `A che ora è arrivata alla villa?` |
| `q.da_dove` | `da` + `dove` | an origin | `Da dove viene?` |

The last four are lemmas of their own because the preposition is what the learner gets wrong, not the word after it. At Level 2 they are built from a preposition tile (`con`, `di`, `a`, `da`) plus the question-word tiles; `ora` is a tile only in the `a che ora` frame.

`qual'` is also a tile, as a distractor (GS 3.2).

### GS 3.2 The rules, and what happens when one is broken

| Rule id | Rule | Right | Wrong | Result of the wrong form |
|---|---|---|---|---|
| `agree.quanto` | *quanto* agrees with its noun | `Quante persone…?`, `Quanti anni…?`, `Quanta torta…?`, `Quanto tempo…?` | `Quanti persone…?` | Slip: accepted, correct form shown, slip row logged |
| `agree.quale` | *quale* is plural *quali* before a plural noun | `Quali scarpe portava?` | `Quale scarpe portava?` | Slip |
| `trunc.qualE` | *qual è* is truncation, never written with an apostrophe | `Qual è il Suo lavoro?` | `Qual'è il Suo lavoro?` | Slip |
| `elide.consonant` | An elided form (`dov'`, `com'`, `cos'`, `quant'`) only goes before a vowel | `Dov'era…?` | `Dov' ha visto…?` | Rejected, mistake logged |
| `prep.diChi` | Ownership needs *di* | `Di chi è questo ombrello?` | `Chi è questo ombrello?` | Rejected, mistake logged |
| `prep.conChi` | Company needs *con* | `Con chi era…?` | `Chi era con…?` is not built by the tiles; `Chi era tra le otto e le nove?` is meaningless | Rejected as nonsense (no mistake) |
| `prep.aCheOra` | A clock time needs *a* | `A che ora è arrivata…?` | `Che ora è arrivata…?` | Rejected, mistake logged |
| `prep.daDove` | Origin needs *da* | `Da dove viene?` | `Dove viene?` | Rejected, mistake logged |
| `word.choice` | The word must fit the frame's meaning | `Perché è arrivata alla villa?` | `Quanto è arrivata alla villa?` | Rejected as nonsense (no mistake) |

**Not errors.** These are accepted with no slip, because they are correct Italian (GD4, GD5):

- `che cosa`, `cosa` and `che` are all accepted wherever one is.
- Unelided `dove era`, `come è`, `cosa è` are accepted; the answer card shows the elided form as the usual spelling.
- `quando` and `a che ora` are both accepted in the arrival frame; they are different questions with different answers (`Sono arrivata dopo cena.`, `Sono arrivata alle sette.`).

Feedback strings live in the giallo `messages.json` (GS 4.1), keyed by rule id. `TBD:` the reviewer writes or approves each one; drafts:

| Rule id | Feedback (English chrome, Italian in italics) |
|---|---|
| `agree.quanto` | `*Persone* is feminine plural, so *quante*.` |
| `agree.quale` | `*Scarpe* is plural, so *quali*.` |
| `trunc.qualE` | `*Qual è* never takes an apostrophe.` |
| `elide.consonant` | `Use *dove* here: *dov'* only goes before a vowel.` |
| `prep.diChi` | `To ask whose, Italian says *di chi*.` |
| `prep.aCheOra` | `To ask what time, Italian says *a che ora*.` |
| `prep.daDove` | `To ask where from, Italian says *da dove*.` |

---

## GS 4. Content model

All giallo content lives in `src/languages/it/giallo/content/`, validated with Zod at build time like Chi è?'s. Every Italian string is written out as data; the only code that changes text is joining tiles (GS 5.3) and filling a person's name and gender variant into a template.

### GS 4.1 Lexicon additions

```ts
const QWord = z.strictObject({
  id: z.string(),                           // "q.quanto"
  pos: z.literal("qword"),
  gloss: z.string(),                        // "how much, how many"
  prep: z.string().optional(),              // "con" for q.con_chi
  forms: z.array(z.strictObject({
    text: z.string(),                       // "quante"
    key: z.string(),                        // "fp"; "base" for words with one form
    elided: z.boolean().optional(),         // true for dov', com', cos', quant'
  })),
  level: z.enum(["A1", "A2"]),
});
```

`lexicon.json` for the giallo holds the 12 qwords, the prepositions `con`, `di`, `a`, `da` and the tile `ora`. Ids are disjoint from Chi è?'s and from every other language's (platform D21): question words start `q.`, prepositions `prep.`.

### GS 4.2 Frames

A frame is one question body and the question words that make sense with it. Every question is `[prep?] [qword form] [body]`.

```ts
const Frame = z.strictObject({
  id: z.string(),                           // "f.at.slot"
  body: z.record(z.enum(["m", "f"]), z.string()), // "era {slot}?" ; gender of the person asked
  vowelStart: z.boolean(),                  // body starts with a vowel (elision allowed)
  noun: z.strictObject({ gender: z.enum(["m", "f"]), number: z.enum(["sg", "pl"]) }).optional(),
  slotParam: z.boolean(),                   // body takes one of the three time slots
  asks: z.array(z.strictObject({            // accepted question words and the fact each asks
    qword: z.string(),                      // "q.dove"
    fact: z.string(),                       // "where"
  })),
  teaches: z.array(z.strictObject({         // known errors: built as given, rejected with a rule
    built: z.string(),                      // "q.chi" (without its preposition)
    rule: z.string(),                       // "prep.diChi"
  })).optional(),
  hint: z.string(),                         // English for Level 1, per accepted qword: see below
});
```

The frames of the MVP:

| Frame | Body | Accepted | Fact |
|---|---|---|---|
| `f.at.slot` | `era {slot}?` | `dove`, `con chi` | where they were in that slot, or who with |
| `f.doing.slot` | `faceva {slot}?` | `che cosa` | what they were doing |
| `f.saw.slot` | `ha visto {slot}?` | `chi`, `che cosa` | a person or a thing they saw |
| `f.arrive` | `è arrivato/arrivata alla villa?` | `quando`, `a che ora`, `come`, `perché`, `con chi` | when, what time, how, why, with whom |
| `f.stolen.torta` | `è sparita la torta?` (each case has its own) | `quando` | when the thing went missing (the witness) |
| `f.from` | `viene?` | `da dove` | origin (`teaches`: `dove` → `prep.daDove`) |
| `f.job` | `è il Suo lavoro?` | `qual` | job |
| `f.shoes` | `scarpe portava?` (fp) | `quali` | shoes worn |
| `f.people.cucina.slot` | `persone c'erano in cucina {slot}?` (fp) | `quante` | how many people were in a room |
| `f.age` | `anni ha?` (mp) | `quanti` | age |
| `f.time.garden` | `tempo è rimasto/rimasta in giardino?` (ms) | `quanto` | how long |
| `f.cake` | `torta ha mangiato?` (fs) | `quanta` | how much cake (flavour, and a joke) |
| `f.owner.umbrella`, `f.owner.keys` | `è questo ombrello?`, `sono queste chiavi?` | `di chi` | owner of a piece of evidence |

Example, with the teaching combo for `prep.diChi`:

```json
{ "id": "f.owner.umbrella", "body": { "m": "è questo ombrello?", "f": "è questo ombrello?" },
  "vowelStart": true, "slotParam": false,
  "asks": [{ "qword": "q.di_chi", "fact": "owner" }],
  "teaches": [{ "built": "q.chi", "rule": "prep.diChi" }],
  "hint": "Whose umbrella is this?" }
```

In `f.at.slot` one body asks two facts: the question word decides which, which is exactly the lesson.

`TBD:` bodies starting with `ha` count as `vowelStart: false`, so `cos'ha visto` is rejected with `elide.consonant`. `Cos'ha` is common in informal writing; the reviewer decides whether it is accepted instead.

### GS 4.3 Cases

All cases are one array in `cases.json`. Case 1 is written: `src/languages/it/giallo/content/cases.json`.

```ts
const Gendered = z.union([z.string(), z.strictObject({ m: z.string(), f: z.string() })]);
// a plain string when the text is the same for a man and a woman

const Case = z.strictObject({
  id: z.string(),                           // "case.torta"
  title: z.string(),                        // "La torta sparita"
  setting: z.string(),                      // "Villa Rosa"
  stolen: z.string(),                       // "la torta"
  difficulty: z.int().min(1).max(3),
  roles: z.array(z.string()),               // story roles: "r.culprit", "r.pairA", ..., "r.witness"
  suspects: z.array(z.string()),            // the roles that can be accused
  jobs: z.array(z.strictObject({ id: z.string(), text: Gendered })), // one per suspect
  witnessJob: Gendered,                     // "il maggiordomo" / "la governante"
  rooms: z.array(z.strictObject({ id: z.string(), name: z.string(), in: z.string() })),
                                            // { "room.cucina", "la cucina", "in cucina" }
  hidePlaces: z.array(z.string()),          // room ids the seed may pick as dove
  slots: z.array(z.string()).length(3),     // the three time slots
  crimeSlots: z.array(z.int().min(0).max(2)), // slots the seed may pick as quando
  evidence: z.array(z.string()),            // owner frames shown on the scene card
  frames: z.array(z.string()),              // frames that can be asked in this case
  answers: z.array(z.strictObject({
    who: z.string(),                        // a role, a job id, or "*" for anyone
    frame: z.string(),
    slot: z.enum(["crime", "other"]).optional(), // for frames that take a slot
    qword: z.string(),
    text: Gendered,                         // the speaker's gender picks m or f
    lie: z.boolean().optional(),
    contradictedBy: z.array(z.string()).optional(), // answer keys; required when lie is true
    proves: z.array(Proof).optional(),
  })),
  default: z.string(),                      // answer for an accepted question with no entry
});

const Proof = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("time"), requires: z.array(z.string()).optional() }),
  z.strictObject({ kind: z.literal("place"), requires: z.array(z.string()).optional() }),
  z.strictObject({ kind: z.literal("clears"), role: z.string(), requires: z.array(z.string()).optional() }),
]);
```

**Roles and jobs are cast separately.** The seed casts a character in each role, and separately gives each suspect a job. Story roles (who did it, who alibis whom) and jobs (the cook, the gardener) are independent, so a replay never teaches "it is always the cook". Answers about the crime are keyed by role; answers about a person's life (where they come from, their age, how they arrived) are keyed by job.

**Lookup.** For a question to a person, the engine takes the first answer whose `who` matches, in this order: their role, their job, `"*"`. With none, it answers `default`. `slot` is `"crime"` when the question's slot is the case's crime slot, `"other"` otherwise.

**Placeholders.** `{r.culprit}`, `{r.pairA}` and every other role become the name cast in that role; `{job}` the speaker's job; `{hide}` the hiding room's `in` form (`in biblioteca`); `{crime}` the crime slot. An answer key is `who:frame:slot:qword`, with `-` for no slot (`r.pairB:f.at.slot:crime:q.con_chi`). `requires` lists answer keys that must also be in the notebook before the proof counts: an innocent suspect is cleared only by their own alibi plus the answer that confirms it.

**Seeded variants.** The seed picks 5 distinct characters for the 5 roles, a job for each suspect, one hiding place and one crime slot. Case 1 has 3 hiding places × 3 crime slots = 9 variants of its logic, times every casting and job assignment. Characters are Chi è?'s 24 (`it.md` 3.2), so they render with Chi è?'s `Face` component and need no new art (GD13). The speaker's gender comes from the character's `gender` attribute.

**The three cases.**

| Id | Title | Setting | Stolen | Difficulty |
|---|---|---|---|---|
| `case.torta` | La torta sparita | Villa Rosa, a birthday dinner | la torta | 1: the witness gives the time directly; 5 questions solve it |
| `case.valigia` | La valigia sul treno | the night train to Napoli | una valigia | 2: the time needs two answers together |
| `case.ricetta` | La ricetta segreta | Trattoria da Nino | la ricetta della nonna | 3: two suspects lie |

**Case 1, the story.** Everyone has dinner in the dining room in the two slots that are not the crime slot. In the crime slot, two suspects (`r.pairA`, `r.pairB`) wash up together in the kitchen and each confirms the other; one (`r.seen`) reads the paper alone in the dining room, and the witness sees them there through the door; the culprit says they were having a coffee in the dining room, which both `r.seen` (`Non è entrato nessuno.`) and the witness contradict. The witness also gives the time the cake went missing and has seen cake crumbs where it was hidden. The shortest solution, found by the checker:

| Who | Question | Answer (one variant) | Proves |
|---|---|---|---|
| witness | `Quando è sparita la torta?` | `È sparita tra le otto e le nove.` | time |
| witness | `Che cosa ha visto tra le otto e le nove?` | `Ho visto delle briciole di torta in biblioteca.` | place |
| witness | `Chi ha visto tra le otto e le nove?` | `Ho visto Paolo in sala da pranzo, dalla porta. Leggeva il giornale.` | clears `r.seen` |
| `r.pairA` | `Con chi era tra le otto e le nove?` | `Ero con Giulia.` | with the next: clears both |
| `r.pairB` | `Con chi era tra le otto e le nove?` | `Ero con Luca.` | |

`TBD:` the full text of cases 2 and 3, written with the Italian reviewer (card PLAY-098).


### GS 4.4 Ids and versions

The giallo has its own `version.json`. Bumping it discards saved giallo cases only; a saved Chi è? round is untouched (GD3). Released ids are kept in `released-ids.json`, as Chi è?'s (`it.md` 3.6): an id is never reused for something else, and a removed qword is marked `retired`.

---

## GS 5. Engine contract

`src/languages/it/giallo/engine/` is pure TypeScript with no React, DOM or time access, like Chi è?'s. One function moves a case forward: `step(state, action, content) → { state, events }`. Randomness comes only from the seed.

### GS 5.1 Types

```ts
type Phase = "asking" | "inspector" | "accusing" | "ended";

type CaseState = {
  caseId: string;
  seed: number;
  level: 1 | 2;
  cast: Record<string, string>;             // role -> character id
  hide: number;                             // room index
  crime: 0 | 1 | 2;                         // slot index
  phase: Phase;
  budget: number;                           // starts at 15
  notebook: NotebookEntry[];                // accepted questions and answers, in order
  cleared: string[];                        // roles the learner marked, never read by the engine's logic
  inspector?: InspectorQuestion;            // set while phase is "inspector"
  result?: { solved: boolean; stars?: 1 | 2 | 3 };
};

type Built = { prep?: string; qword: string; form: string; frame: string; slot?: number; to: string };

type Action =
  | { type: "ASK"; built: Built }
  | { type: "ANSWER_INSPECTOR"; choice: string }
  | { type: "MARK"; role: string; cleared: boolean }
  | { type: "ACCUSE"; role: string; room: number; slot: number }
  | { type: "QUIT" };

type Event =
  | { type: "asked"; entry: NotebookEntry; slip?: SlotError }
  | { type: "rejected"; reason: "nonsense" | "duplicate" | "grammar"; errors?: SlotError[] }
  | { type: "rating"; lexiconId: string; direction: "recognize" | "produce"; rating: "again" | "hard" | "good" }
  | { type: "slip"; error: SlotError }
  | { type: "inspectorAsked"; question: InspectorQuestion }
  | { type: "ended"; solved: boolean; stars?: 1 | 2 | 3 };
```

`SlotError` is Chi è?'s type (`it.md` 4.1), with `rule` taking the ids of GS 3.2.

### GS 5.2 Transition table

| Phase | Action | Next phase | Notes |
|---|---|---|---|
| asking | ASK, accepted | asking, or inspector after every 4th accepted | budget − 1 |
| asking | ASK, rejected | asking | budget unchanged |
| asking | MARK | asking | |
| asking | ACCUSE | ended | |
| asking, budget 0 | ASK | asking | rejected; only ACCUSE moves on |
| inspector | ANSWER_INSPECTOR | asking | |
| inspector | anything else but MARK and QUIT | inspector | ignored |
| any but ended | QUIT | ended | result `abandoned` in the games row |
| ended | anything | ended | ignored |

### GS 5.3 ASK validation order

1. **Shape.** The built tiles parse as `[prep?] [qword form] [body]`, the person exists, and the slot is given when the frame needs one. Otherwise rejected (`shapeError`, no rating).
2. **Elision.** An `elided` form before a body with `vowelStart: false` is rejected with `elide.consonant`; `again` for the qword's produce card.
3. **Known errors.** If `(prep, qword)` matches a frame's `teaches` entry, rejected with that rule; `again` for the lemma the learner should have built (`q.di_chi` for `prep.diChi`).
4. **Meaning.** If `(prep, qword)` is not in the frame's `asks`, rejected as `nonsense`, no rating, feedback `Non capisco la domanda.`
5. **Duplicate.** Same person, frame, slot and qword lemma already in the notebook: rejected as `duplicate`, earlier answer shown.
6. **Agreement and truncation.** A wrong form of the right lemma (`quanti` for `quante`, `quale` for `quali`, `qual'` for `qual`) is accepted as a slip: the correct form is shown and a slip row logged; the lemma's produce card is not rated.

On success: look up the answer for `(role, frame, slot, qword)`, or the case's `default`; fill placeholders; append to the notebook; budget − 1; emit `asked` and, at Level 2 with no slip, `good` for the qword's produce card. At Level 1 nothing is rated (exposure only, as Chi è?).

When step 2 or 3 fails, step 6 is still checked, so feedback shows every problem at once (as `it.md` 4.3).

Joining: an `elided` form joins the body with no space (`dov'` + `era` = `dov'era`); everything else with one space; the first letter is capitalised.

### GS 5.4 Solver and invariants (each becomes a test)

`solve(case, cast, hide, crime, notebook)` returns what the notebook proves: `{ time: boolean, place: boolean, cleared: role[] }`, applying every `proves` entry whose `requires` are all present.

1. **Unique solution.** With every possible question in the notebook, `solve` proves time and place, and clears every suspect but the culprit, for every seeded variant.
2. **Solvable in budget.** For every variant, some set of at most **10** questions proves all three. (Exact search: cases are small enough to enumerate answer sets by their `proves` entries.) This leaves 5 questions of slack, and 3 stars are reachable with 9 or fewer.
3. **Every lie is caught.** Every `lie: true` answer contradicts at least one truthful answer, and no suspect can be cleared by a lie alone.
4. **No dead answers.** Every frame and qword in `asks` has an answer or falls to `default` for every role.
5. **Placeholders resolve.** No answer text keeps a `{…}` after filling, for every variant.
6. **Deterministic.** The same seed and actions give the same states and events.
7. **Budget.** The budget never goes below 0 and only accepted questions lower it.

### GS 5.5 Traced example

Level 2, case 1, the casting of GS 4.3, budget 15. The learner selects Paolo and builds `chi` + `è questo ombrello?`.

1. Shape passes. Elision: `chi` is not elided, so it passes. Known errors: `(none, q.chi)` matches `f.owner.umbrella`'s `teaches` → rejected with `prep.diChi`; event `rating q.di_chi produce again`. Budget stays at 15. Feedback: `To ask whose, Italian says di chi.`
2. The learner adds `di`: `Di chi è questo ombrello?` Accepted. Answer: `È di Giulia.` Budget 14. No `good` for `q.di_chi`, because a card keeps its `again` for the turn (`it.md` 6).

---

## GS 6. The inspector's questions

The recognition half of the learning model. Ispettrice Bassi asks one multiple-choice question after every 4th accepted question: a question-word question about something already in the notebook, e.g. `Dov'era Paolo tra le otto e le nove?`, with 3 answer options taken from the notebook (`In biblioteca.`, `Tra le otto e le nove.`, `Con Marta.`). The options are always a place, a time or companion, and a thing or person, so choosing needs the question word, not the content.

- Right, hint not shown: `hard` for the qword's recognize card (guess-proofing, as `it.md` 6).
- Wrong: `again`, with `detail` `{ slot: "answer", given, expected, rule: "answer.wrong" }`, and the right option is shown.
- **Show hint** reveals the English and removes the rating.
- The inspector only asks about qwords the notebook can answer; if none can be asked, she skips her turn.

---

## GS 7. Learning model

As `it.md` 6 (FSRS, default parameters, desired retention 0.9; append-only review log as the source of truth), with these cards and events.

**Cards.** One per `(qword lemma, direction)`: 12 lemmas × 2 = 24 cards. Prepositions, frames and nouns are not cards. Cards live in the same Italian review log as Chi è?'s, so the Italian Progress screen shows both games' words (GD2).

| Event | Cards | Rating |
|---|---|---|
| Level 2 question accepted, no slip | produce: the qword | good |
| Level 2 accepted with a slip | produce: not rated | slip row logged |
| Level 2 rejected for elision or a known error | produce: the qword the learner should have built | again |
| Level 1 question tapped | none | none |
| Rejected as nonsense, duplicate or shape | none | none |
| Inspector answered right, no hint | recognize: the qword | hard |
| Inspector answered wrong | recognize: the qword | again, with detail |
| Hint shown | none | none |

**Labels.** `labelFor(id)` in the `it` module returns `{ kind: "word", text: "quante", gloss: "how much, how many", lang: "it" }` for a qword (showing its base form), and `{ kind: "grammar", title, explain }` for a slip's rule id (GS 3.2), so the Mistakes tab can show `Qual è never takes an apostrophe`.

---

## GS 8. Platform changes

The platform today has one game per language (platform spec 3.2, 3.3). The giallo lives inside the `it` module instead of becoming a new language or a new registry layer (GD1). That needs these changes, each with a card in the backlog; each updates the platform spec in the same pull request.

| Platform spec | Change |
|---|---|
| 3.3 `GameRow` | Gains `game: z.enum(["chie", "giallo", "shei"])` and `caseId: z.string().optional()`. A row without `game` (from before this ships) is read as its language's first game: `chie` for Italian, `shei` for Chinese |
| 3.3 storage keys | `round:{code}` becomes `round:{code}:{game}` for every language. On first load, `round:it` is moved to `round:it:chie` and `round:zh` to `round:zh:shei` |
| 3.2 module contract | Gains `games: { id, title, titleLang, blurb, path }[]` so Home and the shell can list them; `isResumable(saved, game)` takes the game |
| 3.1 registry | Each entry lists its `games` (the first is the language's first game), and `contentVersion` becomes `contentVersions: Record<game, number>`, copied from each game's `version.json`: `src/languages/it/content/version.json` for Chi è?, `src/languages/it/giallo/content/version.json` for the giallo |
| 6.1 tables | Migration 3: `alter table public.games add column game text, add column case_id text`, existing rows set to their language's first game (`chie` for `it`, `shei` for `zh`), then `not null` and a check that `game` is `chie`, `giallo` or `shei` |
| 6.3 sync | Rows carry `game`; nothing else changes. A client from before this ships never sees giallo rows (they are filtered on read by `game`) |
| 8.1 screens | Italian Home lists both games, each with its own Play or Continue |

Level stays per language (`language_settings`): the learner's Italian level applies to both games (GD2).

---

## GS 9. UX

### GS 9.1 Screens and flow (phone first)

```
/it (Home) ──► /it/giallo (Case list) ──► /it/giallo/play (Case) ──► Case end
     └──► /it/play (Chi è?)                                     └──► Case list
```

| Screen | Contents |
|---|---|
| Italian Home | Two game cards: `Chi è?` and `Chi è stato?`, each with Play or `Continue round` / `Continue case`. Level picker, Progress and Settings as today |
| Case list | The 3 cases with title, setting and difficulty, and the best result on this device (`Solved` or not yet). Locked cases do not exist: all three are open |
| Case | Top bar: case title, questions left (`Domande: 12`). People strip: the 5 faces with names; tap one to select. Scene card: the evidence (`un ombrello`, `delle chiavi`). Bottom sheet: Level 1 picker or Level 2 builder for the selected person. Buttons: `Taccuino` (notebook), `Accusa`. Menu with `Quit case` |
| Level 1 picker | The frames for the selected person, grouped by qword, each with its English hint behind a `Show hint` toggle. Asked questions are greyed out and show their answer |
| Level 2 builder | Three slots: preposition (optional), question word, body. Rows of tiles: `con di a da`; every qword form of GS 3.1 plus `qual'`; then the bodies for the selected person, and the slot picker when the body needs one. `Chiedi` submits |
| Notebook | One section per person: their answers in order, and a `Cleared` toggle. The scene's evidence at the top |
| Inspector sheet | Her face, the question, 3 options, `Show hint` |
| Accuse sheet | Three pickers (suspect, room, slot), the sentence it will say, `Accusa` to confirm |
| Case end | Solved or not, stars, the solution, the answers that proved it, this case's mistakes, `Play again` (new seed) and `Back to cases` |

### GS 9.2 Desktop and keyboard

At `lg` (1024px and wider), as DS: the people strip and scene on the left, a fixed panel on the right with the builder or picker above the notebook, so the notebook is always open. Keyboard shortcuts follow DS's contract: `1` to `5` select a person, `N` focuses the notebook, `A` opens Accusa, `Enter` asks, `Esc` closes a sheet, and at Level 2 typing filters tiles (as Chi è?'s type-to-find). The full shortcut table is written in card PLAY-097 and added here.

### GS 9.3 States

As `it.md` 8.2, plus: the Case list's empty best-result state is blank, not `0 stars`; `Continue case` appears on Italian Home and on the Case list when a giallo case is saved.

---

## GS 10. Non-functional

- **Bundle.** The giallo is its own lazy chunk inside the `it` module (`import()` on `/it/giallo`), so Chi è? players never load it. Budget: 60 KB gzipped for the giallo chunk, inside the platform's 250 KB per page.
- **Accessibility.** Every face is a button named with the person's name and role (`Paolo, il giardiniere`). The notebook is a list with headings per person. axe clean on every giallo screen at phone and desktop size.
- **Content checks.** `pnpm build` fails on any schema error or failed content invariant (GS 5.4).
- **Coverage.** `giallo/engine/` at 90% line coverage or more, as Chi è?'s engine.

---

## GS 11. Test plan and definition of done

### GS 11.1 Spec sign-off (before building)

1. The Italian reviewer checks GS 3 (every form, rule and feedback string), the frames of GS 4.2 and case 1's text.
2. Paper-trace case 1 at each level using only this doc. Every guess becomes a fix or a `TBD:`.
3. Tag `v1`.

### GS 11.2 Tests

| Area | Tool | What |
|---|---|---|
| Content | Vitest | Schemas; ids disjoint from Chi è? and Shéi; every GS 5.4 invariant for every case and variant |
| Grammar | Vitest | Each row of GS 3.2 gives its result; each "not an error" in GS 3.2 is accepted with no slip; elided joining |
| Engine | Vitest | Every cell of GS 5.2; GS 5.5 traced as a test; budget and stars at 9, 10, 12, 13 and 15 questions |
| Learning | Vitest | Each row of GS 7 emits its rating; one rating per card per turn |
| Platform | Vitest | A pre-change `round:it` resumes as Chi è?; a row without `game` reads as `chie`; separation tests still pass |
| e2e | Playwright | Case 1 solved at Level 1 and Level 2 on phone projects; a wrong accusation; quit and resume; desktop by keyboard only; axe on every screen |

### GS 11.3 Definition of done

- [ ] `it-giallo.md` reviewed by the Italian reviewer and tagged `v1`
- [ ] Chi è?'s tests pass unedited, and a round saved before the change still resumes
- [ ] Migration 3 applied to production, and every existing games row reads as `chie`
- [ ] All three cases pass every content invariant for every variant
- [ ] Case 1 solves at each level on an iPhone, an Android phone and a laptop at 1024 × 640
- [ ] Every row of GS 3.2 gives its feedback in the app
- [ ] Question-word cards and slips show on the Italian Progress screen
- [ ] e2e and axe green in CI for `/it/giallo`
- [ ] At least 3 A1 learners have played a case; findings logged and must-fix ones closed

### GS 11.4 Milestones

| Sprint | Dates | Done when |
|---|---|---|
| 6: Spec | Mon Nov 30 to Fri Dec 4 | Spec tagged `v1`, case 1 written and reviewed, playtesters booked |
| 7: Platform and engine | Mon Dec 7 to Fri Dec 11 | Migration 3 on staging, engine and invariants pass for case 1 |
| 8: Screens and learning | Mon Dec 14 to Fri Dec 18 | Case 1 playable end to end on staging at both levels; cases 2 and 3 written |
| 9: Playtest and launch | Mon Jan 4 to Fri Jan 8 | Playtest run, must-fix findings closed, live at `/it/giallo` |

These start after the platform launch and cleanup (platform spec 10.4), so nothing here competes with Nov 13.

---

## GS 12. Future work and decision log

### GS 12.1 Future work

- **More cases**, and a daily case from a seed everyone shares.
- **Stored stars** and a best result synced across devices (needs a column; out because `result` covers solved or not).
- **Questions about other people** (`Dov'era Marta?` asked of Paolo): doubles the frames; out until the first cases show it is wanted.
- **Learner-produced answers**: the inspector asks and the learner builds the answer (`Era in biblioteca.`), practising the imperfect.
- **Indirect questions** (`Sa dirmi dove…`) and *che* vs *quale* as a determiner, for an A2 case set.
- **Moving the giallo to a registry-level game list**, if a third game in any language appears (platform 11.1, shared engine package).

### GS 12.2 Decision log

| # | Decision | Reason |
|---|---|---|
| GD1 | The giallo is a second game inside the `it` module, at `/it/giallo`, not a new language or a registry layer | Same learner, same lexicon rules, same Progress; the smallest change to the platform contract that works. A registry-level game list waits for a third game |
| GD2 | Level and FSRS cards are shared with Chi è? per language | A learner has one Italian level; Progress should show all their Italian words in one place |
| GD3 | Separate content version and saved-round key per game | A giallo content change must not discard a Chi è? round, and two saved rounds can coexist |
| GD4 | `che cosa`, `cosa` and `che` are one lemma and all accepted | All three are standard; rejecting one would mark real Italian wrong (as Chi è? D25) |
| GD5 | Unelided `dove era`, `come è` are accepted with no slip | Both spellings are correct; the elided one is shown as the usual form |
| GD6 | Agreement and `qual'` errors are slips; missing prepositions and bad elision are rejections | Slips keep the question meaningful, as Chi è?'s adjective agreement; a missing preposition changes the meaning (`Chi è questo ombrello?` asks who the umbrella is) |
| GD7 | The theme is a theft, not a murder | A1 content for adults on a casual game; a theft keeps the tone light and the vocabulary concrete |
| GD8 | 15 questions per case; invariants require a 10-question solution | Tension without a CPU opponent, with 5 questions of slack for wrong turns |
| GD9 | A wrong accusation closes the case | The accusation is the point of the game, as a wrong guess in Chi è? (D3); a confirm sheet prevents taps by mistake |
| GD10 | Hand-written cases with seeded casting, hiding place and slot | Every sentence is reviewed by a person, and replays still differ; fully generated cases would produce unreviewed Italian |
| GD11 | Questions use formal *Lei*, third person singular | One verb form for every question, so the learner's attention stays on the question word; *Lei* is also what a detective would use |
| GD12 | Recognition comes from the inspector's multiple-choice questions, capped at `hard` | Without a CPU opponent asking, the learner still has to read question words; guess-proofing as Chi è? |
| GD13 | The giallo casts Chi è?'s 24 characters; story roles and jobs are cast separately | No new art, and a replay never ties the culprit to a job |

---

## GS 13. Changelog

- 2026-10-15: v0.1 draft. Rules, question-word grammar, content model, engine contract, learning model, platform changes and milestones. Backlog cards PLAY-076 to PLAY-102.
- 2026-10-15: GS 8 after PLAY-081. Shéi's rows get the game id `shei`, so the enum is `chie`, `giallo` or `shei`, and a row without `game` reads as its language's first game, not always `chie`. `round:zh` moves to `round:zh:shei` too. Migration 3 sets each existing row's game from its language instead of defaulting every row to `chie`.
