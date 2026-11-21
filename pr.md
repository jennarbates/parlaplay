Closes #32
Closes #33
Closes #37
Part of #35 (PLAY-023: reading `profiles.last_language` is still to come)

> Before this reaches a preview: migration 1 must be applied to staging (PLAY-022). The client changes here send a `language` column that only exists after it.

## What changed

Three cards that build on each other: the database learns about languages, the client keeps each language's data apart, and sign-in and sign-out cover every language at once.

### PLAY-021: migration 1 (`a59c109`)

- `supabase/migrations/20261103000000_languages.sql` is the SQL of spec 6.2, and a test checks the two agree.
- Adds the `languages` table (`it`, `zh`), a `language` column defaulting to `'it'` on `games`, `review_log` and `cards` (part of the `cards` primary key), `profiles.last_language`, and `language_settings`, with each profile's level copied in as its `it` row.
- A `review_log` row may only point at a game of its own language.
- The test harness can stop after a given migration (`freshDb({ through })`) and apply the rest (`migrate`). Each PGlite closes after its test, which keeps memory flat.

### PLAY-020, and part of PLAY-023: per-language data (`9a762f4`)

- Device storage follows spec 3.3: IndexedDB database `parlaplay`, with the language code in every per-language key (`guest:{code}`, `user:{userId}:{code}`, `round:{code}`, `settings:{code}`). The level before sign-in is in `localStorage` `parlaplay.level.{code}`.
- One progress store per language (`progressStore(code)`). Each one stamps its language on every row it records and keeps only its own rows, from storage and from a pull (3.4.1).
- One level per language (`prefsStore(code)`), saved to `language_settings` when signed in. `profiles.level` is no longer read or written.
- Sync sends each row's `language`. A pull returns every language's rows, and each store takes only its own. Each language's cards are rebuilt from its own rows with its own `log_count`. Rows of an unknown language are dropped.

### PLAY-025: one save-guest prompt, and sign-out of every language (`c2c7c63`)

Sign-in and sign-out now go through the shell reducer. Its `uploadGuest`, `deleteGuest` and `signOut` effects do the work, and both prompts read from shell state.

- **One prompt (D15).** It names the languages with guest data in registry order: `Save your Italian and Chinese progress to this account?`, or just one language when only one has data. The buttons are now `Save` and `Don't save`, as in spec 6.3. Escape and the backdrop still count as Save.
- **Don't save** deletes guest data in those languages and their `round:{code}` too (paper trace F4).
- **Sign-out (D16)** clears `user:{userId}:*` and `round:{code}` for every language, plus `outbox:{userId}`. It keeps `settings:*` and `app`. The unsynced warning checks the shared outbox, so a queued row in any language triggers it. Settings sends `SIGN_OUT` and `CONFIRM_SIGN_OUT` to the shell instead of tracking its own dialog state.
- **New `SIGNED_OUT` action.** When the session ends outside Settings (another tab signs out, or the session expires), the shell goes back to guest without clearing anything. Before this, the shell stayed signed in and the next sign-in never asked about guest data.
- The save prompt stays open and busy until the answer is saved to disk, as before. The `saving` state is set together with the answer, so the dialog doesn't flicker.

### CI fix (`0d86a7e`)

The Format step failed on every push because `planning/issues.json` and `planning/state.json` are written by the planning scripts with 1-space indents. Those two files and `planning/spikes` are now in `.prettierignore`. Format ran before the database sync tests and Playwright, so this is the first run where those get to run.

Not in this PR: `serverLast` is still `null` at sign-in until sync reads `profiles.last_language` (rest of PLAY-023).

## Spec

Section: 2, 3.3, 3.4, 4.1, 4.2, 6.1, 6.2, 6.3, D5, D8, D15, D16
- [x] Behavior matches the spec, or the spec is updated in this PR (4.1 and 4.2 add `SIGNED_OUT`, plus a changelog line)

## Definition of Done

- [x] Every acceptance criterion on the issue is checked
- [x] Tests cover the new behavior
- [ ] CI is green (typecheck, lint, Vitest, Playwright)
- [ ] Tested on a phone, if this changes the UI

Tests:

- **Migration** (`scripts/db-languages.test.ts`, on PGlite):
  - Every old Chi è? row becomes `it` and no row is lost.
  - `language_settings` gets one `it` row per profile.
  - The launched Chi è? inserts and cards upsert still work (spec 5.2).
  - RLS refuses a log row whose game has the other language.
- **Per-language data:**
  - The `it` and `zh` stores stay separate (3.4.1).
  - Every key a round writes carries its language (3.4.6).
  - Each language keeps its own level.
  - Each language gets its own cards on pull.
- **PLAY-025:**
  - `account.test.ts` covers the combined and single-language prompts, games uploaded before log rows across languages, Don't save removing guest data and saved rounds, and a session ending mid-prompt.
  - `signOut.test.ts` covers clearing every language, kept `settings:*` and `app`, an unsynced Chinese-only row, and a session ending elsewhere.
  - The reducer and fast-check tests now include `SIGNED_OUT`.
  - The guest-upload e2e specs use the new title and buttons.

Typecheck, lint, Vitest and the build pass locally; Playwright hasn't run yet.

Merging into `play-029-shell-reducer`, not `main`, so `Closes` won't close the issues automatically. Close #32, #33 and #37 by hand after merging.

## Screenshots

<!-- Save prompt with both languages: TODO -->

🤖 Generated with [Claude Code](https://claude.com/claude-code)
