# Chi è?: Desktop Spec

| | |
|---|---|
| Status | v0.2 draft (2026-10-07). Becomes `v1` after the sign-off in DS 13.1 |
| Product name | **Chi è?** ("Who is it?"). The same branding rules as `spec.md`: never "Guess Who" or "Indovina chi?" in public branding |
| Audience for this doc | Whoever builds, reviews, or tests the desktop layout |
| Builds on | `spec.md` (the MVP spec). Anything this doc does not mention works exactly as `spec.md` says |

Conventions: each section leads with the decision, then the reason. `TBD:` marks an open question. Exact strings the app must show are written exactly, in quotes or code. Sections here are numbered `DS n` so they never clash with `spec.md` sections; decisions are `DD n`. Backlog cards are CHI-116 to CHI-127, epic **Desktop**.

---

## DS 1. Scope and non-goals

**Goal.** Make Chi è? feel built for a laptop: the board large and central, the questions beside it, playable by mouse or entirely by keyboard. The phone experience stays exactly as it is.

**The problem today.** Every screen is capped at 448px (`max-w-md` in `src/ui/Layout.tsx`), so on a laptop the app is a phone-sized strip in the middle of an empty page. Nothing in `src/ui` responds to screen size, hover, or keys beyond native buttons.

**Target user.** The same adult A1 learner as `spec.md` §1, at a laptop or desktop (13 to 27 inch screen, browser window 1024px wide or more) with a trackpad or mouse and a physical keyboard. Typically studying at a desk, sessions of 10 to 20 minutes.

**Success criteria.** The desktop work is done when all of these are true:

1. A full round plays to the end by mouse only, and again by keyboard only, at 1024 × 640 and at 1440 × 900.
2. At 1024 × 640, all 24 cards and the whole side panel are visible with no page scroll in either direction.
3. Every screen (`/`, `/play`, round end, `/progress`, `/settings`, `/privacy`) has no horizontal scroll at 1024 and 1440 wide.
4. The phone layout is unchanged, and every existing phone e2e test passes without being edited.
5. axe reports no violations on every screen at desktop size.

| In desktop v1 | Out of desktop v1 (future, DS 14.1) |
|---|---|
| Layout for windows 1024px wide or more | Tablet-specific layouts (768 to 1023px) |
| App shell with a top nav | Sidebar navigation, collapsible menus |
| Game: 6 × 4 board and an always-open side panel | Resizable or detachable panel |
| Hover preview, right-click detail | Drag and drop, multi-select flipping |
| Keyboard shortcuts with a help dialog | User-customisable shortcuts |
| Progress dashboard built from existing data | Charts, streaks, history over time |
| Two-column Home, Round end; wider Settings, Privacy | New settings or content |
| Desktop Playwright projects and a manual laptop pass | Visual regression screenshots |

Rule: anything not in the left column is out. New ideas go to DS 14.1, not into the build. Nothing in `spec.md` sections 2 to 7 (rules, content, engine, CPU, learning, backend) changes.

## DS 2. Behaviour on desktop

### DS 2.1 A desktop round, step by step

1. The learner opens `chie.parlaplay.games` in a 1280 × 800 window. DesktopNav shows across the top; Home shows two columns (DS 9.1).
2. They pick Level 1 and click **Play** (or press Enter on it). `/play` opens with no DesktopNav: TopBar on top, the 6 × 4 board on the left, the side panel on the right with the summary "Your turn: ask a question, or guess." and the question list.
3. They hover a card for 350 ms; a larger preview appears over it (DS 7.2). They move the pointer away and it disappears.
4. They press `q`; focus moves to the first enabled question. ↓ twice, Enter: the question is asked. The panel shows the answer (phase `playerReview`).
5. They press `b`; focus moves to the board. They use the arrow keys and Enter to flip down the cards the answer rules out, then press `a` (Avanti).
6. The CPU asks its question (phase `cpuTurn`). The panel shows it with **Sì** / **No**. They press `s`. The panel shows ✓ or ✗ (phase `cpuReview`). They press `a`.
7. On a later turn they press `g` to guess. The summary changes to "Click the card you think it is." and focus moves to the board. They move to a card and press Enter; GuessConfirm opens with focus on its confirm button; Enter confirms.
8. Round end shows in two columns; "Play again" has focus.

At every step the mouse works too: clicking does exactly what tapping does on the phone.

### DS 2.2 Edge cases

| Situation | Rule |
|---|---|
| Window resized across 1024px mid-round | Layout swaps (Sheet and SidePanel, 4 × 6 and 6 × 4). Game state, flipped cards, a guess in progress, a half-built Level 2 question and a shown hint are kept: `Game` holds the TileBuilder draft and CpuQuestion's `hintShown`, because the sheet and the panel are different trees (CHI-120) |
| Focused element unmounted by a resize | Focus moves to the board's roving card (DS 8.2) |
| Window narrower than 1024px on a laptop | Phone layout, centred, exactly as today. No "too small" message |
| Window shorter than 640px at 1024px or wider | Cards shrink to fit (the board formula uses height too). Below about 520px tall the panel body scrolls; the actions never leave view |
| Touch laptop (touch is the primary input) | `(hover: hover)` is false, so no hover preview; long-press still opens detail; layout is still desktop |
| Mouse on a phone-sized window | No hover preview (DS 7.2 requires `lg`); right-click still opens detail |
| Shortcut key pressed while typing in the sign-in email or code field | Ignored (DS 4.3 step 2) |
| Shortcut pressed with a dialog open | Ignored, except the dialog's own Enter and Esc (DS 4.3 step 3) |
| `s` / `n` pressed outside the CPU turn | Nothing happens; no sound, no message |
| `g` pressed while already guessing | Nothing happens |
| `a` pressed outside a review phase | Nothing happens |
| `?` pressed with the shortcuts dialog already open | Nothing happens (a dialog is open) |
| Cmd+R, Ctrl+F, Cmd+L and other browser shortcuts | Never intercepted (DS 4.3 step 1) |
| Firefox Shift+right-click | Shows the browser menu; Firefox does not fire `contextmenu` then (MDN). Accepted |
| Context menu key on the keyboard, focus on a card | Opens CardDetail, the same as right-click |
| Right-click on anything that is not a card | Normal browser menu |
| Hover preview open when a dialog opens | Preview closes at once |
| Hover on a card while guessing | No preview (DS 7.2) |
| Reload mid-round on desktop | Same as `spec.md` 8.2 Resume: Home offers "Continue round"; DesktopNav's Play reads "Continue" |
| All 24 cards flipped down | "Unflip all" appears centred over the board, as on the phone (`spec.md` §2 edge cases) |
| No progress data | Progress shows the empty message once, full width, with no stat tiles (DS 9.3) |

## DS 3. Data and content model

**Decision: no new stored data.** No schema, table, sync or content change. The reason: desktop is a presentation layer; everything it shows already exists.

Two new in-memory types:

```ts
// src/ui/progressStats.ts (pure; unit-tested)
export type ProgressStats = {
  wordsSeen: number;        // distinct lexiconId in reviewLog
  dueToday: number;         // reviewed cards (word × direction) where isDue(card, endOfLocalDay(now))
  mistakesThisWeek: number; // rows with rating "again" or "slip" and localDay in the last 7 local days, today included
  roundsPlayed: number;     // games rows with endedAt set
};
export function progressStats(data: GuestData, now: Date): ProgressStats;
```

Example, for a learner who has played 3 rounds:

```json
{ "wordsSeen": 14, "dueToday": 5, "mistakesThisWeek": 3, "roundsPlayed": 3 }
```

```ts
// src/ui/game/shortcuts.ts: see DS 4
```

**Invariants** (each checked by a unit test, not by hand):

- `0 ≤ dueToday ≤` the number of reviewed cards `≤ 2 × wordsSeen` (each word has a card per direction).
- `mistakesThisWeek` never counts a row older than 7 local days.
- `progressStats` with empty data returns all zeros.
- `dueToday` equals the number of rows the Due tab lists for the same `now`.

## DS 4. Core logic contract: shortcuts

The heart of the desktop work is turning a key press into one of the game's existing actions. It is a pure function so it can be tested exhaustively.

### DS 4.1 Types

```ts
// src/ui/game/shortcuts.ts
export type KeyLike = {
  key: string;            // KeyboardEvent.key
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  targetTag: string;      // "INPUT", "TEXTAREA", "BUTTON", "LI", ...
  targetEditable: boolean; // isContentEditable
};

export type ShortcutContext = {
  phase: GameState["phase"];
  level: 1 | 2;
  guessing: boolean;
  dialogOpen: boolean;    // any modal <dialog> open
};

export type ShortcutAction =
  | { type: "focusQuestions" }   // q
  | { type: "focusBoard" }       // b
  | { type: "startGuess" }       // g
  | { type: "cancelGuess" }      // Escape
  | { type: "answer"; value: boolean } // s, n
  | { type: "showHint" }         // h
  | { type: "next" }             // a (Avanti)
  | { type: "openHelp" };        // ?

export function keyToAction(k: KeyLike, ctx: ShortcutContext): ShortcutAction | null;
```

`Game` maps each action to handlers that exist today (`h.next`, `h.startGuess`, `h.cancelGuess`, `h.answer`) or to a focus move. `showHint` clicks CpuQuestion's own "Show hint" button, so the hint rule in `spec.md` §6 (revealing it removes the rating) is unchanged.

**Board keys are not in this table.** Arrows, Home, End, Enter, Space and `i` are handled by the board's own `onKeyDown` (DS 8.2), because they need the focused card.

### DS 4.2 Transition table

Rows are contexts; `-` means `null` (nothing happens). Matching is on `event.key`, case-insensitive for letters.

| Context | `q` | `b` | `g` | `Escape` | `s` | `n` | `h` | `a` | `?` |
|---|---|---|---|---|---|---|---|---|---|
| `setup` | - | focusBoard | - | - | - | - | - | - | openHelp |
| `playerTurn`, not guessing | focusQuestions | focusBoard | startGuess | - | - | - | - | - | openHelp |
| `playerTurn`, guessing | - | focusBoard | - | cancelGuess | - | - | - | - | openHelp |
| `playerReview` | - | focusBoard | - | - | - | - | - | next | openHelp |
| `cpuTurn`, level 1 | - | focusBoard | - | - | answer(true) | answer(false) | showHint | - | openHelp |
| `cpuTurn`, level 2 | - | focusBoard | - | - | answer(true) | answer(false) | - | - | openHelp |
| `cpuReview` | - | focusBoard | - | - | - | - | - | next | openHelp |
| `over` | - | - | - | - | - | - | - | - | - |

`over` is all `-` because RoundEnd replaces the game screen and has its own buttons.

### DS 4.3 Order of checks

The first rule that matches returns `null`:

1. `ctrlKey`, `metaKey` or `altKey` is held. (Shift is allowed, because `?` needs it on most layouts.)
2. The target is an `INPUT`, `TEXTAREA` or `SELECT`, or `targetEditable` is true.
3. `dialogOpen` is true.
4. The key is not in the table in DS 4.2.
5. The table cell is `-`.

Otherwise, return the cell's action.

### DS 4.4 Invariants

Each is a unit test in `src/ui/game/shortcuts.test.ts`:

- Every cell of DS 4.2 returns exactly what the table says (one test per row).
- No key returns an action with Ctrl, Cmd or Alt held.
- No key returns an action when the target is an input, textarea, select or contenteditable.
- No key returns an action when a dialog is open.
- `answer` is only ever returned in `cpuTurn`; `next` only in `playerReview` and `cpuReview`; `startGuess` only in `playerTurn` when not guessing.
- Upper-case `S` returns the same as `s`.
- The function is pure: the same inputs give the same output, and it reads no globals (checked by the existing `engine-purity` style lint over `src/ui/game/shortcuts.ts`).

### DS 4.5 Traced example

Context: `{ phase: "cpuTurn", level: 1, guessing: false, dialogOpen: false }`.
Key: `{ key: "s", ctrlKey: false, metaKey: false, altKey: false, targetTag: "BODY", targetEditable: false }`.

1. Step 1: no modifiers. Continue.
2. Step 2: the target is BODY. Continue.
3. Step 3: no dialog open. Continue.
4. Step 4: `s` is in the table. Continue.
5. Step 5: the cell for `cpuTurn, level 1` × `s` is `answer(true)`.

Returns `{ type: "answer", value: true }`. `Game` calls `h.answer(true, hintShown)`, where `hintShown` is CpuQuestion's current state. The engine receives `ANSWER { value: true, hintShown }` and moves to `cpuReview`, exactly as if Sì had been clicked.

Failing variants:

- The same key with `metaKey: true` (Cmd+S, the browser's Save) stops at step 1 and returns `null`; the browser saves the page as usual.
- The same key in `playerReview` stops at step 5 and returns `null`; nothing happens.

### DS 4.6 Purity

`shortcuts.ts` imports only types. It does not touch `document`, `window`, the DOM, timers, the clock, or the store. One `keydown` listener on `document`, added by `Game` in an effect and removed on unmount, builds `KeyLike` and `ShortcutContext` and calls it. When the result is not `null`, the listener calls `preventDefault()`.

## DS 5. Breakpoint and app shell

**Breakpoint: `lg`, which is 64rem (1024px), on width alone (DD1).** The reason: at 1024px there is room for a 6-column board and a 22rem (352px) panel side by side; narrower than that, the phone layout with its bottom sheet works better than a cramped two-pane one. `lg` is Tailwind's default 64rem breakpoint (Tailwind docs, Responsive design), so no custom breakpoint is needed.

- CSS uses the `lg:` variant.
- Where the game swaps **components**, not just classes (Sheet and SidePanel), it uses `useIsDesktop()` from a new `src/ui/useMediaQuery.ts`: `useSyncExternalStore` over `matchMedia("(min-width: 64rem)")`, re-rendering on change. On the server or in tests without `matchMedia` it returns `false` (the phone layout).
- Hover behaviour (DS 7) also requires `(hover: hover) and (pointer: fine)` (MDN: hover, pointer). Tailwind v4's `hover:` variant already only applies under `(hover: hover)` (Tailwind v4 upgrade guide), so phones never get stuck hover styles.

**App shell at `lg`.** The page background is `bg-stone-200`; each screen sits in a `bg-stone-50` area at its own max width. DesktopNav runs across the top of every screen except Game.

```
┌───────────────────────────────────────────────────────────────────┐
│ Chi è?        Play   Progress   Settings          Guest · Sign in │  DesktopNav, h-14, bg-white, border-b
├───────────────────────────────────────────────────────────────────┤
│ SyncBanner (when shown), full width                               │
├───────────────────────────────────────────────────────────────────┤
│                  ┌────────────── screen ─────────────┐            │
│                  │  max width per screen (table)      │            │
│                  └────────────────────────────────────┘            │
└───────────────────────────────────────────────────────────────────┘
```

**DesktopNav**, a new `src/ui/DesktopNav.tsx`, rendered by `Layout` only at `lg` and not on `/play`:

| Item | Text | Target |
|---|---|---|
| Wordmark | "Chi è?" | `/` |
| Play | "Play", or "Continue" when a round is saved (the same rule as Home's "Continue round") | `/play` |
| Progress | "Progress" | `/progress` |
| Settings | "Settings" | `/settings` |
| Account, right-aligned | the email when signed in, or "Guest · Sign in" | `/settings` |

The current route gets `aria-current="page"` and an underline. It is a `<nav aria-label="Main">`.

| Screen | Max width at `lg` | Layout |
|---|---|---|
| Home | `max-w-5xl` (64rem) | Two columns (DS 9.1) |
| Game | Full width and height | Board and side panel (DS 6) |
| Round end | `max-w-6xl` (72rem) | Two columns (DS 9.2) |
| Progress | `max-w-6xl` | Dashboard (DS 9.3) |
| Settings | `max-w-3xl` (48rem) | Label and control rows (DS 9.4) |
| Privacy | `max-w-prose` (65ch) | One reading column (DS 9.5) |

**Game has no DesktopNav (DD5).** It is a focus screen: all the height goes to the board, and its menu already has "Quit round".

Below `lg`: the `max-w-md` column, no nav, no change.

## DS 6. Game screen

**Decision: the board on the left and an always-open side panel on the right; no bottom sheet (DD2).** The reason: a laptop has width to spare and little height, so the questions go beside the board, not over it. `spec.md`'s rule that the board never shrinks for questions still holds: the panel's width is fixed, so its content never resizes the board.

```
┌──────────────────────────────────────────────────────────────────────┐
│ TopBar: ☰ menu · Turn 3 · Your turn · [your secret card]             │  h-14, spans both columns
├───────────────────────────────────────────────┬──────────────────────┤
│   ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐               │ Your turn: ask a     │  summary
│   │  │ │  │ │  │ │  │ │  │ │  │               │ question, or guess.  │
│   └──┘ └──┘ └──┘ └──┘ └──┘ └──┘               ├──────────────────────┤
│   ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐               │ FeedbackText         │
│   │  │ │  │ │  │ │  │ │  │ │  │    6 × 4      │ QuestionPicker, or   │  body (scrolls)
│   └──┘ └──┘ └──┘ └──┘ └──┘ └──┘    board      │ TileBuilder, or      │
│   ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐               │ CpuQuestion          │
│   │  │ │  │ │  │ │  │ │  │ │  │               │                      │
│   └──┘ └──┘ └──┘ └──┘ └──┘ └──┘               │                      │
│   ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐               ├──────────────────────┤
│   │  │ │  │ │  │ │  │ │  │ │  │               │ [Indovina  G]        │  actions (pinned)
│   └──┘ └──┘ └──┘ └──┘ └──┘ └──┘               │ Press ? for shortcuts│
└───────────────────────────────────────────────┴──────────────────────┘
               1fr                                 minmax(22rem, 26rem)
```

### DS 6.1 Grid and board sizing

- The root is `grid h-dvh grid-rows-[auto_1fr] grid-cols-[1fr_minmax(22rem,26rem)]`; TopBar spans both columns.
- **The board is 6 columns × 4 rows on desktop (DD4)**, instead of 4 × 6. The reason: the board area is wider than it is tall, and a landscape grid gives bigger cards. At 1440 × 900 the cards are about 170px wide; 4 × 6 in the same space would give about 110px.
- The `--card-w` formula in `src/ui/game/Board.tsx` becomes generic:

  ```css
  --card-w: min(
    calc((100cqw - (var(--cols) - 1) * var(--gap)) / var(--cols)),
    calc((100cqh - (var(--rows) - 1) * var(--gap)) / var(--rows) * 5 / 6)
  );
  ```

  | | `--cols` | `--rows` | `--gap` | Board padding |
  |---|---|---|---|---|
  | Phone | 4 | 6 | 0.25rem | `px-2 py-1`, plus `pb-[7.5rem]` on the wrapper for the sheet |
  | `lg` | 6 | 4 | 0.5rem | `p-6`, no sheet reserve |

  Card order is the same (row-major), so card *n* keeps its reading position.
- The grid's `grid-cols-4` becomes `grid-cols-[repeat(var(--cols),auto)]`.
- The skeleton board (`spec.md` §8.2 Loading) uses the same variables, plus an empty panel outline at `lg`.
- **Card names scale with the card**: `font-size: clamp(10px, calc(var(--card-w) * 0.09), 16px)` replaces `text-[10px]`. On the phone `--card-w` is about 80px, so names stay at 10px there.

**Size floor.** At 1024 × 640, all 24 cards and the whole panel are visible with no page scroll. Cards are about 87px wide there: (1024 − 416 − 48 − 5 × 8) / 6 ≈ 87px wide, and (640 − 56 − 48 − 3 × 8) / 4 × 5 / 6 ≈ 107px allowed by height, so width wins.

### DS 6.2 Side panel

- A new `src/ui/game/SidePanel.tsx` renders `<aside aria-label="Questions">`. It takes the same `{ summary, body, actions }` that `sheetFor()` in `Game.tsx` builds today (DD3), so phone and desktop always show the same thing.
- Three parts:
  - **Summary**, at the top: the same line as the collapsed sheet, full size and not truncated, in an `aria-live="polite"` region.
  - **Body**, which scrolls on its own (`min-h-0 overflow-y-auto overscroll-contain`).
  - **Actions**, pinned at the bottom, then the hint "Press ? for shortcuts" in `text-sm text-stone-600`.
- No collapse toggle and no `aria-expanded`. `Game`'s `sheetOpen` state is ignored at `lg` but kept, so a resize back to the phone restores it.
- Buttons show their key on the right in a `<kbd>` at `lg` only: "Indovina G", "Avanti A", "Sì S", "No N", "Cancel guess Esc". The `<kbd>` is `aria-hidden`; the button gets `aria-keyshortcuts` (e.g. `aria-keyshortcuts="a"`).

| Phase | Summary | Body | Actions |
|---|---|---|---|
| `playerTurn` | "Your turn: ask a question, or guess." or "Try again." | FeedbackText and QuestionPicker (L1) or TileBuilder (L2) | Indovina |
| `playerTurn`, guessing | "Click the card you think it is." (the phone keeps "Tap the card you think it is.") | empty | Cancel guess |
| `playerReview` | The answer, in Italian | The question, the answer, info feedback, "Flip down everyone this rules out, then click Avanti." (the phone keeps "tap") | Avanti |
| `cpuTurn` | The CPU's question, in Italian | CpuQuestion (Sì, No, and "Show hint" at L1) | none |
| `cpuReview` | ✓ or ✗ and the answer | "Right!" or FeedbackText | Avanti |
| `over` | n/a: RoundEnd replaces the screen | | |

**Desktop wording.** The only strings that change are the two above, "Tap" to "Click" and "tap" to "click", chosen with `useIsDesktop()`. Italian strings never change.

## DS 7. Mouse

### DS 7.1 Clicking

Click works exactly like tap does today: click a card to flip it, click "Indovina" then a card then confirm. No change is needed, because `useLongPress` uses Pointer Events.

### DS 7.2 Hover preview

**Decision: hovering a card shows a larger read-only preview after a short delay (DD6).** The reason: long-press is how the phone shows a face up close, and with a mouse it is slow and nobody finds it.

- **When.** Only at `lg` with `(hover: hover) and (pointer: fine)`. It appears after the pointer rests on one card for **350 ms**, and hides as soon as the pointer leaves. Moving straight from one card to another while a preview is open swaps it at once, with no new delay.
- **What.** The card's face at 2× its board width, capped at `16rem`, with the name under it. No attribute list (that is CardDetail).
- **Where.** Centred over the hovered card, clamped inside the board area. It grows out of the card rather than sitting beside it, so it covers the card itself and not one side of neighbours; `pointer-events-none` keeps the card under it hoverable and clickable. Its position is computed once when it shows, from `getBoundingClientRect`.
- **How.** A new `src/ui/game/CardPreview.tsx`: `role="tooltip"`, `pointer-events-none`, no focus. While it is open the card has `aria-describedby` pointing to it.
- **Not shown** while a dialog is open (CardDetail, GuessConfirm, the menu, ShortcutsDialog), or while guessing, because then it would cover the cards the learner is aiming at. TBD: ask at the playtest whether it is wanted while guessing.
- **Motion.** A 120 ms fade in; none under `prefers-reduced-motion`. No layout shift.

### DS 7.3 Right-click

- **Right-click on a card opens CardDetail**, the same as long-press. `useLongPress` today calls `preventDefault()` on `contextmenu` and does nothing else; it changes to also call `onLongPress` unless a touch long-press already fired for this press.
- The browser menu is suppressed on cards only. Firefox shows it anyway on Shift+right-click, and does not fire the event then (MDN: contextmenu). That is accepted.
- The context menu key on a keyboard fires the same event on the focused card, so it opens CardDetail too.
- Long-press with the mouse still works, but is not advertised.

### DS 7.4 Hover styles

All use Tailwind `hover:`, which only applies on devices that can hover.

| Element | Hover style |
|---|---|
| Card, face up | `-translate-y-0.5` and `ring-2 ring-stone-400`, 100 ms transition |
| Card, flipped down | `ring-2 ring-stone-400` only |
| Card, while guessing | `ring-2 ring-blue-600`, `cursor-pointer` |
| Primary button | `bg-stone-700` |
| Secondary button | `bg-stone-300` |
| Question row | `bg-stone-200` (rows are already `bg-stone-100`) |
| Tile | `bg-stone-100` |
| DesktopNav link | underline |

## DS 8. Keyboard

**Decision: the whole game is playable from the keyboard with single-key shortcuts (DD7).** The reason: a learner with both hands on the keyboard should not have to reach for the mouse every turn.

### DS 8.1 Keys

| Key | Where | Action |
|---|---|---|
| ← ↑ → ↓ | Board | Move focus one card; no wrap at the edges |
| Home / End | Board | First or last card in the row |
| Ctrl+Home / Ctrl+End | Board | First or last card on the board |
| Enter / Space | Card focused | Flip it, or pick it as the guess while guessing |
| `i` or the context menu key | Card focused | Open CardDetail |
| ↑ / ↓ | QuestionPicker | Move between questions; Enter asks; disabled (already asked) questions are skipped |
| Tab, ← → | TileBuilder | Tab moves between tile rows; ← → move within a row (roving tabindex per row); Enter picks |
| `q` `b` `g` `s` `n` `h` `a` `?` `Esc` | Anywhere in Game | DS 4.2 |

The board keys follow the WAI-ARIA grid pattern (APG: Grid), including Ctrl+Home and Ctrl+End. `s` and `n` match the Italian *sì* and *no*; `a` is Avanti.

**Level 2 has no tile letter shortcuts (DD8).** The builder has about 30 tiles in four rows; single keys cannot cover that without modes. TBD: ask at the playtest whether L2 needs typed search.

Shortcuts work at every size (a phone with a keyboard benefits too). The "Press ? for shortcuts" hint and the `<kbd>` labels only show at `lg`.

### DS 8.2 Board focus model

- At `lg` the board is `role="grid"` with four `role="row"` elements, each holding six `role="gridcell"` cards. The rows follow `--cols` (`boardShape()`). Below `lg` it stays the list it was, every card a tab stop, so the phone is unchanged (DD11) and its e2e tests pass without edits. The same goes for TileBuilder's roving tabindex per row: `lg` only.
- **Roving tabindex**: exactly one card has `tabIndex=0` (the last focused, or the first card); the rest have `-1`. Tab enters and leaves the board in one stop.
- The phone's focus-only "Zoom {name}" button stays as the screen-reader path to CardDetail. At `lg`, `i` does the same thing.
- `b` and `g` move focus to the roving card.

### DS 8.3 Shortcuts dialog and menu

- A new `ShortcutsDialog`: a `<dialog>` titled "Keyboard shortcuts", `w-[32rem]`, with a two-column table of the keys in DS 8.1 and DS 4.2. It is opened by `?` and from the GameMenu item "Keyboard shortcuts".
- **GameMenu fix:** it closes on Esc and on a click outside it, and focus returns to the menu button. Today it does neither.

## DS 9. Other screens

### DS 9.1 Home

```
┌──────────────────────────── max-w-5xl ────────────────────────────┐
│  Chi è?                               │  Choose your level         │
│  Ask yes-or-no questions in Italian   │  ┌───────────┐┌───────────┐│
│  to find the secret character.        │  │ Level 1   ││ Level 2   ││
│                                       │  │ (as today)││ (as today)││
│  ┌ You have a round in progress ───┐  │  └───────────┘└───────────┘│
│  │ (Level 1, turn 4).              │  │                            │
│  │ [ Continue round ]              │  │  [ Play ]                  │
│  └─────────────────────────────────┘  │                            │
└───────────────────────────────────────┴────────────────────────────┘
```

- `grid grid-cols-2 gap-12`, vertically centred in the space under DesktopNav.
- **Left:** "Chi è?" in `text-6xl font-bold`; the pitch line "Ask yes-or-no questions in Italian to find the secret character."; the existing round-in-progress card when there is one.
- **Right:** the existing level `fieldset` with the labels and descriptions unchanged, laid out as two cards side by side (`grid-cols-2`), then the Play button full width.
- The links and sign-in status that Home shows on the phone are hidden at `lg`; DesktopNav has them.

### DS 9.2 Round end

- `grid grid-cols-2 gap-10`.
  - **Left:** the result headline, both secret cards side by side at `w-48`, then the action buttons ("Play again", "Home") in a row. At `lg` the action bar is **not** `fixed`, and the phone's `pb-28` is removed.
  - **Right:** the question history with answers, this round's mistakes, and the guest nudge (`spec.md` §8.2).
- "Play again" gets focus when the screen appears.

### DS 9.3 Progress dashboard

```
┌──────────────────────────────── max-w-6xl ─────────────────────────────┐
│ Progress                                                               │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│ │ 14       │ │ 5        │ │ 3        │ │ 3        │                    │
│ │ Words    │ │ Due      │ │ Mistakes │ │ Rounds   │                    │
│ │ seen     │ │ today    │ │ this week│ │ played   │                    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                    │
│ ┌──────── Mistakes ──────────┐  ┌────────── Due ─────────────┐         │
│ │ (Mistakes list, as today)  │  │ (Due list, as today)       │         │
│ └────────────────────────────┘  └────────────────────────────┘         │
└────────────────────────────────────────────────────────────────────────┘
```

- At `lg` **the tablist is not rendered**. Mistakes and Due show side by side (`grid-cols-2 gap-6`), each under an `h2` ("Mistakes", "Due") and each scrolling on its own if long. Below `lg`, the tabs are exactly as today.
- **Stat tiles**, a row of four, labelled exactly "Words seen", "Due today", "Mistakes this week", "Rounds played". Values come from `progressStats()` (DS 3). Each tile is a `<div>` with the number in `text-3xl font-semibold` and the label under it; the row is a `<dl>`.
- The empty state ("Play a round to see your words here.") shows once, full width, and the tiles are hidden.
- The Home link that Progress shows on the phone is hidden at `lg` (DesktopNav has it).

### DS 9.4 Settings

- `max-w-3xl`, sections headed "Game", "Account" and "About" (`h2`). Each setting is a row, `grid grid-cols-[1fr_auto] gap-6`: the label and its description on the left, the control on the right.
- The unsynced sign-out confirm (`spec.md` §7.3) is a centred modal, `w-[28rem]` at `lg`.

### DS 9.5 Privacy

- One column, `max-w-prose`, `text-lg leading-relaxed`. Content unchanged. A "Back to Settings" link at the top.

### DS 9.6 Dialogs

| Dialog | Phone (unchanged) | Desktop |
|---|---|---|
| SignInSheet | Bottom sheet | Centred modal, `w-[28rem]`, rounded on all corners (`lg:m-auto lg:rounded-2xl`) |
| CardDetail | Centred, face `min(80vw, 22rem)` | Centred, face `28rem` |
| GuessConfirm | `min(90vw, 22rem)` | `24rem`; focus starts on the confirm button |
| SaveProgressPrompt | `min(90vw, 22rem)` | `24rem` |
| GameMenu | Popover | Popover; closes on Esc and outside click |
| ShortcutsDialog | (new) | `32rem` |

All are `<dialog>`; all close on Esc and on a backdrop click, and return focus to whatever opened them.

## DS 10. Data and backend

No change. No new tables, columns, access rules, sync rules or environments. Desktop and phone share the same account, guest storage and outbox (`spec.md` §7), so a learner can start a round on the phone and continue it on the laptop after signing in, exactly as today.

## DS 11. States

Every state in `spec.md` §8.2 applies unchanged. The desktop differences:

| State | Where | Desktop behaviour |
|---|---|---|
| Loading | Game | Skeleton in the 6 × 4 grid, plus an empty panel outline |
| Loading | Progress | "Loading…" once, full width; no tiles |
| Empty | Progress | "Play a round to see your words here." once, full width; no tiles |
| Error: sync failed | Any screen | SyncBanner under DesktopNav, full width; in Game, under TopBar |
| Resume | Home, DesktopNav | Home shows the round card; DesktopNav's Play reads "Continue" |
| Narrow window | Any | Below 1024px the phone layout applies; there is no "too small" state |

## DS 12. Non-functional

- **Browsers.** The current and previous major versions of desktop Chrome, Firefox, Safari and Edge, as `spec.md` §9.
- **Minimum desktop viewport.** 1024 × 640. At that size and above: no horizontal scroll on any screen, and Game shows all 24 cards and the whole panel with no page scroll.
- **Stack.** No new dependencies. Tailwind v4 `lg:` and `hover:` variants (already installed, `^4.3.3`); `useSyncExternalStore` from React; Playwright `^1.63.0` built-in desktop devices.
- **New files**:

  ```
  src/ui/
  ├── DesktopNav.tsx
  ├── useMediaQuery.ts
  ├── progressStats.ts (+ .test.ts)
  └── game/
      ├── SidePanel.tsx
      ├── CardPreview.tsx
      ├── ShortcutsDialog.tsx
      └── shortcuts.ts (+ .test.ts)
  e2e/
  └── desktop.spec.ts
  ```

- **Accessibility.**
  - axe reports no violations on every screen at 1440 × 900.
  - The focus ring is always visible (the existing `:focus-visible` rule in `src/index.css`).
  - Pointer targets are at least 24 × 24 CSS px, WCAG 2.2 SC 2.5.8 Target Size (Minimum), level AA. The phone's 44px rule stays anyway, because the components are shared.
  - Everything is reachable without a mouse; the hover-only preview has a keyboard equivalent (`i`).
  - Shortcut buttons carry `aria-keyshortcuts`.
- **Performance.**
  - Hover and focus cause no layout shift (CLS 0 during play).
  - The preview positions once per show; no scroll or resize listeners while it is closed.
  - The production bundle grows by under 10 kB gzipped, checked by `pnpm check:bundle`.
  - Lighthouse desktop accessibility at least 95 on Home and Game.
- **Motion.** Every new transition is off under `prefers-reduced-motion`.
- **Privacy and security.** No change: no new third parties, no new data.
- **Error reporting.** No change; Sentry sees no new data.
- **CI.** The two desktop Playwright projects run in the same GitHub Actions e2e job as the phone projects.

## DS 13. Test plan and definition of done

### DS 13.1 Spec sign-off (before building)

1. Paper-trace the round in DS 2.1 twice using only this spec, once by keyboard and once by mouse. Log every guess as a fix or a `TBD:`.
2. A developer reviews DS 4, DS 6 and DS 8 (the shortcuts contract, the board and panel, focus).
3. Fold in the review, resolve or park every `TBD:`, and tag this spec `v1`.

No Italian review is needed: no Italian content changes.

### DS 13.2 Tests

| Layer | Tool | Covers |
|---|---|---|
| Shortcuts logic | Vitest | Every cell of DS 4.2, every rule in DS 4.3, the invariants in DS 4.4 |
| Progress stats | Vitest | The DS 3 definitions and invariants, using seeded `reviewLog` and `games` rows |
| Skeleton markup | Vitest (`Game.test.tsx`) | 24 cells; uses the column variables |
| Desktop end to end | Playwright `desktop-chromium`, `desktop-webkit` | The cases in DS 13.3 |
| Phone end to end | Playwright `chromium`, `webkit` (existing) | Unchanged; phone-only specs skip on desktop projects |
| Accessibility | Playwright and axe (`a11y.spec.ts`) | All screens at desktop size; the keyboard round |
| Manual | Real laptops | DS 13.4 |
| User testing | MVP playtest (CHI-103) | At least 2 of the playtesters play one round on a laptop |

### DS 13.3 Desktop e2e cases

The Playwright projects are `desktop-chromium` (device "Desktop Chrome") and `desktop-webkit` ("Desktop Safari"). Both devices default to 1280 × 720 (Playwright 1.63 device list); the projects override the viewport to 1440 × 900, and the tests set 1024 × 640 where noted.

| Case | Check |
|---|---|
| Board fits | At 1024 × 640 and 1280 × 720: 24 cards visible, scroll size equals the viewport, the panel's actions visible |
| No sheet | No "Questions" toggle button; `aside[aria-label="Questions"]` present |
| Board stable | Card positions are the same in `playerTurn` and `playerReview` |
| Hover preview | Hover a card for 400 ms and the tooltip is visible; move away and it is gone; never visible while guessing |
| Right-click | Right-click a card opens CardDetail |
| Keyboard round | A full Level 1 round using only the DS 8.1 keys, to the round end |
| Shortcuts ignored | Typing "sna" in the sign-in email field changes nothing in a saved round |
| Resize | Start at 1440 × 900, flip 3 cards, resize to 390 × 844: the same 3 are flipped and the sheet shows; resize back and nothing changed |
| Screens | No horizontal scroll on `/`, `/progress`, `/settings`, `/privacy` at 1024 and 1440 |
| Nav | DesktopNav on every screen but `/play`; `aria-current="page"` on the current link |
| Progress | No tablist at `lg`; both lists visible; the 4 tiles show the right numbers for a seeded log |

### DS 13.4 Manual

| Device | Check |
|---|---|
| MacBook with trackpad: Chrome and Safari at 1280 and 1440 wide | A full round by mouse and a full round by keyboard; the hover preview delay feels right |
| Windows laptop with mouse: Edge and Firefox at 1920 × 1080 | The same, plus right-click detail |
| Any laptop, window dragged across 1024px mid-round | Nothing lost |

### DS 13.5 Definition of done

- [ ] `spec-desktop.md` reviewed and tagged `v1`
- [ ] A full round plays by mouse only and by keyboard only at 1024 × 640 and 1440 × 900
- [ ] At 1024 × 640 the 24 cards and the whole panel fit with no scroll
- [ ] No horizontal scroll on any screen at 1024 and 1440
- [ ] The hover preview and right-click detail work; neither shows on touch
- [ ] Resizing across 1024px mid-round loses nothing
- [ ] The phone layout is unchanged; all existing phone e2e tests pass without edits
- [ ] Desktop Playwright projects green in CI; axe clean at desktop size
- [ ] The manual checks in DS 13.4 are done and logged
- [ ] At least 2 playtesters have played one round on a laptop; findings logged with the rest

### DS 13.6 Milestones

Desktop work runs **before launch**, alongside the MVP's Sprints 2 and 3 (`spec.md` §10.4). The MVP build is ahead of its plan (most Sprint 2 and 3 cards are done), so the desktop cards take those days. They must finish by Day 11 so the Day 12 playtest can include laptop sessions, leaving Days 13 to 15 for fixes from both.

| Day | Date | Deliverable | Done when |
|---|---|---|---|
| 1 | Wed Oct 7 | Request the developer review of this spec; ask playtesters to bring a laptop | Review requested with a return date of Fri Oct 9; at least 2 playtesters confirmed a laptop |
| 3 | Fri Oct 9 | Paper trace, fold in the review, tag `v1` | Spec tagged `v1` |
| 4 | Mon Oct 12 | App shell and breakpoint | DesktopNav shows at `lg`; the phone layout is unchanged |
| 5 | Tue Oct 13 | Game: 6 × 4 board and side panel | 24 cards and the panel fit at 1024 × 640 |
| 6 | Wed Oct 14 | Hover preview and right-click; round end and dialogs | Preview and right-click work; SignInSheet is a modal at `lg` |
| 7 | Thu Oct 15 | Keyboard shortcuts | A full L1 round by keyboard |
| 8 | Fri Oct 16 | Home, Settings, Privacy | Each matches DS 9 at 1024 and 1440 |
| 9 | Mon Oct 19 | Progress dashboard | Tiles and both lists at `lg` |
| 10 | Tue Oct 20 | Desktop e2e projects and specs | Green in CI |
| 11 | Wed Oct 21 | Manual laptop pass; desktop included in the playtest build | DS 13.4 done |
| 12 | Thu Oct 22 | Playtest (CHI-103) with laptop sessions | Desktop findings logged with the rest |
| 13 to 15 | Fri Oct 23 to Tue Oct 27 | Fixes (CHI-105, CHI-106) | Every must-fix finding fixed, desktop included |

## DS 14. Future work and decision log

### DS 14.1 Future work

**Tablet layout (768 to 1023px).** Today tablets get the phone layout, centred. A tablet layout would probably be the 6 × 4 board with the bottom sheet, but it needs real-device testing on iPad and Android tablets in both orientations, so it is out of v1.

**Customisable shortcuts.** Letting learners remap keys needs a settings UI, storage, and conflict checks with browser shortcuts. Out until playtests show the defaults do not work.

**Level 2 typed search.** Typing to filter the ~30 tiles could make L2 keyboard play faster. Out until the playtest says the arrow-key builder is too slow (the DS 8.1 TBD).

**Progress history.** Charts of words learned and mistakes over time. They need history views over `reviewLog` and design work; v1 shows totals only.

**Visual regression tests.** Playwright `toHaveScreenshot` at each breakpoint would catch layout drift, but snapshots differ by OS and font rendering and need a fixed CI image. Out until the layouts settle.

**Resizable side panel.** Dragging the panel's edge. Not needed: `minmax(22rem, 26rem)` already adapts.

### DS 14.2 Decision log

| # | Decision | Reason |
|---|---|---|
| DD1 | Desktop starts at `lg` (1024px), on width only | Room for a 6-column board and a 22rem panel; narrower is better served by the phone layout. It is Tailwind's default breakpoint |
| DD2 | A side panel replaces the bottom sheet on desktop | A laptop has width, not height; the questions sit beside the board, so the board never shrinks |
| DD3 | The panel reuses `sheetFor()` output | One source of truth for what each phase shows; phone and desktop cannot drift |
| DD4 | The board is 6 × 4 on desktop | Fits a landscape area; cards are about 55% bigger than 4 × 6 at 1440 × 900 |
| DD5 | No DesktopNav on Game | A focus screen; all the height goes to the board; the menu already has "Quit round" |
| DD6 | Hover preview and right-click instead of long-press | Long-press is slow with a mouse and nobody finds it |
| DD7 | Single-key shortcuts, `s` and `n` for Sì and No | Fast play with both hands on the keyboard; the keys match the Italian words |
| DD8 | No Level 2 tile letter shortcuts | About 30 tiles cannot map to single keys without modes; Tab and arrows are enough for v1 |
| DD9 | Shortcut logic is a pure `shortcuts.ts` | Testable in Vitest's node environment without a DOM |
| DD10 | Progress stats come only from existing data | No schema, sync or backend change |
| DD11 | Nothing changes below 1024px | The phone experience is built and tested; the desktop work must not risk it |
| DD12 | Desktop work runs before launch, by Day 11 | The user's choice; the MVP build is ahead of plan, and finishing by Day 11 lets the existing playtest cover desktop |
| DD13 | Desktop is tested by the MVP playtesters | No separate recruiting; at least 2 play one round on a laptop |
| DD14 | The board grid uses rows of `gridcell`s (ARIA grid) | Arrow-key movement then follows the WAI-ARIA grid pattern that screen readers expect |

## DS 15. References

- Tailwind CSS, Responsive design (default breakpoints; `lg` is 64rem): https://tailwindcss.com/docs/responsive-design
- Tailwind CSS v4 upgrade guide ("Hover styles on mobile": `hover:` only under `(hover: hover)`): https://tailwindcss.com/docs/upgrade-guide
- MDN, `hover` media feature (and `pointer`): https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover
- MDN, `contextmenu` event (right-click, context menu key, Firefox Shift exception): https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
- W3C, Understanding WCAG 2.2 SC 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- W3C WAI-ARIA Authoring Practices, Grid pattern (keyboard and roving tabindex): https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- Playwright device descriptors, read from the installed `@playwright/test` 1.63.0 (`devices["Desktop Chrome"]`, `devices["Desktop Safari"]`: 1280 × 720): https://playwright.dev/docs/emulation#devices
- `spec.md`, the MVP spec, in this repo

## DS 16. Changelog

- 2026-10-07: v0.1. First draft.
- 2026-10-07: v0.2. Restructured to the full spec format: success criteria, in/out table, desktop round walkthrough, edge cases, data model (`ProgressStats`), shortcuts contract with transition table, check order, invariants and traced example, tests by layer, milestones before launch (DD12), future work, references. Level 1 questions use `q` then arrows instead of number keys. Playwright desktop devices verified at 1280 × 720 and overridden to 1440 × 900.
- 2026-10-07: CHI-120. DS 2.2 resize TBD resolved: a half-built Level 2 question did not survive the swap, so `Game` now holds the TileBuilder draft, and CpuQuestion's `hintShown` for the same reason.
- 2026-10-07: CHI-121. DS 7.4: question rows hover to `bg-stone-200`, since they already rest at `bg-stone-100`.
- 2026-10-07: CHI-123. DS 8.2: the ARIA grid and the roving tabindex (board and tile rows) are `lg` only; the phone keeps its list and tab order (DD11). ShortcutsDialog is `min(90vw, 32rem)`, since the menu item is on the phone too.
- 2026-10-07: CHI-124. DS 9.1: the level picker keeps its "Level" legend (the diagram's "Choose your level" was a sketch). DS 9.4: new row text "Default level" / "The level Play starts at.", "Sign-in" (the account text as its description), "Privacy" / "What is stored, who handles it, and how to delete your account." with the link "Read the privacy note". The Home links on Settings and Privacy are hidden at `lg`.
- 2026-10-07: CHI-125. DS 3: `dueToday` counts due cards (word × direction), not words, so it equals the Due list's "Due today (n)" as the last invariant asks; the first invariant, which assumed words, now bounds it by the reviewed cards. `localDay()` moved to `src/services/localDay.ts` so e2e tests can use it.
