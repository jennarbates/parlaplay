# Shéi desktop paper trace (PLAY-066)

ZS 13.1 step 1, traced on Mon Oct 12 2026 against `docs/games/zh-desktop.md` v0.1, using only that spec (and `zh.md` where it points there). ZS 2.1 is walked four times: Level 2 and Level 1, each once by keyboard only and once by mouse only. Each step names the section it relied on. Every place where the trace had to guess is a finding. Findings with one clear answer are fixed in spec v0.2; the ones that are the owner's call are left in the spec as `TBD:`.

Three things were checked against the code and content rather than on paper, because the spec states them as facts:

- The ZS 3 `findTiles` table, computed from `lexicon.json` with the 21 builder tiles in `TileBuilder.tsx` order: every row is right. Also `ma` gives 吗 then 猫, so step 3's `ma`, Enter picks 吗 only because 吗's row comes first.
- The ZS 5.2 worked sizes: all four rows are right (77, 93, 131 and 168px).
- The ZS 4 claims about Chi è?'s files: every part named exists under `src/languages/it/ui/game` (`progressStats` under `src/languages/it/ui`), Chi è?'s GameMenu does close on Esc and outside click, and the purity lint does cover `src/languages/*/ui/game/shortcuts.ts`.

The developer review (PLAY-074) and the `v1` tag are still to come; this is the trace half of PLAY-066.

## Trace 1: Level 2 by keyboard only

| # | Step | Spec | Result |
|---|---|---|---|
| 1 | Opens `/zh` at 1440 × 900 | ZS 10.1 | Two columns under DesktopNav. **F10.** ZS 10.1 hides the "Chinese" line at `lg`; the platform spec (8.1) puts the English name under the title on every language Home, and Chi è?'s desktop Home keeps "Italian" |
| 2 | Tab to the level cards, arrow to Level 2, Tab to Play, Enter | ZS 10.1 | OK: the level `fieldset` is the existing radio group |
| 3 | `/zh/play` opens | ZS 2.1 step 2, ZS 6.2 | Panel shows the summary, find field, tray, tiles and the empty log. **F1.** Where focus is when the game opens is not stated. **F11.** The phase before START is `setup`, which has a row in ZS 9.2 but none in ZS 6.2 |
| 4 | `/` | ZS 9.2 `playerTurn` L2 | `focusFind`; focus in the find field |
| 5 | `ta` | ZS 3, ZS 7.2 | List shows 他, 她; 他 selected |
| 6 | Enter | ZS 7.2 | 他 in the tray, field cleared, list closed, focus stays |
| 7 | `you`, Enter; `gou`, Enter; `ma`, Enter | ZS 3, ZS 7.2 | 有, 狗, 吗 added. `ma` lists 吗 then 猫 (checked, above) |
| 8 | Enter on the empty field | ZS 7.2 | Asks 他有狗吗. **F2.** If Enter is still held from step 7, key repeat fires this Enter too, and a held Enter after the first tile would ask a one-word question |
| 9 | Phase `playerReview`; the find field is gone | ZS 6.2 | Panel shows the answer; the log has its first entry. **F1.** The focused field was unmounted by the phase change. ZS 2.2 says where focus goes after a resize, not after this |
| 10 | `b`, arrows, Enter on cards | ZS 9.2, ZS 9.4 | Cards flip. OK |
| 11 | `n` | ZS 9.2 `playerReview` | Next: phase `cpuTurn` |
| 12 | `p`, then `2` | ZS 9.2 `cpuTurn` L2, ZS 9.3 | Pinyin on; `{ type: "answer", index: 1 }`, 不是. OK, and the traced example in ZS 9.3 agrees |
| 13 | `n` | ZS 9.2 `cpuReview` | Next: `playerTurn`, turn 2 |
| 14 | `l` to reread the round | ZS 7.3, ZS 9.2 | At 1440 × 900 focus moves to the newest entry and its English line shows... **F14.** ...and at Level 2 the log now holds the CPU's whole question, which is often the one the learner is about to build. **F3.** At 1024 × 640 the log is only its header button; what `l` does then is not stated, nor which wins when Esc could close the overlay or cancel a guess |
| 15 | `g` | ZS 9.2, ZS 9.4 | Summary "Click the card you think it is."; focus on the roving card |
| 16 | Arrows, Enter on a card | ZS 9.4, ZS 10.4 | GuessConfirm opens, focus on its confirm button |
| 17 | Enter | ZS 10.4 | Guess confirmed; round end with "Play again" focused (ZS 10.2). **F2.** One held Enter in step 16 picks the card, confirms the guess and presses "Play again", so the round ends and a new one starts unseen |
| 18 | `?` at any point | ZS 9.4 | ShortcutsDialog lists "ZS 9.2's keys ... and the find field's keys". **F6.** The board, group, tile-row and log keys of ZS 9.4 are not in that list |
| 19 | With the menu open, a shortcut key | ZS 2.2, ZS 9.1 | "A dialog is open" stops shortcuts. **F4.** Whether the GameMenu popover and the log overlay count as dialogs is not stated |
| 20 | Tab out of the find field with text in it | ZS 7.2 | **F7.** The table has no row for Tab or for clicking away, and "field empty" is not defined for a field holding only spaces |

## Trace 2: Level 2 by mouse only

| # | Step | Spec | Result |
|---|---|---|---|
| 1 | Clicks Level 2, clicks Play | ZS 10.1 | OK |
| 2 | Clicks 他, 有, 狗, 吗 in the tile rows | ZS 7.2 ("Clicking tiles works exactly as today") | Tray reads 他有狗吗. OK |
| 3 | Clicks Ask in the actions | ZS 6.1 (ZD5) | Asked. OK: Clear and Ask are in the pinned actions |
| 4 | Rests the pointer on 狗 in the phase area | ZS 7.4 | After 200ms: "狗 · gǒu · dog" (`playerReview`, English shown). OK |
| 5 | Rests on a card | ZS 8 | Preview after 350ms, centred over the card. OK |
| 6 | Clicks cards to flip, clicks Next | ZS 8, ZS 6.2 | OK |
| 7 | CPU asks; clicks the Pinyin toggle, clicks 不是 | ZS 6.2 | OK |
| 8 | Rests on a word in the log during `cpuTurn` | ZS 7.4, ZS 2.2 | Characters and pinyin, no English. OK |
| 9 | Clicks Next, then Guess, a card, the confirm button | ZS 6.2, ZS 10.4 | Round end. OK |
| 10 | Right-clicks a card | ZS 8 | CardDetail. OK |
| 11 | Clicks the log header at 1024 × 640 | ZS 7.3 | Overlay opens over the phase area; the header button closes it. OK |
| 12 | Opens the shortcuts list without a keyboard | ZS 9.4 | GameMenu item "Keyboard shortcuts". OK |
| 13 | A learner with the macOS Pinyin input method types `tayougouma` in the find field and commits 他有狗吗 | ZS 7.2, ZS 3 | **F13.** `findTiles` matches a tile whose characters *start with* the query, so a committed sentence matches nothing: "No word matches “他有狗吗”." The spec invites IME users but an IME's natural unit is the phrase |

## Trace 3: Level 1 by keyboard only

| # | Step | Spec | Result |
|---|---|---|---|
| 1 | Level 1, Play | ZS 10.1 | OK |
| 2 | `q` | ZS 9.2 | Focus on the first enabled question |
| 3 | ↓, → | ZS 9.4 | Within the 是 column, then to the same row of 有. **F12.** Late in a round a whole column can be asked; where → goes then, and what `q` does with no question left, is not stated |
| 4 | `t` | ZS 9.2 `playerTurn` L1 | Pronoun becomes 她 (focus is on a button, so the guard passes). OK |
| 5 | Enter | ZS 9.4 | Asked; `playerReview`. **F1.** The focused question left with the phase |
| 6 | `b`, flips, `n` | ZS 9.2 | OK |
| 7 | `h`, then `1` | ZS 9.2 `cpuTurn` L1 | Hint shown through CpuQuestion's own button; answer index 0. OK |
| 8 | `3` | ZS 2.2, ZS 9.2 ⁴ | Nothing: 3 is above the two answers shown. OK |
| 9 | `p`, `/`, `a`, Backspace | ZS 9.2 | Nothing at Level 1. OK |
| 10 | After a rejected question at 1024 × 640 | ZS 6.3 | **F8.** The 376px estimate for the groups leaves 2px before the 378px rule. FeedbackText above the groups ("Try again." with its explanation) is not in the estimate, so the one moment the learner most needs the whole area is the one that scrolls |
| 11 | Reads the three columns at 1024 × 640 | ZS 7.1, ZS 5.2 | **F15.** The panel is 448px, so each column is about 133px. ZS 6.3 budgets height only; nothing checks that the longest question with ruby pinyin, `他在饭店吗？`, fits a column |

## Trace 4: Level 1 by mouse only

| # | Step | Spec | Result |
|---|---|---|---|
| 1 | Clicks 她 in "Ask with", clicks a question | ZS 7.1 | Asked. OK |
| 2 | Rests on a truncated hint | ZS 7.1 | Tooltip shows the full hint. OK |
| 3 | Clicks cards, Next, "Show hint", an answer, Next | ZS 6.2 | OK |
| 4 | Guess, a card, confirm | ZS 6.2, ZS 10.4 | OK |
| 5 | Round end; rests on a word in the log | ZS 10.2, ZS 7.4 | Gloss with English, always shown on round end. OK |
| 6 | Sync fails mid-round | ZS 11 | SyncBanner under TopBar. **F8.** Its height comes out of the same 422px |

## Not in ZS 2.1, found while tracing

| # | Where | Result |
|---|---|---|
| 1 | ZS 9.1 | **F5.** "`KeyLike` is DS 4.1's", but the header says this spec restates every part of DS it uses |
| 2 | ZS 12, CI | **F9.** "`e2e/zh/desktop.spec.ts` runs ... without waiting for PLAY-038" is out of date: PLAY-038 is written (pull request 111) and runs `e2e/zh` on the phone projects only |

## Findings and fixes

| Id | Finding | In v0.2 |
|---|---|---|
| F1 | Focus is unspecified when the game opens and when a phase change removes the focused control | Fixed, ZS 2.2 and ZS 9.4: the game opens with focus on the page; a control removed by a phase change hands focus to the board's roving card, the same rule as a resize |
| F2 | A held key repeats. Held Enter can ask a half-built question, and can pick a card, confirm the guess and press "Play again" in one press | Fixed, ZS 2.2, ZS 7.2, ZS 9.1, ZS 10.2, ZS 10.4: a held key acts once, except arrows and Backspace. **Chi è? has this today:** confirmed on the production build, where holding Enter on a card while guessing ends the round and starts the next |
| F3 | `l` with the log collapsed to its header, and Esc with the overlay open | Fixed, ZS 7.3 and ZS 9.2: `l` opens the overlay; Esc closes it and does nothing else |
| F4 | What counts as "a dialog is open" | Fixed, ZS 9.1: any open `<dialog>`, the GameMenu popover and the log overlay |
| F5 | `KeyLike` not restated | Fixed, ZS 9.1 |
| F6 | ShortcutsDialog leaves out the ZS 9.4 keys | Fixed, ZS 9.4 |
| F7 | Tab, clicking away and a spaces-only query in the find field | Fixed, ZS 7.2 |
| F8 | The height budget leaves out FeedbackText and the SyncBanner | Fixed, ZS 6.3: both are named in what the layout card must measure, and the banner is allowed to make the phase area scroll |
| F9 | The CI note predates PLAY-038 | Fixed, ZS 12 and ZD12 |
| F10 | "Chinese" hidden on Home at `lg` | Fixed, ZS 10.1: it stays, as platform spec 8.1 and Chi è? |
| F11 | `setup` has no row in ZS 6.2 | Fixed, ZS 6.2 |
| F12 | Arrow keys in the Level 1 groups when a column is all asked | Fixed, ZS 9.4 and ZS 9.2 |
| F13 | An IME commits a phrase, and a phrase matches no tile | `TBD:` in ZS 7.2, for the owner. Accept the message and watch it in the ZS 13.4 pass, or let a committed string that is a run of tiles add them all |
| F14 | At Level 2 the log shows whole correct questions, including the one the CPU just asked, while the learner is rated on building it | `TBD:` in ZS 7.3, for the owner. ZS 1 says no rating changes and argues it for type-to-find and glosses, not for the log |
| F15 | No check that a Level 1 question fits a 133px column | Fixed, ZS 6.3: added to what the layout card measures |
