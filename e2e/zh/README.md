# End-to-end tests

Playwright, run against the production build (`vite build` + `vite preview`) in two phone profiles: Chromium as a Pixel 7 and WebKit as an iPhone 15 (spec 10.2).

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

Tests that need a known game pass `?seed=` to `/play`, and import the engine to know the secrets and the true answers.
