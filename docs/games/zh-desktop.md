# 谁？ (Shéi?): Desktop Spec

| | |
|---|---|
| Status | v0.1 draft (2026-10-08). Becomes `v1` after the sign-off in ZS 9 |
| Product name | **谁？** (*Shéi?*). The branding rules of `zh.md` apply |
| Audience for this doc | Whoever builds, reviews, or tests Shéi's desktop layout |
| Builds on | `it-desktop.md` (Chi è?'s desktop spec, "DS"), and `zh.md` (Shéi's MVP spec). Anything this doc does not mention works exactly as DS says, with Shéi's screens in place of Chi è?'s |

Conventions: as DS. Sections here are `ZS n` and decisions `ZD n`, so they never clash with DS or `zh.md`. Backlog cards are PLAY-057 to PLAY-063, epic **Shéi desktop**.

---

## ZS 1. Scope

**Goal.** Shéi gets the desktop layout `zh.md` promised (D24, success criterion 1): the board large and central, the questions beside it, playable by mouse or entirely by keyboard. The phone stays exactly as it is.

**The problem today.** Shéi came into this repo before Chi è?'s desktop work, so none of it reached `src/languages/zh`. Every `/zh` route sets its width to `lg:max-w-md` (`src/languages/zh/index.ts`), so at `lg` a learner sees DesktopNav over a phone-sized strip.

**What Shéi already has.** These are shared through `src/core` and need no work: the breakpoint and `useIsDesktop()` (DS 5), `Layout` and DesktopNav, SignInSheet as a centred modal, Settings and Privacy at their desktop widths, SyncBanner placement, and right-click opening CardDetail (`useLongPress`, DS 7.3).

**Success criteria.** DS 1's five criteria, for `/zh`, `/zh/play`, round end and `/zh/progress`, at both levels.

| In | Out |
|---|---|
| Everything in DS 1's left column, for Shéi | Everything in DS 1's right column |
| Moving Chi è?'s language-neutral desktop parts into `src/core` (ZS 2) | Changing any Chi è? behaviour |
| Shéi's own key table (ZS 5) | Typed pinyin search for Level 2 tiles (as DS DD8) |

No Chinese string changes, so no Mandarin review is needed.

## ZS 2. Shared code

**Decision: the language-neutral desktop parts move from `src/languages/it/ui/game` to `src/core/ui`, and both games use them (ZD1).** The reason: one fix then reaches both games, and the two copies cannot drift. Each part takes whatever differs by language as an argument.

| Part | Moves to | Takes as argument |
|---|---|---|
| `useHoverPreview` | `src/core/ui/useHoverPreview.ts` | nothing new |
| `previewSpot`, `boardVars` | `src/core/ui/boardLayout.ts` | `previewSpot`: the caption's height (Chi è? 32px, Shéi ZS 4.3). `boardVars`: the shape and the caption height (Chi è? 0) |
| `Kbd` | `src/core/ui/Kbd.tsx` | nothing new |
| `SidePanel` | `src/core/ui/SidePanel.tsx` | nothing new |
| `ShortcutsDialog` | `src/core/ui/ShortcutsDialog.tsx` | the rows of keys to list |
| DS 4.3 steps 1 to 3 | `src/core/ui/shortcutGuard.ts` | nothing; returns whether a key may be a shortcut at all |
| `progressStats` | `src/core/ui/progressStats.ts` | the language's `cardIds` |

**Stays per language:** `shortcuts.ts` (the key table, ZS 5), `CardPreview` (the face and caption differ), and every screen. The purity lint over `src/languages/*/ui/game/shortcuts.ts` already covers Shéi's file; `shortcutGuard.ts` is added to it.

**Rule:** the move changes no behaviour. Chi è?'s unit and e2e tests pass without edits, and `pnpm check:bundle` passes for `/it` and `/zh`.

## ZS 3. Behaviour on desktop

### ZS 3.1 A desktop round, step by step

As DS 2.1, with Shéi's keys:

1. The learner opens `/zh` at 1280 × 800. Home shows two columns (ZS 6.1).
2. They choose Level 1 and click **Play**. `/zh/play` opens: TopBar, the 6 × 4 board, the side panel with the 他 / 她 switch and the 14 questions.
3. They press `t`: the switch moves to 她. They press `q`, ↓ twice, Enter: the question is asked. The panel shows the answer (`playerReview`).
4. They press `b`, flip down the ruled-out cards with the arrows and Enter, and press `n` (Next).
5. The CPU asks (`cpuTurn`). The panel shows the question with the two answer buttons, numbered 1 and 2. They press `1`. The panel shows ✓ or ✗ (`cpuReview`). They press `n`.
6. On a later turn they press `g`, move to a card, press Enter, and Enter again to confirm.
7. Round end shows in two columns; "Play again" has focus.

At Level 2 step 3 becomes: `q` focuses the first tile, the arrows and Enter build the question in the tray, `p` shows pinyin, `a` asks. Step 5 offers seven answers, numbered 1 to 7.

### ZS 3.2 Edge cases

DS 2.2 applies, plus:

| Situation | Rule |
|---|---|
| Window resized across 1024px mid-round at Level 2 | The tray keeps its tiles: `Game` holds the tray, as DS 2.2 has it hold Chi è?'s TileBuilder draft. `CpuQuestion`'s `hintShown` moves to `Game` for the same reason |
| `1` to `7` pressed outside `cpuTurn` | Nothing happens |
| A number higher than the answers shown (`3` at Level 1) | Nothing happens |
| `a` with an empty tray | Nothing happens; the engine is never sent an empty question |
| `t` at Level 2, `p` at Level 1 | Nothing happens. Level 1 always shows pinyin (`zh.md` D14) and Level 2 has no pronoun switch (the pronoun is a tile) |
| Level 2 with a feedback line above the builder at 1024 × 640 | The panel body scrolls, so Clear and Ask can leave view. Accepted: `a` asks from anywhere, and taller windows fit it all. PLAY-059 measures the height it needs |

## ZS 4. Game screen

As DS 6, with these differences.

### ZS 4.1 Grid

- **Side panel `minmax(24rem, 28rem)`, not `minmax(22rem, 26rem)` (ZD2).** The reason, measured on the production build (Chromium, 2026-10-08): Level 2's first tile row is 7 tiles of at least 44px with 2px gaps, which needs about 320px. In a 22rem panel (311px inside its `px-5`) that row overflows; at 24rem (343px) it fits with or without pinyin. Pinyin widens tiles to about 70px but never adds a line.
- The wider panel costs the board nothing: at 1024 × 640 and 1440 × 900 the board's height, not its width, sets the card size (ZS 4.2).

### ZS 4.2 Board

- **Already 6 × 4 on the phone**, so DS DD4's change of shape does not apply. `boardShape()` is 6 × 4 at every size for Shéi; only the gap and padding change at `lg`, as DS 6.1.
- **The caption scales up at `lg`.** Each card has its name and pinyin under the face (`zh.md` 3.5), in a fixed-height strip, `--card-cap`:

  | | `--card-cap` | Name | Pinyin | `--gap` | Board padding |
  |---|---|---|---|---|---|
  | Phone | 1.75rem | 12px | 9px | 0.25rem | `px-2 py-1` |
  | `lg` | 2.25rem | 16px | 12px | 0.5rem | `p-6` |

- The card width formula is DS 6.1's with the captions taken out of the height:

  ```css
  --card-w: min(
    calc((100cqw - (var(--cols) - 1) * var(--gap)) / var(--cols)),
    calc((100cqh - (var(--rows) - 1) * var(--gap) - var(--rows) * var(--card-cap)) / var(--rows) * 5 / 6)
  );
  ```

  On the phone this equals today's formula. The skeleton board uses the same variables.

**Size floor.** At 1024 × 640 the panel is 28rem (448px). Width allows (1024 − 448 − 48 − 5 × 8) / 6 ≈ 81px; height allows (640 − 56 − 48 − 3 × 8 − 4 × 36) / 4 × 5 / 6 ≈ 77px, so cards are about 77px wide. The longest name's pinyin, "Zhāng Jìng", is about 66px at 12px, so no caption is clipped. At 1440 × 900 cards are about 131px wide.

### ZS 4.3 Side panel

As DS 6.2, with Shéi's phases (the content is what `sheetFor()` in `src/languages/zh/ui/Game.tsx` builds today):

| Phase | Actions | Key labels at `lg` |
|---|---|---|
| `playerTurn` | Guess | "Guess G" |
| `playerTurn`, guessing | Cancel guess | "Cancel guess Esc" |
| `playerReview`, `cpuReview` | Next | "Next N" |
| `cpuTurn` | none; the answer buttons are in the body | each answer button shows its number, 1 to 2 or 1 to 7 |

In the body at `lg`: the 他 / 她 switch shows `T` after "Ask with"; the Pinyin checkbox shows `P`; the Ask button reads "Ask A". Every one is a `Kbd`, `aria-hidden`, with `aria-keyshortcuts` on the control.

**Desktop wording.** Chosen with `useIsDesktop()`, as DS 6.2. No Chinese string changes.

| Phone (unchanged) | Desktop |
|---|---|
| "Tap the card you think it is." | "Click the card you think it is." |
| "Flip down everyone this rules out, then tap Next." | "Flip down everyone this rules out, then click Next." |
| "Tap words below" | "Click words below" |
| Home, Level 1: "Tap ready-made questions, with English hints" | "Click ready-made questions, with English hints" |

### ZS 4.4 Hover preview

As DS 7.2, showing the face at 2× the card's width (capped at 16rem) with the name at 20px and its pinyin at 14px under it. `previewSpot()` gets the two-line caption's height, 44px. The tooltip's text is the name with `lang="zh-Hans"`; the pinyin has `lang="zh-Latn-pinyin"`.

Hover styles: DS 7.4's table, for Shéi's cards, buttons, question rows and tiles.

## ZS 5. Keyboard

**Decision: Shéi's keys are `zh.md` 8.3's, with `a` for Ask in place of "Enter in the tray" (ZD3).** The reason: in the builder, Enter on a focused tile already adds it (or, in the tray, removes it), so Enter cannot also mean Ask. `a` is free in Shéi, because Next is `n`.

### ZS 5.1 Types

```ts
// src/languages/zh/ui/game/shortcuts.ts
export type ShortcutAction =
  | { type: "focusQuestions" }           // q: first enabled question (L1) or first tile (L2)
  | { type: "focusBoard" }               // b
  | { type: "startGuess" }               // g
  | { type: "cancelGuess" }              // Escape
  | { type: "answer"; index: number }    // 1 to 7, 0-based index into the answer buttons
  | { type: "showHint" }                 // h
  | { type: "next" }                     // n
  | { type: "ask" }                      // a
  | { type: "removeLast" }               // Backspace
  | { type: "togglePinyin" }             // p
  | { type: "switchPronoun" }            // t
  | { type: "openHelp" };                // ?
```

`KeyLike` and `ShortcutContext` are DS 4.1's, with two more context fields: `answers: number` (the answer buttons shown, 0 outside `cpuTurn`) and `trayEmpty: boolean`. `Game` maps `answer` to the id at that index of the same list `CpuQuestion` renders; that list moves into one exported function, `answerIds(questionKey, level)`, so the two cannot disagree.

### ZS 5.2 Transition table

`-` means `null`. Order of checks: DS 4.3 (from `shortcutGuard`), then the table.

| Context | `q` | `b` | `g` | `Esc` | `1`–`7` | `h` | `n` | `a` | `Backspace` | `p` | `t` | `?` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `setup` | - | focusBoard | - | - | - | - | - | - | - | - | - | openHelp |
| `playerTurn` L1, not guessing | focusQuestions | focusBoard | startGuess | - | - | - | - | - | - | - | switchPronoun | openHelp |
| `playerTurn` L2, not guessing | focusQuestions | focusBoard | startGuess | - | - | - | - | ask ¹ | removeLast ¹ | togglePinyin | - | openHelp |
| `playerTurn`, guessing | - | focusBoard | - | cancelGuess | - | - | - | - | - | togglePinyin ² | - | openHelp |
| `playerReview` | - | focusBoard | - | - | - | - | next | - | - | togglePinyin ² | - | openHelp |
| `cpuTurn` L1 | - | focusBoard | - | - | answer ³ | showHint | - | - | - | - | - | openHelp |
| `cpuTurn` L2 | - | focusBoard | - | - | answer ³ | - | - | - | - | togglePinyin | - | openHelp |
| `cpuReview` | - | focusBoard | - | - | - | - | next | - | - | togglePinyin ² | - | openHelp |
| `over` | - | - | - | - | - | - | - | - | - | - | - | - |

¹ `null` when the tray is empty. ² Level 2 only. ³ `{ index: key − 1 }` when `key ≤ answers`, else `null`.

`Backspace` passes `shortcutGuard` only when the target is not a text field (DS 4.3 step 2), so it never eats a deletion in the sign-in fields.

### ZS 5.3 Invariants

Each is a unit test in `src/languages/zh/ui/game/shortcuts.test.ts`, as DS 4.4, plus:

- `answer` is only returned in `cpuTurn`, and its index is always below `answers`.
- `ask` and `removeLast` are only returned at Level 2 in `playerTurn`, not guessing, with a non-empty tray.
- `togglePinyin` is never returned at Level 1; `switchPronoun` never at Level 2.

### ZS 5.4 Focus

As DS 8.1 and 8.2: the board is an ARIA grid at `lg` only (4 rows of 6), with roving tabindex, arrows, Home, End, Ctrl+Home, Ctrl+End, Enter, Space, `i` and the context menu key. Below `lg` it stays the list it is.

- **Level 1:** ↑ ↓ move between the 14 questions, skipping asked ones; Enter asks.
- **Level 2:** each tile row (the tray, then the four rows) is one tab stop with ← → inside it (roving tabindex per row, `lg` only). Enter adds a tile, or removes it in the tray.
- `ShortcutsDialog` lists ZS 5.2's keys. GameMenu gets DS 8.3's fix (closes on Esc and on a click outside, focus back to the menu button), which Chi è?'s GameMenu has and Shéi's does not.

## ZS 6. Other screens

### ZS 6.1 Home

As DS 9.1. Left: `谁？` in `text-6xl font-bold` with `lang="zh-Hans"`, "Shéi?" under it in `text-2xl text-stone-600` with `lang="zh-Latn-pinyin"`, then the pitch line "Ask questions in Chinese to find the secret character.", then the round-in-progress card. Right: the level picker as two cards side by side and the Play button. The phone's sign-in line and links are hidden at `lg`.

### ZS 6.2 Round end, Progress, dialogs

- **Round end:** as DS 9.2.
- **Progress:** as DS 9.3. The four stat tiles come from the shared `progressStats` with Shéi's `cardIds` (one card per noun per direction, so DS 3's invariants hold unchanged). Mistakes shows grouped by noun or grammar point, as on the phone, beside Due.
- **Dialogs:** CardDetail and GuessConfirm at DS 9.6's desktop sizes; GuessConfirm's focus starts on its confirm button.
- **Route widths:** `src/languages/zh/index.ts` uses DS 5's table, the same as `src/languages/it/index.ts`.

## ZS 7. Data and backend

No change, as DS 10.

## ZS 8. Non-functional

As DS 12, plus:

- **Fonts.** System Chinese fonts only (`zh.md` 9). The manual pass (ZS 9) checks the 16px card names in Microsoft YaHei on Windows and PingFang SC on macOS.
- **Bundle.** `/zh` grows by under 10 kB gzipped; `/it` does not grow from ZS 2's move by more than 1 kB.
- **Accessibility.** axe clean on every `/zh` screen at 1440 × 900. Card and preview names keep `lang="zh-Hans"`.

## ZS 9. Tests and definition of done

**Sign-off.** Paper-trace ZS 3.1 at both levels using only DS and this spec; log every guess as a fix or a `TBD:`; tag `v1`.

| Layer | Covers |
|---|---|
| Vitest | Every cell of ZS 5.2, the invariants of ZS 5.3; `previewSpot` and `boardVars` with a caption; the moved parts' existing tests |
| Playwright `e2e/zh/desktop.spec.ts` (`desktop-chromium`, `desktop-webkit`) | DS 13.3's cases for `/zh`, plus: the Level 2 builder's first row on one line at 1024 × 640; a full round at each level by keyboard only; `3` at Level 1 does nothing |
| axe | Every `/zh` screen at 1440 × 900 |
| Manual | DS 13.4 for Shéi, both levels |

`e2e/zh/**` is skipped today until PLAY-038 (`playwright.config.ts`). `e2e/zh/desktop.spec.ts` is written for `/zh` from the start, so the desktop projects run it now and do not wait for PLAY-038.

**Definition of done.** DS 13.5's list, for `/zh` at both levels, and:

- [ ] `zh-desktop.md` tagged `v1`
- [ ] The shared parts live in `src/core/ui`, and Chi è?'s tests pass without edits
- [ ] At 1024 × 640 the Level 2 builder's first row is one line and the panel's actions are in view

## ZS 10. Decision log

| # | Decision | Reason |
|---|---|---|
| ZD1 | Chi è?'s language-neutral desktop parts move into `src/core/ui` | One fix reaches both games and the copies cannot drift; the cost is a refactor touching Chi è?, guarded by its unchanged tests |
| ZD2 | Shéi's side panel is `minmax(24rem, 28rem)` | Measured: the 7-tile first row overflows a 22rem panel and fits at 24rem; the board is height-bound, so the wider panel costs no card size |
| ZD3 | `a` asks at Level 2, instead of `zh.md` 8.3's "Enter in the tray" | Enter on a focused tile already adds or removes it |
| ZD4 | `Backspace` removes the last tray tile | The keyboard equivalent of tapping the tray's last tile; cheap, and guarded against text fields |
| ZD5 | `p` works in every Level 2 phase, not only while building | Pinyin also shows on the CPU's question and the answers, where a learner most needs it |
| ZD6 | The caption grows to 16px and 12px at `lg` | The phone's 12px and 9px are hard to read at laptop distance; the longest pinyin still fits at 1024 × 640 |
| ZD7 | `e2e/zh/desktop.spec.ts` runs now, not after PLAY-038 | Written for `/zh`, it does not need the old specs repointed |

## ZS 11. Changelog

- 2026-10-08: v0.1. First draft (PLAY-057), with the Level 2 builder measured at 22, 24 and 26rem.
