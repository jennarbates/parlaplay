# End-to-end tests

Playwright, run against the production build (`vite build` + `vite preview`) in four profiles: two phones, Chromium as a Pixel 7 and WebKit as an iPhone 15 (spec 10.2), and two desktops, `desktop-chromium` and `desktop-webkit` at 1440 × 900 (desktop spec DS 13.3).

Chi è?'s specs are in this folder and Shéi's in `zh/`, each as its own game spec's test plan lists them. Shéi's run only on the phone profiles until it has a desktop layout. The specs for what the two share (the platform spec's 10.2) are here too: `platform.spec.ts`, `settings.spec.ts`, `privacy.spec.ts`, `logo.spec.ts`, and the sign-in and sync specs.

`desktop.spec.ts` runs only on the desktop profiles. The specs written for the phone's bottom sheet, list board and tabs (`phoneOnly` in `playwright.config.ts`) run only on the phones. Everything else runs on all four.

```bash
pnpm test:e2e
```

## Against the local Supabase

Tests that sign in or sync need the local Supabase (`supabase start`, which needs Docker). CI starts it and points the app at it; without it those tests are skipped, and everything else still runs. To run them locally:

```bash
supabase start
eval "$(supabase status -o env)"
VITE_SUPABASE_URL=$API_URL VITE_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY SUPABASE_INBOX_URL=$MAILPIT_URL VITE_OTP_COOLDOWN_S=2 pnpm test:e2e
```

Sign-in codes are read from the local inbox (Mailpit), through `inbox.ts`. `signin.ts` signs in through the real sheet.

## What is covered

The scenarios on CHI-100, and where each one lives:

| Scenario | Test |
|---|---|
| A seeded round to a win | `level1.spec.ts` "a whole round", `round.spec.ts` "after a round with a mistake" |
| A wrong guess loses | `level1.spec.ts` "a wrong guess loses" |
| Quit records abandoned | `round.spec.ts` "Quit round asks to confirm, records abandoned" |
| Sign-in with a code from the local inbox | `sign-in.spec.ts` (needs Supabase) |
| Reload mid-round resumes | `board.spec.ts` "flips survive a reload", `round.spec.ts` "Continue round … after a reload" |
| `/play` loads directly | `smoke.spec.ts`, `privacy.spec.ts` for `/privacy` |

And by file:

| File | Covers |
|---|---|
| `smoke.spec.ts` | The app loads; deep links work |
| `board.spec.ts` | The board fits a 360 × 560 phone, flipping, Unflip all, the top bar, the detail view, reduced motion |
| `level1.spec.ts` | A whole Level 1 round: picker, CPU questions, hints, guessing |
| `level2.spec.ts` | The tile builder and every kind of feedback |
| `round.spec.ts` | Round end, quit and continue, Home |
| `progress.spec.ts` | The Progress screen |
| `a11y.spec.ts` | Italian card names, keyboard-only play, 44 px targets |
| `privacy.spec.ts`, `settings.spec.ts` | Those pages |
| `states.spec.ts` | Playing on after the connection drops |
| `sign-in.spec.ts`, `outbox.spec.ts`, `guest-upload.spec.ts`, `merge.spec.ts`, `sign-out.spec.ts` | Accounts and sync (need Supabase) |
| `desktop.spec.ts` | The desktop layout (below) |

## Platform

The E2E row of the platform spec's 10.2, and where each case lives:

| Case | Test |
|---|---|
| First visit to `/` shows the picker | `platform.spec.ts` "a first visit to / shows the picker, one card per language" |
| Choosing `zh` then reloading `/` opens `/zh` | `platform.spec.ts` "choosing Chinese, then reloading /, opens /zh (D13)" |
| A full round in each language | `level1.spec.ts` "a whole round", `zh/level1.spec.ts` "a whole round" |
| A saved round in each language survives switching | `platform.spec.ts` "a saved round in each language survives switching" |
| Progress switch shows only that language | `platform.spec.ts` "Progress switches language without changing the default", "Progress shows only its own language's words" |
| Sign-in with guest data in both languages shows the combined prompt and uploads both | `platform.spec.ts` "signing in with guest data in both shows one prompt and uploads both" (needs Supabase) |
| Sign-out clears both | `platform.spec.ts` "sign-out clears both languages and both saved rounds" (needs Supabase) |
| `/fr` shows the not-found screen | `platform.spec.ts` "an unknown language shows the not-found screen" |

Shéi's own account specs (`zh/guest-upload.spec.ts`, `zh/merge.spec.ts`, `zh/outbox.spec.ts`, `zh/sign-out.spec.ts`) repeat Chi è?'s with Chinese rounds, so each language's rows are seen to sync.

## Desktop

The desktop spec's DS 13.3 cases, all in `desktop.spec.ts`:

| Case | Test |
|---|---|
| Board fits | "all 24 cards and the whole panel fit at 1024 × 640" and "… at 1280 × 720" |
| No sheet | "an always-open panel instead of the sheet, in desktop wording" |
| Board stable | "card positions are the same in playerTurn and playerReview" |
| Hover preview | "resting on a card shows a larger preview beside it; leaving hides it", "no preview while guessing, or on a phone-sized window" |
| Right-click | "right-click opens the card's detail and does not flip it", "the context menu key on a focused card opens its detail" |
| Keyboard round | "a whole Level 1 round with only the shortcut keys (DS 2.1)" |
| Shortcuts ignored | "typing sna in the sign-in email field changes nothing in a saved round" (needs Supabase), "keys with Ctrl, Cmd or Alt held do nothing" |
| Resize | "resize: 1440 × 900 to 390 × 844 and back keeps the same 3 flips", plus a guess in progress and a half-built Level 2 question |
| Screens | "no horizontal scroll on any screen at 1024 and 1440 wide" |
| Nav | "DesktopNav is on every screen but /play, marking the current one" |
| Progress | "no tabs: four totals and both lists side by side" |

`a11y.spec.ts` runs on the desktop profiles too: Italian card names and 44 px targets on every screen. Its Tab-order round is phone-only, since on desktop the board is one tab stop and the keyboard round above covers it.

Tests that need a known game pass `?seed=` to `/play`, and import the engine to know the secrets and the true answers.
