# 谁？ (Shéi?): Desktop Spec

| | |
|---|---|
| Status | v0 draft (2026-10-08). Becomes `v1` after the sign-off in ZS 13.1 |
| Product name | **谁？** (*Shéi?*, "Who?"). Written `谁？` in the app and `Shei` in code. The branding rules of `zh.md`: never "Guess Who", "Guess Who?" or any official Chinese title of that game in public branding |
| Audience for this doc | Whoever builds, reviews, or tests Shéi's desktop version |
| Builds on | `zh.md` (Shéi's MVP spec) for rules, content, engine, CPU, learning model and backend. `it-desktop.md` (Chi è?'s desktop spec, cited as "DS") is the model this spec follows; every part of it that Shéi uses is restated here, so this spec stands on its own |

Conventions: each section leads with the decision, then the reason. `TBD:` marks an open question. Exact strings the app must show are written exactly, in quotes or code; Chinese strings use full-width punctuation. Sections here are `ZS n` and decisions `ZD n`, so they never clash with `zh.md` sections, DS sections or DS decisions. Backlog cards are in `planning/backlog.md`, epic **Shéi desktop**.

---

## ZS 1. Scope and non-goals

**Goal.** A version of Shéi designed for a laptop: the board as large as the window's height allows, the questions, the round so far and the learner's tools beside it, and every move playable by mouse or entirely by keyboard, including building Level 2 questions by typing pinyin. The phone experience stays exactly as it is.

**The problem today.** Shéi joined this repo before Chi è?'s desktop work, so none of it reached `src/languages/zh`. Every `/zh` route sets its width to `lg:max-w-md` (`src/languages/zh/index.ts`), so on a laptop the game is a phone-sized strip under DesktopNav. Chi è?'s desktop layout, if copied as is, would still be a phone design widened: a fixed 22 to 26rem panel whose Level 2 tile row does not fit (ZS 6.1), a 14-row question list that scrolls, and no use of the keyboard for the thing Chinese learners type all day, pinyin.

**Target user.** The adult new-HSK 1 learner of `zh.md` §1, at a laptop or desktop (13 to 27 inch screen, browser window 1024px wide or more) with a trackpad or mouse and a physical keyboard, studying at a desk in 10 to 20 minute sessions. They can read pinyin with tones and may or may not have a Chinese input method (IME) installed.

**Success criteria.** The desktop version is done when all of these are true:

1. A full round at each level plays to the end by mouse only, and again by keyboard only, at 1024 × 640 and at 1440 × 900.
2. At 1024 × 640, all 24 cards, the panel's summary and actions, and the whole of the current phase's controls are visible with no page scroll, at both levels (ZS 6.3 has the measured budget).
3. At Level 2, a learner can ask `他有狗吗？` by typing `ta`, Enter, `you`, Enter, `gou`, Enter, `ma`, Enter, Enter, without touching the mouse.
4. Every screen (`/zh`, `/zh/play`, round end, `/zh/progress`, `/settings`, `/privacy`) has no horizontal scroll at 1024 and 1440 wide.
5. The phone layout is unchanged; every existing phone test, unit and e2e, passes without being edited.
6. axe reports no violations on every `/zh` screen at desktop size.

| In desktop v1 | Out of desktop v1 (future, ZS 14.1) |
|---|---|
| Layout for windows 1024px wide or more | Tablet layouts (768 to 1023px) |
| A board sized by the window's height, with the panel taking the remaining width (ZS 5) | Resizable or detachable panel |
| Level 1 questions grouped by verb, 是, 有, 在, all visible at once (ZS 7.1) | Drag and drop of tiles |
| Level 2 type-to-find: typing pinyin (or characters with an IME) picks tiles (ZS 7.2) | Typing whole questions (`zh.md` Level 3) |
| A round log beside the board, with word glosses on hover and focus (ZS 7.3, 7.4) | Audio of any kind |
| Card hover preview, right-click detail, hover styles (ZS 8) | User-customisable shortcuts |
| Keyboard shortcuts with a help dialog (ZS 9) | Charts, streaks, history over time on Progress |
| Two-column Home and round end, a Progress dashboard, desktop dialogs (ZS 10) | New settings, new content, new Chinese strings |
| Moving Chi è?'s language-neutral desktop parts into `src/core` (ZS 4) | Any change to Chi è?'s behaviour |
| Desktop Playwright specs for `/zh`, a manual laptop pass, laptop playtest sessions | Visual regression screenshots |

Rule: anything not in the left column is out. New ideas go to ZS 14.1, not into the build. Nothing in `zh.md` sections 2 to 7 (rules, content, engine, CPU, learning model, backend) changes, and no rating changes (ZS 7.2, ZS 7.4 say why the new tools do not need one).

## ZS 2. Behaviour on desktop

### ZS 2.1 A desktop round, step by step

1. The learner opens `/zh` in a 1440 × 900 window. DesktopNav runs across the top; Home shows two columns (ZS 10.1).
2. They pick Level 2 and press Enter on **Play**. `/zh/play` opens with no DesktopNav: TopBar on top, the 6 × 4 board on the left at the largest size the height allows, and the side panel on the right with the summary "Your turn: ask a question, or guess.", the find field, the tray, the tiles, and below them the round log, empty for now ("Questions you and the computer ask show up here.").
3. They press `/`; focus moves to the find field. They type `ta`; a list opens under the field with 他 then 她, 他 selected. They press Enter: 他 goes into the tray and the field clears. They type `you`, Enter; `gou`, Enter; `ma`, Enter. The tray reads 他有狗吗. The field is empty, so Enter asks the question.
4. The engine accepts it. The panel shows the answer (phase `playerReview`) with the question and answer in the body; hovering 狗 there shows "狗 · gǒu · dog". The log's first entry appears: "You asked 他有狗吗？" and the answer.
5. They press `b`; focus moves to the board. Arrows and Enter flip down the cards the answer rules out. They press `n` (Next).
6. The CPU asks (phase `cpuTurn`). The panel shows `他是医生吗？` with seven answer buttons numbered 1 to 7. They press `p` to see pinyin, then `2` (不是). The panel shows ✓ or ✗ (phase `cpuReview`). They press `n`.
7. On a later turn they press `g`. The summary changes to "Click the card you think it is." and focus moves to the board. They move to a card and press Enter; GuessConfirm opens with focus on its confirm button; Enter confirms.
8. Round end shows in two columns: the result and both cards on the left, the full round log on the right. "Play again" has focus.

At Level 1, step 3 becomes: `q` moves focus to the first question in the 是 group; ↓ moves within the group, → to the 有 group; `t` switches the pronoun to 她; Enter asks. Step 6 offers two answers, numbered 1 and 2, and `h` shows the hint.

At every step the mouse works too: clicking does exactly what tapping does on the phone.

### ZS 2.2 Edge cases

| Situation | Rule |
|---|---|
| Window resized across 1024px mid-round | Layout swaps (Sheet and SidePanel). Game state, flips, a guess in progress, the Level 2 tray and a shown hint are kept: `Game` holds the tray and `hintShown`, because the sheet and the panel are different trees. The find field's text is dropped |
| Focused element unmounted by a resize | Focus moves to the board's roving card |
| Window narrower than 1024px | Phone layout, centred, exactly as today. No "too small" message |
| Window shorter than 640px at 1024px or wider | Cards shrink to fit (the board formula uses height). The panel's body scrolls; the summary and actions never leave view |
| Very large window (1920 × 1080 and up) | Cards stop growing at 13rem; the panel stops at 40rem; the rest is grey margin, the layout centred (ZS 5.2) |
| Touch laptop (touch is the primary input) | `(hover: hover)` is false: no card preview and no hover glosses; long-press still opens CardDetail; focus glosses still work; layout is still desktop |
| Shortcut key pressed in the find field, the sign-in fields, or any input | Ignored by the shortcut layer; the field handles its own keys (ZS 7.2) |
| Shortcut pressed with a dialog open | Ignored, except the dialog's own Enter and Esc |
| `1` to `7` outside `cpuTurn`, or a number above the answers shown (`3` at Level 1) | Nothing happens |
| `a`, Enter on the empty find field, or Backspace on the empty find field, with an empty tray | Nothing happens; the engine is never sent an empty question |
| `t` at Level 2, `p` or `/` at Level 1 | Nothing happens. Level 1 always shows pinyin (`zh.md` D14); Level 2 has no pronoun switch (the pronoun is a tile) |
| Find field: no tile matches | The list shows "No word matches “{query}”."; Enter does nothing |
| Find field: the tray is full (6 tiles) | The list shows "The question is full. Ask it, or remove a word."; Enter on a match does nothing; Enter on the empty field still asks |
| Find field: typing with a Chinese IME | Keys during composition are ignored (ZS 7.2); the committed characters match tiles by their characters |
| `l` with an empty log | Nothing happens |
| Hover gloss open when a dialog opens or a key is pressed | The gloss closes at once (Esc closes it without any other effect) |
| Hover on a word while a rating is pending | The gloss shows characters and pinyin, not English (ZS 7.4) |
| Reload mid-round | As `zh.md` 8.2 Resume: Home offers "Continue round"; DesktopNav's Play reads "Continue". The log rebuilds from `history`, so nothing is lost |
| All 24 cards flipped down | "Unflip all" appears centred over the board, as on the phone |
| No progress data | Progress shows "Play a round to see your words here." once, full width, with no stat tiles |
| Firefox Shift+right-click | Shows the browser menu; Firefox does not fire `contextmenu` then (MDN). Accepted, as DS |

## ZS 3. Data and content model

**Decision: no new stored data and no new content (ZD1).** No schema, table, sync, setting or content change. The reason: desktop is a presentation layer. Every word, pinyin, gloss and sentence it shows already exists in `lexicon.json` and the engine's `history`.

New in-memory types, each in a pure module with unit tests:

```ts
// src/languages/zh/ui/game/roundLog.ts
export type LogEntry = {
  by: "player" | "cpu";
  question: Sentence;          // renderQuestion, segments carry lexiconId
  answer: Sentence;            // the true answer, renderAnswer
  english: string;             // englishFor(...) + " Yes." or " No."
  playerAnswerId?: string;     // cpu entries: what the learner chose
  right?: boolean;             // cpu entries: whether that was the true answer
};
export function roundLog(history: AskedQuestion[]): LogEntry[]; // newest first
```

```json
{ "by": "cpu", "english": "Is he a doctor? No.", "playerAnswerId": "a.bushi", "right": true,
  "question": { "hanzi": "他是医生吗？", "pinyin": "Tā shì yīshēng ma?", "segments": ["…"] },
  "answer": { "hanzi": "不是，他不是医生。", "pinyin": "Bú shì, tā bú shì yīshēng.", "segments": ["…"] } }
```

```ts
// src/languages/zh/ui/game/findTiles.ts
export type Tile = { id: string; hanzi: string; pinyin: string }; // the 21 builder tiles
export function pinyinKey(s: string): string;
export function findTiles(query: string, tiles: Tile[]): Tile[];
```

`pinyinKey` lowercases, decomposes with `normalize("NFD")` and drops combining marks U+0300 to U+036F (MDN: `String.prototype.normalize`), then drops digits, spaces and apostrophes, then turns `v` into `u`. So `nǚ de`, `nu de`, `nv3de` and `NUDE` all give `nude`. `findTiles` returns the tiles whose `pinyinKey(pinyin)` starts with `pinyinKey(query)`, or, when the query holds a CJK character, whose `hanzi` starts with the query; in builder order (ZS 7.2); empty for an empty query.

| Query | Matches, in order |
|---|---|
| `ta` | 他, 她 |
| `t` | 他, 她 |
| `n` | 你, 男的, 女的 |
| `nv` or `nu` | 女的 |
| `sh` | 是, 手机, 书 |
| `shi` | 是 |
| `x` | 学生, 学校 |
| `yi` | 医生, 医院 |
| `gou3` | 狗 |
| `狗` | 狗 |
| `zz` | none |

```ts
// src/languages/zh/ui/game/gloss.ts
export function glossShowsEnglish(phase: Phase, level: Level): boolean;
```

`ProgressStats` and `progressStats()` are DS 3's, moved to `src/core/ui/progressStats.ts` and given Shéi's `cardIds` (ZS 4).

**Invariants** (each checked by a unit test, not by hand):

- `roundLog(h).length === h.length`, and entry 0 is `h.at(-1)`.
- Every `LogEntry.question.hanzi` equals its history row's `text`, and every `answer.hanzi` its `answerText`.
- `pinyinKey` is idempotent, and `pinyinKey(t.pinyin)` is non-empty and matches `/^[a-z]+$/` for every tile.
- For every tile, `findTiles(t.pinyin, tiles)` contains `t`, and `findTiles(t.hanzi, tiles)[0]` is `t`.
- `findTiles` never returns a tile outside the 21 builder tiles, and never an answer entry.
- `glossShowsEnglish` is false exactly for `cpuTurn` at both levels and `playerTurn` at Level 2.
- `progressStats` with Shéi's data: `0 ≤ dueToday ≤` reviewed cards `≤ 2 × wordsSeen`, as DS 3.

## ZS 4. Shared code

**Decision: Chi è?'s language-neutral desktop parts move from `src/languages/it/ui/game` to `src/core/ui`, and both games use them (ZD2).** The reason: one fix then reaches both games and the copies cannot drift. The cost is a refactor that touches Chi è? before launch, guarded by its unchanged tests.

| Part | Moves to | What it takes that differs by language |
|---|---|---|
| `useHoverPreview` | `src/core/ui/useHoverPreview.ts` | nothing |
| `previewSpot`, `boardVars` | `src/core/ui/boardLayout.ts` | `previewSpot`: the caption's height (Chi è? 32px, Shéi 44px). `boardVars`: the shape, the caption height (Chi è? 0) and the sizing mode (ZS 5.2) |
| `Kbd` | `src/core/ui/Kbd.tsx` | nothing |
| `SidePanel` | `src/core/ui/SidePanel.tsx` | an optional `log` slot (Chi è? passes none) |
| `ShortcutsDialog` | `src/core/ui/ShortcutsDialog.tsx` | the rows of keys to list |
| DS 4.3 steps 1 to 3 | `src/core/ui/shortcutGuard.ts` | nothing; returns whether a key may be a shortcut at all |
| `progressStats` | `src/core/ui/progressStats.ts` | the language's `cardIds` |
| `Tooltip` (new, for glosses) | `src/core/ui/Tooltip.tsx` | nothing |

**Stays per language:** `shortcuts.ts` (the key table), `CardPreview` (face and caption differ), and every screen. The purity lint over `src/languages/*/ui/game/shortcuts.ts` already covers Shéi's file; `shortcutGuard.ts`, `roundLog.ts`, `findTiles.ts` and `gloss.ts` are added to it.

**Rule:** the move changes no Chi è? behaviour. Its unit and e2e tests pass without edits, and `pnpm check:bundle` shows `/it` within 1 kB of today.

## ZS 5. Breakpoint and game layout

### ZS 5.1 Breakpoint

`lg`, 64rem (1024px), on width alone, as DS 5 (DD1): CSS uses the `lg:` variant; component swaps use `useIsDesktop()` from `src/core/ui/useMediaQuery.ts`. Hover features also need `(hover: hover) and (pointer: fine)`. The app shell (DesktopNav, page background, SyncBanner placement) is already shared and unchanged. `src/languages/zh/index.ts` sets the route widths of DS 5's table: Home `lg:max-w-5xl`, game `lg:max-w-none`, Progress `lg:max-w-6xl`.

### ZS 5.2 The board takes the height; the panel takes the rest

**Decision: the card size comes from the window's height, the board column is exactly as wide as six cards, and the panel gets all the remaining width between 28rem and 40rem (ZD3).** The reason: a 6 × 4 board with captions is height-bound on every common laptop window, so Chi è?'s fixed-width panel leaves width unused beside the board. Giving it to the panel fits the Level 2 tiles and the round log with no scrolling, and costs the cards nothing.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TopBar: ☰ menu · Turn 3 · Your turn · [your secret card]                 │ h-14, both columns
├─────────────────────────────────────────────┬────────────────────────────┤
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐               │ Summary                    │ aria-live
│ │  │ │  │ │  │ │  │ │  │ │  │               ├────────────────────────────┤
│ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘               │ Phase area                 │ natural height,
│ 李丽  ...                                    │  (L1 groups, L2 builder,   │ scrolls only if
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐   6 × 4      │   CPU question, review)    │ it must
│ ...                                          ├────────────────────────────┤
│                                              │ Round log (n)              │ takes what is left,
│                                              │  newest first              │ min 2.75rem
│                                              ├────────────────────────────┤
│                                              │ [Clear] [Ask A] [Guess G]  │ actions, pinned
│                                              │ Press ? for shortcuts      │
└─────────────────────────────────────────────┴────────────────────────────┘
       auto (6 cards + gaps + padding)              minmax(28rem, 40rem)
```

- The root is `grid h-dvh grid-rows-[3.5rem_1fr] grid-cols-[auto_minmax(28rem,40rem)] justify-center bg-stone-200`; TopBar spans both columns. The board cell is `bg-stone-50 p-6`; the panel is `bg-white border-l border-stone-200`.
- The card width is set on the root from the viewport, not from a container query, because the board column's width depends on it:

  ```css
  --card-w: min(
    calc((100vw - 28rem - 3rem - 5 * var(--gap)) / 6),
    calc((100dvh - 3.5rem - 3rem - 3 * var(--gap) - 4 * var(--card-cap)) / 4 * 5 / 6),
    13rem
  );
  ```

  with `--gap: 0.5rem` and `--card-cap: 2.25rem`. The three terms: the width left after the panel's minimum, the height left after TopBar, padding, gaps and captions (turned into a width by the 5:6 face), and a cap.
- The phone keeps its formula and sizes exactly (DD11 of DS): `--card-cap: 1.75rem`, `--gap: 0.25rem`, container-query based.

**Worked sizes** (TopBar 56px, padding 48px, gaps 8px, captions 36px):

| Window | Width term | Height term | Card | Board column | Panel |
|---|---|---|---|---|---|
| 1024 × 640 | (1024 − 448 − 48 − 40) / 6 = 81px | (640 − 56 − 48 − 24 − 144) / 4 × 5/6 = 77px | 77px | 548px | 476px |
| 1280 × 720 | 124px | 93px | 93px | 648px | 632px |
| 1440 × 900 | 151px | 131px | 131px | 873px | 567px |
| 1920 × 1080 | 231px | 168px | 168px | 1098px | 640px (cap), 182px of margin |

### ZS 5.3 Board and cards

- 6 columns × 4 rows at every size (already so on the phone), cards in row-major order, so card *n* keeps its place across a resize.
- **Captions grow at `lg` (ZD4):** the name in characters 16px (phone 12px) and its pinyin 12px (phone 9px), in a 2.25rem strip. The reason: the phone sizes are hard to read at laptop distance. The longest pinyin, `Zhāng Jìng`, is about 66px at 12px and fits the smallest card (77px).
- At `lg` the board is `role="grid"` with four `role="row"`s of six `role="gridcell"`s, with roving tabindex (ZS 9.2). Below `lg` it stays the list it is.
- The skeleton board (loading) uses the same variables, plus an empty panel outline.

## ZS 6. Side panel

### ZS 6.1 Structure

A shared `SidePanel` (ZS 4) renders `<aside aria-label="Questions">` with four parts, top to bottom:

1. **Summary**: the same line as the phone's collapsed sheet, full size, `aria-live="polite"`.
2. **Phase area**: what `sheetFor()` in `src/languages/zh/ui/Game.tsx` builds for the phase, at its natural height; it scrolls (`overflow-y-auto overscroll-contain`) only when it is taller than the space minus the log's minimum.
3. **Round log**: ZS 7.3. Takes the remaining height, at least 2.75rem (its header line).
4. **Actions**: pinned at the bottom, then "Press ? for shortcuts" in `text-sm text-stone-600`.

**Decision: the panel shows what `sheetFor()` builds, so phone and desktop cannot drift (as DS DD3), with two desktop-only differences (ZD5):** Level 1's questions are grouped by verb (ZS 7.1), and Level 2's Clear and Ask buttons move from the builder into the actions. The reason for the second: the actions never scroll out of view, and the builder gets 56px shorter (ZS 6.3).

### ZS 6.2 Per phase

| Phase | Summary | Phase area | Actions |
|---|---|---|---|
| `playerTurn` L1 | "Your turn: ask a question, or guess." or "Try again." | FeedbackText, then the question groups (ZS 7.1) | Guess `G` |
| `playerTurn` L2 | as L1 | FeedbackText, then the find field and Pinyin toggle on one row, the tray, and the four tile rows (ZS 7.2) | Clear, Ask `A`, Guess `G` |
| `playerTurn`, guessing | "Click the card you think it is." (phone keeps "Tap the card you think it is.") | empty | Cancel guess `Esc` |
| `playerReview` | The answer in characters | The question and answer with ruby pinyin as the level shows it, glossable (ZS 7.4); the muted pronoun-slip line; "Flip down everyone this rules out, then click Next." (phone keeps "tap") | Next `N` |
| `cpuTurn` | The CPU's question in characters | CpuQuestion: "The computer asks about your card:", the question, "Show hint" at L1, the answer buttons, each with its number at `lg` | none |
| `cpuReview` | ✓ or ✗ and the answer | "Right!" or FeedbackText, the answer, glossable | Next `N` |
| `over` | n/a: round end replaces the screen | | |

Every key label is a `Kbd`, `aria-hidden`, shown at `lg` only; the control carries `aria-keyshortcuts`. In the phase area at `lg`: "Ask with" shows `T` after the pronoun switch; the Pinyin toggle shows `P`; the find field's placeholder reads "Type pinyin, e.g. gou" with `/` shown beside it.

**Desktop wording.** Chosen with `useIsDesktop()`. No Chinese string changes.

| Phone (unchanged) | Desktop |
|---|---|
| "Tap the card you think it is." | "Click the card you think it is." |
| "Flip down everyone this rules out, then tap Next." | "Flip down everyone this rules out, then click Next." |
| "Tap words below" (empty tray) | "Click words below, or type pinyin" |
| Home: "Tap ready-made questions, with English hints" | "Click ready-made questions, with English hints" |

### ZS 6.3 Height budget

At 1024 × 640 the panel has 640 − 56 (TopBar) − 61 (summary) − 101 (actions) = 422px for the phase area and the log.

| Phase area | Estimate | Leaves for the log |
|---|---|---|
| L1 groups (ZS 7.1) | 376px | 46px: the header line |
| L2 builder without Clear and Ask (ZS 7.2) | 332px | 90px: header and one entry |
| CPU question, L2, 7 answers | about 260px | about 160px |

These are estimates from today's component sizes (the Level 2 builder measured 388px including Clear and Ask, Chromium, 2026-10-08). `TBD:` the layout card measures each on the build and records the numbers here. **Rule:** if a phase area is taller than 378px (422 − the log's 44px header) at 1024 × 640, that card is not done: it shrinks the area, it does not let it scroll. At 1440 × 900 the same budget is 682px, which leaves at least 300px of log in every phase.

## ZS 7. Desktop tools

### ZS 7.1 Level 1: questions grouped by verb

**Decision: at `lg`, Level 1's 14 questions show in three columns, one per verb, all at once (ZD6).** The reason: on a laptop there is room to see every question without scrolling, and the grouping teaches `zh.md`'s core grammar point: 是 for who someone is, 有 for what they have, 在 for where they are.

| Column heading | Questions (in `allQuestions` order) |
|---|---|
| `是` shì, "who they are" | 男的, 女的, 老师, 学生, 医生 |
| `有` yǒu, "what they have" | 狗, 猫, 手机, 书, 电脑 |
| `在` zài, "where they are" | 家, 学校, 医院, 饭店 |

- The heading's character and pinyin come from the verb's lexicon entry; the English part is the exact string above. Columns come from each noun's `verb` field, so new nouns land in the right column.
- Above the columns, the pronoun switch as today ("Ask with" 他 he / 她 she).
- Each question is a button: the question with ruby pinyin at 16px, and under it the English hint (`hint()`) at 12px on **one line**, truncated with an ellipsis when too long; the full hint shows on hover and focus (ZS 7.4's Tooltip) and is the button's accessible description. Asked questions are greyed and show their answer in place of the hint, as today.
- Below `lg`, the phone's single list is unchanged.

### ZS 7.2 Level 2: type-to-find

**Decision: at `lg`, a find field above the tray lets the learner pick tiles by typing their pinyin, or their characters with an IME (ZD7).** The reason: typing pinyin is how Chinese is written on a computer, and with both hands on the keyboard it is the fastest way to build a question. It changes no rating: the learner still has to produce the word from its meaning, now as pinyin, which is the same recall the tile tap measures (`zh.md` 6, `produce` card).

**Behaviour.** The field is an editable combobox with a listbox popup, following the WAI-ARIA combobox pattern (APG): `role="combobox"`, `aria-expanded`, `aria-controls` pointing at the list, `aria-autocomplete="list"`, and `aria-activedescendant` for the selected option, while DOM focus stays in the field.

| In the field | Result |
|---|---|
| Typing | The list shows `findTiles(query)` (ZS 3), up to 9 options, first one selected. Each option shows the characters, and the pinyin when the Pinyin toggle is on |
| ↓ / ↑ | Move the selection, wrapping |
| Enter, list open with a selection | Adds that tile to the tray, clears the field, closes the list. Focus stays in the field |
| Enter, field empty, tray not empty | Asks the question (the same as Ask) |
| Backspace, field empty | Removes the last tile from the tray |
| Esc, list open | Closes the list and clears the field |
| Esc, field empty | Moves focus to the first tile row |
| Any key while an IME is composing | Ignored: `event.isComposing` is true or `event.keyCode` is 229 (MDN: `keydown`, IME composition) |

- Strings: placeholder "Type pinyin, e.g. gou"; no match: "No word matches “{query}”."; tray full: "The question is full. Ask it, or remove a word." Both messages are in the list area and announced through `aria-live="polite"`.
- The field is `lang="zh-Latn-pinyin"`, `autocomplete="off"`, `spellcheck="false"`, `autocapitalize="off"`.
- Clicking tiles works exactly as today; the field is optional.
- Below `lg` there is no find field.

### ZS 7.3 Round log

**Decision: at `lg` the panel shows every question and answer of the round, newest first, below the phase area (ZD8).** The reason: on a phone the history waits for round end; on a laptop there is room to keep it in view, which helps the learner reason about the board and rereads correct Chinese every turn.

- Heading "Round log", with the count: "Round log (5)". Empty: "Questions you and the computer ask show up here."
- Each entry is `roundLog()` (ZS 3), rendered as: "You asked" or "The computer asked" in `text-xs text-stone-600`, the question, then the answer in `font-medium`. A CPU entry the learner got wrong adds "(you said 不有)" in rose, as round end does today. Pinyin shows as ruby at Level 1, and at Level 2 when the toggle is on.
- Every Chinese word is glossable (ZS 7.4).
- When the log has only its header's height (ZS 6.3), the header is a button, "Round log (5) ▸", that opens the log as an overlay over the phase area, with focus on the newest entry; Esc or the button closes it.
- Keyboard: `l` moves focus to the newest entry. The list has roving tabindex (one tab stop); ↑ ↓ move between entries. A focused entry shows its `english` line under it, when `glossShowsEnglish()` is true.
- Round end shows the same component, full height, in its right column (ZS 10.2), replacing today's "Questions" list at `lg` only.

### ZS 7.4 Word glosses

**Decision: hovering or focusing a Chinese word in resolved text shows its characters, pinyin and English; while a rating is pending, English is hidden (ZD9).** The reason: looking a word up is how a desktop reader learns, but showing "dog" while the learner is being rated on producing or recognising 狗 would make the rating meaningless.

- **Where:** words with a `lexiconId` in the round log, the `playerReview` and `cpuReview` phase areas, round end, and Progress. Not in the Level 1 questions (they show their English already), the CPU's question in `cpuTurn`, the tiles, or the find list.
- **What:** a Tooltip with the characters in 24px, the pinyin, and the lexicon `gloss`, e.g. "狗 · gǒu · dog". When `glossShowsEnglish(phase, level)` is false (`cpuTurn` at both levels, `playerTurn` at Level 2) the English is left out. On round end and Progress it is always shown.
- **When:** at `lg` with `(hover: hover) and (pointer: fine)`, after the pointer rests on the word for 200ms. Glossable words are not tab stops; for keyboard users the focused log entry's English line (ZS 7.3) is the equivalent.
- **WCAG 1.4.13 (Content on Hover or Focus, AA):** the gloss is dismissible with Esc without moving the pointer, hoverable (the pointer can move onto it, with a 100ms grace on leaving the word), and persistent until the pointer leaves both, Esc, or a click.
- `Tooltip` is `role="tooltip"`; the word gets `aria-describedby` while it shows. Chinese inside it has `lang="zh-Hans"`, pinyin `lang="zh-Latn-pinyin"`.
- **Motion.** 120ms fade; none under `prefers-reduced-motion`.

## ZS 8. Mouse

- **Click** works exactly as tap does today; no change, because `useLongPress` uses Pointer Events.
- **Card hover preview**, as DS 7.2: after 350ms on a card, the face at 2× the card's width (capped at 16rem) appears centred over the card, clamped inside the board, `pointer-events-none`, with the name at 20px and its pinyin at 14px under it (`previewSpot` caption 44px). Not shown while guessing, with a dialog open, on touch, or below `lg`. Moving straight to another card swaps it at once.
- **Right-click** on a card opens CardDetail (already shared through `useLongPress`); the context menu key on a focused card does the same. Elsewhere, the normal browser menu.
- **Hover styles**, as DS 7.4: face-up card `-translate-y-0.5 ring-2 ring-stone-400`; flipped card `ring-2 ring-stone-400`; card while guessing `ring-2 ring-blue-600 cursor-pointer`; primary button `bg-stone-700`; secondary `bg-stone-300`; question button `bg-stone-200`; tile `bg-stone-200`; log entry `bg-stone-50`; DesktopNav link underline. All through Tailwind `hover:`, which applies only under `(hover: hover)`.

## ZS 9. Keyboard

**Decision: the whole game is playable from the keyboard with single-key shortcuts, using `zh.md` 8.3's keys and adding keys for the desktop tools (ZD10).** The reason: a learner at a laptop should not have to reach for the mouse on any turn. The keys are English mnemonics because the UI chrome is English: `n` Next, `a` Ask, `g` Guess, `p` Pinyin, `t` 他/她, `l` Log.

### ZS 9.1 Shortcut contract

```ts
// src/languages/zh/ui/game/shortcuts.ts (pure; imports only types)
export type ShortcutContext = {
  phase: Phase;
  level: Level;
  guessing: boolean;
  dialogOpen: boolean;
  answers: number;   // answer buttons shown; 0 outside cpuTurn
  trayEmpty: boolean;
  logEmpty: boolean;
};

export type ShortcutAction =
  | { type: "focusQuestions" }         // q
  | { type: "focusBoard" }             // b
  | { type: "startGuess" }             // g
  | { type: "cancelGuess" }            // Escape
  | { type: "answer"; index: number }  // 1 to 7, 0-based
  | { type: "showHint" }               // h
  | { type: "next" }                   // n
  | { type: "ask" }                    // a
  | { type: "removeLast" }             // Backspace
  | { type: "focusFind" }              // /
  | { type: "togglePinyin" }           // p
  | { type: "switchPronoun" }          // t
  | { type: "focusLog" }               // l
  | { type: "openHelp" };              // ?

export function keyToAction(k: KeyLike, ctx: ShortcutContext): ShortcutAction | null;
```

`KeyLike` is DS 4.1's. **Order of checks**, the first match returns `null`: (1) Ctrl, Cmd or Alt held; (2) the target is an input, textarea, select or contenteditable; (3) a dialog is open (these three are `shortcutGuard`); (4) the key is not in the table; (5) the cell is `-` or its condition fails. Letters match in either case. When the result is not `null`, the listener calls `preventDefault()`.

`Game` maps each action to an existing handler or a focus move. `answer` picks the id at that index of `answerIds(questionKey, level)`, a function exported from `CpuQuestion.tsx` that the buttons also render from, so the key and the button can never disagree. `showHint` clicks CpuQuestion's own "Show hint", so `zh.md` 6's hint rule is unchanged.

### ZS 9.2 Transition table

`-` means `null`.

| Context | `q` | `b` | `g` | `Esc` | `1`–`7` | `h` | `n` | `a` | `Backspace` | `/` | `p` | `t` | `l` | `?` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `setup` | - | focusBoard | - | - | - | - | - | - | - | - | - | - | - | openHelp |
| `playerTurn` L1 | focusQuestions | focusBoard | startGuess | - | - | - | - | - | - | - | - | switchPronoun | focusLog ¹ | openHelp |
| `playerTurn` L2 | focusQuestions | focusBoard | startGuess | - | - | - | - | ask ² | removeLast ² | focusFind | togglePinyin | - | focusLog ¹ | openHelp |
| `playerTurn`, guessing | - | focusBoard | - | cancelGuess | - | - | - | - | - | - | togglePinyin ³ | - | focusLog ¹ | openHelp |
| `playerReview` | - | focusBoard | - | - | - | - | next | - | - | - | togglePinyin ³ | - | focusLog ¹ | openHelp |
| `cpuTurn` L1 | - | focusBoard | - | - | answer ⁴ | showHint | - | - | - | - | - | - | focusLog ¹ | openHelp |
| `cpuTurn` L2 | - | focusBoard | - | - | answer ⁴ | - | - | - | - | - | togglePinyin | - | focusLog ¹ | openHelp |
| `cpuReview` | - | focusBoard | - | - | - | - | next | - | - | - | togglePinyin ³ | - | focusLog ¹ | openHelp |
| `over` | - | - | - | - | - | - | - | - | - | - | - | - | - | - |

¹ `null` when the log is empty. ² `null` when the tray is empty. ³ Level 2 only. ⁴ `{ index: key − 1 }` when `key ≤ answers`, else `null`.

`focusQuestions` moves focus to the first enabled question at Level 1, or the first tile row at Level 2. `p` works in every Level 2 phase, not only while building (ZD11): pinyin also shows on the CPU's question, the answers and the log, where a learner reading at Level 2 most needs it.

### ZS 9.3 Invariants

Each is a unit test in `src/languages/zh/ui/game/shortcuts.test.ts`:

- Every cell of ZS 9.2 returns exactly what the table says, one test per row.
- No key returns an action with Ctrl, Cmd or Alt held, with an input focused, or with a dialog open.
- `answer` only in `cpuTurn`, its index always below `answers`; `next` only in the two review phases; `startGuess` only in `playerTurn` not guessing.
- `ask` and `removeLast` only at Level 2 in `playerTurn`, not guessing, with a non-empty tray.
- `togglePinyin` never at Level 1; `switchPronoun` never at Level 2; `focusFind` only at Level 2 in `playerTurn`, not guessing.
- Upper-case letters return the same as lower-case.
- The function is pure (lint).

**Traced example.** Context `{ phase: "cpuTurn", level: 2, guessing: false, dialogOpen: false, answers: 7, trayEmpty: true, logEmpty: false }`, key `{ key: "2", ctrlKey: false, metaKey: false, altKey: false, targetTag: "BODY", targetEditable: false }`. Steps 1 to 3 pass (no modifier, BODY, no dialog). Step 4: `2` is in the table. Step 5: the cell is `answer`, and 2 ≤ 7. Returns `{ type: "answer", index: 1 }`. `Game` takes `answerIds("v.shi|n.yisheng", 2)[1]`, which is `a.bushi`, and dispatches `ANSWER { answerId: "a.bushi", hintShown: false }`, exactly as a click on 不是. Failing variants: the same key at Level 1 (`answers: 2`) returns `{ index: 1 }`, which is the no-form, 不是; `3` at Level 1 fails the condition and returns `null`; `2` with `metaKey: true` stops at step 1.

### ZS 9.4 Focus

| Key | Where | Action |
|---|---|---|
| ← ↑ → ↓ | Board (`lg`) | Move one card; no wrap |
| Home / End, Ctrl+Home / Ctrl+End | Board | First or last in the row; first or last on the board |
| Enter / Space | Card | Flip it, or pick it while guessing |
| `i` or the context menu key | Card | Open CardDetail |
| ↑ ↓ ← → | Level 1 groups | ↑ ↓ within a column, ← → to the same row of the next column (or its last row); asked questions are skipped; Enter asks |
| Tab, ← → | Level 2 tiles | Each row (tray, then the four rows) is one tab stop, with ← → inside it; Enter adds a tile, or removes it in the tray |
| ↑ ↓ | Round log | Move between entries |

The board grid follows the WAI-ARIA grid pattern (APG: Grid), with roving tabindex: one card has `tabIndex=0`. `b` and `g` move focus to that card. The phone's focus-only "Zoom {name}" button stays. All roving tabindex is `lg` only; the phone's tab order is unchanged.

**ShortcutsDialog**: a `<dialog>` titled "Keyboard shortcuts", `min(90vw, 36rem)`, listing ZS 9.2's keys in two columns and the find field's keys of ZS 7.2. Opened by `?` and by the GameMenu item "Keyboard shortcuts".

**GameMenu fix**: it closes on Esc and on a click outside it, and focus returns to the menu button (Chi è?'s GameMenu has this; Shéi's does not).

## ZS 10. Other screens

### ZS 10.1 Home

```
┌──────────────────────────── max-w-5xl ────────────────────────────┐
│  谁？                                  │  Level                      │
│  Shéi?                                 │  ┌────────────┐┌───────────┐│
│  Ask questions in Chinese to find      │  │ Level 1    ││ Level 2   ││
│  the secret character.                 │  └────────────┘└───────────┘│
│  ┌ You have a round in progress ────┐  │  [ Play ]                   │
│  └──────────────────────────────────┘  │                             │
└────────────────────────────────────────┴─────────────────────────────┘
```

- `grid grid-cols-2 gap-12`, vertically centred under DesktopNav.
- Left: `谁？` in `text-6xl font-bold` with `lang="zh-Hans"`; "Shéi?" under it in `text-2xl text-stone-600` with `lang="zh-Latn-pinyin"`; the pitch line "Ask questions in Chinese to find the secret character."; the existing round-in-progress card when there is one.
- Right: the existing level `fieldset` (legend "Level") as two cards side by side, with the Level 1 description in its desktop wording (ZS 6.2), then Play full width.
- The phone's "Chinese" line, sign-in line and links are hidden at `lg`; DesktopNav has them.

### ZS 10.2 Round end

- `grid grid-cols-2 gap-10` in `max-w-6xl`.
- Left: "You won!" or "You lost.", both cards ("Your card", "Computer's card") side by side at `w-48` with names and pinyin, this round's mistakes, then "Play again" and "Home" in a row. The action bar is not `fixed` at `lg`, and the phone's `pb-28` is removed.
- Right: the round log (ZS 7.3), full height, every word glossable with English, and the guest nudge under it.
- "Play again" has focus when the screen appears.

### ZS 10.3 Progress dashboard

- `max-w-6xl`. A row of four stat tiles in a `<dl>`, labelled exactly "Words seen", "Due today", "Mistakes this week", "Rounds played", from the shared `progressStats()`.
- At `lg` the tablist is not rendered: Mistakes (grouped by word and grammar point, with each point's title and explanation, as today) and Due show side by side, `grid-cols-2 gap-6`, each under an `h2` ("Mistakes", "Due"), each scrolling on its own.
- Words in both lists are glossable (ZS 7.4).
- Empty state: "Play a round to see your words here." once, full width, tiles hidden. Loading: "Loading…" once, no tiles.
- The phone's Home link is hidden at `lg`.

### ZS 10.4 Dialogs

| Dialog | Phone (unchanged) | Desktop |
|---|---|---|
| CardDetail | Centred, face `min(80vw, 22rem)` | Centred, face `28rem`, attributes in Chinese with pinyin |
| GuessConfirm | `min(90vw, 22rem)` | `24rem`; focus starts on the confirm button |
| SaveProgressPrompt, SignInSheet | as today | Already shared and desktop-ready |
| GameMenu | Popover | Popover; closes on Esc and outside click |
| ShortcutsDialog | `min(90vw, 36rem)` | `36rem` |

All close on Esc and on a backdrop click and return focus to what opened them.

Settings and Privacy are shared screens and already have their desktop layouts (DS 9.4, 9.5); no change.

## ZS 11. Data, backend and states

**Data and backend: no change.** No tables, columns, access rules, sync rules, settings or environments. The Pinyin toggle and the pronoun are the existing device settings (`settings:zh`). Phone and desktop share the account, guest storage and outbox, so a round started on a phone continues on a laptop after sign-in.

**States.** Every state in `zh.md` 8.2 applies. The desktop differences:

| State | Where | Desktop behaviour |
|---|---|---|
| Loading | Game | Skeleton 6 × 4 grid at the ZS 5.2 card size, plus an empty panel outline |
| Loading | Progress | "Loading…" once, full width; no tiles |
| Empty | Round log | "Questions you and the computer ask show up here." |
| Empty | Progress | "Play a round to see your words here." once, full width; no tiles |
| Empty | Find field, no match | "No word matches “{query}”." |
| Full | Find field, 6 tiles in the tray | "The question is full. Ask it, or remove a word." |
| Error: sync failed | Any screen | SyncBanner under DesktopNav; in Game, under TopBar |
| Sign-in unavailable | Settings | As `zh.md` 8.2 |
| Resume | Home, DesktopNav | Home shows the round card; DesktopNav's Play reads "Continue"; the log rebuilds from `history` |
| Narrow window | Any | Below 1024px the phone layout; no "too small" state |

## ZS 12. Non-functional

- **Browsers.** The current and previous major versions of desktop Chrome, Firefox, Safari and Edge (`zh.md` 9).
- **Minimum desktop viewport.** 1024 × 640, as success criterion 2.
- **Fonts.** System Chinese fonts only (`zh.md` 9); no web font. The manual pass checks 16px card names and 24px gloss characters in PingFang SC (macOS) and Microsoft YaHei (Windows).
- **Stack.** No new dependencies: Tailwind v4 `lg:` and `hover:`, React `useSyncExternalStore`, `String.prototype.normalize`, Playwright's desktop devices.
- **New files:**

  ```
  src/core/ui/
  ├── boardLayout.ts (+ .test.ts)      moved, ZS 4
  ├── useHoverPreview.ts               moved
  ├── Kbd.tsx  SidePanel.tsx  ShortcutsDialog.tsx   moved
  ├── shortcutGuard.ts (+ .test.ts)    new, from DS 4.3
  ├── progressStats.ts (+ .test.ts)    moved
  └── Tooltip.tsx                      new
  src/languages/zh/ui/game/
  ├── shortcuts.ts (+ .test.ts)
  ├── roundLog.ts (+ .test.ts)  RoundLog.tsx
  ├── findTiles.ts (+ .test.ts)  FindField.tsx
  ├── gloss.ts (+ .test.ts)  Glossable.tsx
  ├── QuestionGroups.tsx
  └── CardPreview.tsx
  e2e/zh/
  └── desktop.spec.ts
  ```

- **Accessibility (WCAG 2.2 AA).** axe clean on every `/zh` screen at 1440 × 900. Focus ring always visible. Pointer targets at least 24 × 24px (SC 2.5.8); the phone's 44px rule stays because components are shared. Everything reachable without a mouse: the card preview's keyboard equivalent is `i`, the gloss's is the focused log entry's English line. Glosses meet SC 1.4.13. Every control with a shortcut has `aria-keyshortcuts`. Chinese has `lang="zh-Hans"`, pinyin `lang="zh-Latn-pinyin"`.
- **Performance.** Hover and focus cause no layout shift (CLS 0 during play). The preview and gloss position once per show; no scroll or resize listeners while closed. `findTiles` over 21 tiles runs on every keystroke with no debounce. `/zh` grows by under 12 kB gzipped and stays under its 250 KB budget, checked by `pnpm check:bundle`. Lighthouse desktop accessibility at least 95 on `/zh` and `/zh/play`.
- **Motion.** Every new transition is off under `prefers-reduced-motion`.
- **Privacy and security.** No change: no new data, no third parties. The find field's text is never stored or sent.
- **Error reporting.** No change.
- **CI.** `e2e/zh/desktop.spec.ts` runs in the `desktop-chromium` and `desktop-webkit` projects now, without waiting for PLAY-038's repointing of the older `e2e/zh` specs (ZD12): `playwright.config.ts` narrows the `shei` skip so it no longer matches this file.

## ZS 13. Test plan and definition of done

### ZS 13.1 Spec sign-off (before building)

1. Paper-trace ZS 2.1 twice at each level using only this spec, once by keyboard and once by mouse. Log every guess as a fix or a `TBD:`.
2. A developer reviews ZS 4, ZS 5, ZS 7.2 and ZS 9 (shared code, layout math, the combobox, the shortcut contract).
3. Fold in the review, resolve or park every `TBD:`, and tag this spec `v1`.

No Mandarin review is needed: ZS 1's table puts new Chinese strings out, and every Chinese word shown comes from reviewed content.

### ZS 13.2 Tests

| Layer | Tool | Covers |
|---|---|---|
| Shortcut logic | Vitest | Every cell of ZS 9.2, the check order, the ZS 9.3 invariants |
| Find logic | Vitest | `pinyinKey` and `findTiles`: every row of the ZS 3 table, the invariants |
| Round log, glosses | Vitest | `roundLog` invariants against seeded rounds from `simulate.ts`; `glossShowsEnglish` for every phase and level |
| Shared parts | Vitest | Chi è?'s existing tests unedited; `boardVars` and `previewSpot` with a caption; `shortcutGuard` |
| Layout and components | Vitest (`Game.test.tsx`) | Skeleton has 24 cells; QuestionGroups puts each noun under its verb |
| Desktop end to end | Playwright `desktop-chromium`, `desktop-webkit` | ZS 13.3 |
| Phone end to end | Playwright phone projects | Unchanged |
| Accessibility | Playwright and axe | Every `/zh` screen at 1440 × 900, the keyboard round |
| Manual | Real laptops | ZS 13.4 |
| User testing | Playtesters | At least 2 play one round at each level on a laptop |

### ZS 13.3 Desktop e2e cases (`e2e/zh/desktop.spec.ts`)

| Case | Check |
|---|---|
| Fits | At 1024 × 640 and 1440 × 900, both levels: 24 cards visible, no page scroll, the summary and actions visible, each phase area at most 378px tall at 1024 × 640 |
| Layout | The board column's width equals six cards plus gaps and padding; the panel is between 448 and 640px |
| No sheet | No "Questions" toggle button; `aside[aria-label="Questions"]` present |
| Groups | At Level 1, three columns headed 是, 有, 在 holding 5, 5 and 4 questions |
| Type-to-find | Typing `ta`, Enter, `you`, Enter, `gou`, Enter, `ma`, Enter, Enter asks 他有狗吗？ (success criterion 3) |
| Find edge cases | `zz` shows "No word matches “zz”."; Backspace on the empty field removes the last tile; `nv` finds 女的 |
| Log | After two turns the log holds two entries, newest first; `l` focuses the newest; its English line shows |
| Glosses | Hovering 狗 in the log during `playerReview` shows "dog"; during `cpuTurn` at Level 2 the gloss has no English |
| Hover preview, right-click | As DS 13.3 |
| Keyboard rounds | A full round at each level using only ZS 9's keys, to round end |
| Shortcuts ignored | Typing "nap" in the find field changes nothing but the field |
| Resize | At 1440 × 900 flip 3 cards and put 2 tiles in the tray; resize to 390 × 844 and back: the same 3 flipped, the same 2 tiles |
| Screens | No horizontal scroll on `/zh`, `/zh/progress`, `/settings`, `/privacy` at 1024 and 1440; DesktopNav on every one but `/zh/play` |
| Progress | No tablist at `lg`; both lists visible; the 4 tiles match `progressStats` for a seeded log |

### ZS 13.4 Manual

| Device | Check |
|---|---|
| MacBook with trackpad: Chrome and Safari at 1280 and 1440 wide | A round at each level by mouse and by keyboard; the type-to-find flow with and without the macOS Pinyin input method |
| Windows laptop with mouse: Edge and Firefox at 1920 × 1080 | The same, with Microsoft Pinyin; right-click detail; Microsoft YaHei readability |
| Any laptop, window dragged across 1024px mid-round | Nothing lost |

### ZS 13.5 Definition of done

- [ ] `zh-desktop.md` reviewed and tagged `v1`
- [ ] The shared parts live in `src/core/ui`, and Chi è?'s tests pass unedited
- [ ] A full round at each level plays by mouse only and by keyboard only at 1024 × 640 and 1440 × 900
- [ ] At 1024 × 640 the board, summary, actions and every phase area fit with no scroll
- [ ] `他有狗吗？` can be asked by typing pinyin alone
- [ ] The round log and glosses work, and no English gloss shows while a rating is pending
- [ ] No horizontal scroll on any `/zh` screen at 1024 and 1440
- [ ] The phone layout is unchanged; all phone tests pass without edits
- [ ] Desktop Playwright projects green in CI with `e2e/zh/desktop.spec.ts`; axe clean at desktop size
- [ ] The manual checks of ZS 13.4 done and logged
- [ ] At least 2 playtesters have played a round at each level on a laptop; findings logged

### ZS 13.6 Milestones

The build runs in the platform's Sprint 4, before launch (ZD13), on the days that have room in `planning/backlog.md`. The review starts now because it waits on someone else.

| Day | Date | Deliverable | Done when |
|---|---|---|---|
| 1 | Thu Oct 8 | Request the developer review of this spec; ask 2 playtesters for a laptop session in the week of Nov 9 | Review requested with a return date of Wed Oct 14; 2 playtesters confirmed |
| 3 | Wed Oct 14 | Paper trace, fold in the review, tag `v1` | Spec tagged `v1` |
| 12 | Mon Nov 9 | Shared parts moved to `src/core`; layout and side panel | Chi è? tests unedited and green; 24 cards and the panel fit at 1024 × 640 |
| 13 | Tue Nov 10 | Level 1 groups, round log, glosses, card preview | ZS 7.1, 7.3, 7.4 and ZS 8 work |
| 14 | Wed Nov 11 | Type-to-find and keyboard play; other screens | A full round at each level by keyboard; ZS 10 at 1024 and 1440 |
| 15 | Thu Nov 12 | Desktop e2e, manual pass, laptop playtests | CI green; ZS 13.4 logged; 2 laptop sessions logged |
| 16 | Fri Nov 13 | Fix must-fix findings before launch | Every must-fix desktop finding fixed or the desktop layout is held back (ZS 14.2, ZD14) |

## ZS 14. Future work and decision log

### ZS 14.1 Future work

**Tablet layout (768 to 1023px).** Tablets get the phone layout centred. A tablet layout needs real iPad and Android tablet testing in both orientations; out of v1.

**Typed whole questions.** `zh.md`'s Level 3: typing 他有狗吗 as one string, with an IME or pinyin. Type-to-find is the first step; parsing free text and giving feedback on it is a new engine feature.

**Drag and drop.** Dragging tiles into and within the tray. Ordering is free (`zh.md` D9), so dragging adds little that clicking does not.

**Audio.** A button to hear any sentence. Out, as in `zh.md`: it needs recordings or a TTS choice, a Mandarin check, and budget.

**Customisable shortcuts.** Remapping keys needs settings, storage and conflict checks. Out until playtests show the defaults fail.

**Glosses for every word everywhere.** Including tiles and the CPU's question, with ratings adjusted when a gloss was opened, as the hint does. Out until playtests show learners want it.

**Progress history and visual regression tests.** As DS 14.1.

### ZS 14.2 Decision log

| # | Decision | Reason |
|---|---|---|
| ZD1 | No new stored data or content | Desktop is presentation; everything shown exists in content and `history` |
| ZD2 | Chi è?'s language-neutral desktop parts move to `src/core/ui` | One fix reaches both games and copies cannot drift; Chi è?'s unedited tests guard the move |
| ZD3 | The card size comes from the height; the board column is six cards wide; the panel takes the rest, 28 to 40rem | A captioned 6 × 4 board is height-bound on common windows, so a fixed panel wastes width the panel needs for tiles and the log |
| ZD4 | Captions grow to 16px and 12px at `lg` | Phone sizes are hard to read at laptop distance; the longest pinyin fits the smallest desktop card |
| ZD5 | The panel shows `sheetFor()`'s content, with grouped questions and Clear and Ask moved to the actions at `lg` | One source of truth for each phase; the moved buttons never scroll away and free 56px |
| ZD6 | Level 1 questions grouped by verb in three columns | All 14 fit without scrolling, and the grouping teaches 是, 有, 在 |
| ZD7 | Level 2 type-to-find with pinyin or an IME, no rating change | How Chinese is typed on a computer; producing pinyin from meaning is the recall the `produce` card measures |
| ZD8 | A round log in the panel, newest first, shared with round end | The laptop has room; rereading correct Chinese every turn helps, and the history helps reasoning about the board |
| ZD9 | Word glosses on resolved text only, without English while a rating is pending | Lookup is how desktop readers learn; English during a pending rating would make the rating meaningless |
| ZD10 | Single-key shortcuts with English mnemonics, `zh.md` 8.3's keys plus `a`, `/`, `l`, Backspace | Fast play with both hands on the keyboard; the UI chrome is English |
| ZD11 | `p` works in every Level 2 phase | Pinyin shows on the CPU's question, the answers and the log too |
| ZD12 | `e2e/zh/desktop.spec.ts` runs now, not after PLAY-038 | Written for `/zh`, it does not need the older specs repointed |
| ZD13 | Built before launch, in Sprint 4 | The owner's choice; `zh.md` success criterion 1 already promises the laptop at launch |
| ZD14 | If must-fix desktop findings remain on launch day, `/zh` launches with the desktop layout off (route widths back to `lg:max-w-md`) | A one-line fallback; the phone layout is the tested baseline |
| ZD15 | `a` asks, replacing `zh.md` 8.3's "Enter in the tray" | Enter on a focused tile already adds or removes it; Enter on the empty find field also asks |

## ZS 15. References

- `it-desktop.md` (Chi è? desktop spec, "DS") and `zh.md` (Shéi MVP spec), in this repo.
- W3C WAI-ARIA Authoring Practices, Combobox pattern (editable combobox with listbox popup: `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-autocomplete="list"`; Down Arrow, Enter, Escape): https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- W3C WAI-ARIA Authoring Practices, Grid pattern (keyboard and roving tabindex): https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- W3C, Understanding WCAG 2.2 SC 1.4.13 Content on Hover or Focus (AA: dismissible, hoverable, persistent): https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html
- W3C, Understanding WCAG 2.2 SC 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- MDN, `keydown` event, ignoring keydown during IME composition (`isComposing`, `keyCode` 229): https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event
- MDN, `KeyboardEvent.isComposing`: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing
- MDN, `String.prototype.normalize` (NFD decomposes precomposed characters): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
- MDN, `hover` and `pointer` media features: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover
- MDN, `contextmenu` event: https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
- Tailwind CSS, Responsive design (`lg` is 64rem) and v4 upgrade guide (`hover:` only under `(hover: hover)`): https://tailwindcss.com/docs/responsive-design, https://tailwindcss.com/docs/upgrade-guide

## ZS 16. Changelog

- 2026-10-08: v0. Full desktop spec for Shéi, replacing the v0.1 list of differences from `it-desktop.md`. Adds the height-sized board with a flexible panel, Level 1 questions grouped by verb, Level 2 type-to-find, the round log and word glosses. Level 2 builder measured on the production build: the 7-tile row overflows a 22rem panel and the builder is 388px tall with Clear and Ask.
