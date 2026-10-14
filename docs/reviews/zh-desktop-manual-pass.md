# Shéi desktop: manual laptop pass (PLAY-072)

The checks of `zh-desktop.md` ZS 13.4, as a sheet to fill in, plus the things the build could not check for itself. Written on Tue Oct 13 2026, when the desktop version was built and tested only in Playwright's Chromium and WebKit: no real mouse, no real keyboard, no input method, and no real Safari, Firefox or Edge.

How to fill it in: put `ok` or what went wrong in the Result column. Anything that is not `ok` becomes a finding for PLAY-073.

## First, three things only a person can see

These are the ones I would look at before anything else, because automated tests cannot settle them.

| # | Check | Why it is here | Result |
|---|---|---|---|
| A | In **real Safari** (Mac, and an iPhone), start a round in each game. The cards show faces, and a flipped card shows its ×, not the other way round | In Playwright's headless WebKit every card renders face-down from the start, in both games, phone and desktop. A minimal textbook flip card does the same there, so it is very likely a headless artifact, but real Safari was not available to confirm | |
| B | Level 2, find field, with the **macOS Pinyin** input method on: type `ta`, pick 他, Enter. Then type `tayougouma`, pick 他有狗吗 | The input-method handling is written from MDN and tested only by pasting committed text. Expected: picking 他 adds one tile; Enter while the candidate window is open chooses a candidate and does not add or ask; the four-word phrase adds four tiles (ZD16) | |
| C | Hold **Enter** on a card while guessing, for a full second, with a real keyboard, in each game | Expected: the confirm opens and nothing more. Before the fix, one long press confirmed the guess and started the next round. The fix is tested with synthetic repeats only | |

## ZS 13.4

| Device | Check | Result |
|---|---|---|
| MacBook, trackpad, Chrome at 1280 wide | A round at Level 1 by mouse only | |
| | A round at Level 1 by keyboard only (`q`, arrows, `t`, Enter, `b`, `n`, `1`/`2`, `h`, `g`) | |
| | A round at Level 2 by mouse only (tiles, Clear, Ask) | |
| | A round at Level 2 by keyboard only (`/`, pinyin, Enter, `a`, `p`, `1` to `7`) | |
| MacBook, Chrome at 1440 wide | The same four | |
| MacBook, Safari at 1280 and 1440 wide | The same four, and check A above | |
| MacBook, Safari or Chrome | Type-to-find with the macOS Pinyin input method (check B), and without it | |
| Windows laptop, mouse, Edge at 1920 × 1080 | The same four rounds | |
| Windows laptop, Firefox at 1920 × 1080 | The same four rounds | |
| Windows laptop | Type-to-find with Microsoft Pinyin | |
| Windows laptop | Right-click a card: the detail view opens, not the browser's menu | |
| Windows laptop | Card names at 16px and gloss characters at 24px are easy to read in Microsoft YaHei | |
| Any laptop | Drag the window across 1024px mid-round, both ways: flips, the tray, a shown hint and a guess in progress are all kept | |

## Things to look at while playing

| # | Check | Result |
|---|---|---|
| 1 | At 1024 × 640 nothing scrolls except the round log when opened, and feedback for two or more mistakes at Level 2 (ZD18) | |
| 2 | Level 1's three columns read well; no question is cut off; resting on a hint shows it whole | |
| 3 | Resting on a card shows its preview after about a third of a second, over the card, and never while guessing | |
| 4 | Resting on a word in the round log shows its gloss; during the computer's question the gloss has no English | |
| 5 | At Level 2 the round log is closed while you build a question, and `l` or its header opens it (ZD17). Does it feel right, or does it get in the way? | |
| 6 | The detail view has no text on desktop (ZD19). Is anything missed? | |
| 7 | **Backspace** in Safari and Firefox, with nothing focused, during your Level 1 turn: the page stays put | |
| 8 | `/` in Firefox goes to the find field, not Firefox's quick find | |
| 9 | Level 1's green and red answer buttons are a shade darker than before (for contrast). Still clearly yes and no? | |
| 10 | The number in the corner of each answer button is readable and not in the way | |

## The same for Chi è?

Two fixes reached Chi è? this week, and neither has been tried by hand.

| # | Check | Result |
|---|---|---|
| I | Check C above, in Chi è? | |
| II | The hover preview sits over its card, not beside it | |
| III | "Sì" is a darker green; feedback after a Level 2 mistake looks as it did | |

## Findings

| # | What happened | Where | Must fix before launch? |
|---|---|---|---|
| | | | |
