# Platform paper trace (PLAY-005)

Spec 10.1 step 1, traced on Wed Oct 7 2026 against `docs/spec.md` v0.2 using only that spec and the two game specs. Each step names the section it relied on. Every place where the trace had to guess is a finding, and every finding is fixed in spec v0.3 (see its changelog).

## Journey 1: a new guest plays Chinese, then Italian, signs in, plays on a second device, signs out

| # | Step | Spec | Result |
|---|---|---|---|
| 1 | First visit to `https://parlaplay.games/` on a phone | 4.3 rule 2 | Redirect to `/languages` |
| 2 | The same, for a returning visitor whose `app` key says `zh` | 4.3 rule 1, 3.3 | **F1.** The `app` key is read from IndexedDB asynchronously. Until it loads, `lastLanguage` is null, so rule 2 fires and a returning player lands on the picker |
| 3 | Picker shows Italian and Chinese, with `Continue round` for a language with a saved round | 8.1 | **F2.** Validating a saved round needs `isResumable`, which lives in the language module, and the picker must not load modules (9, Performance). The picker cannot tell a stale round from a good one |
| 4 | Taps Chinese: CHOOSE `zh`, `write app`, navigate `/zh` | 4.2 | OK |
| 5 | Plays a round; START dispatches CHOOSE `zh` | 4.3 rule 4 | OK |
| 6 | `Change language`, taps Italian, starts a round, leaves it half done | 4.2, 3.3 | OK: `round:it` saved, `guest:it` has a games row |
| 7 | Opens `/settings`, signs in with a code | 6.3 | SIGNED_IN with `guestLanguages` `["it", "zh"]` | 
| 8 | Prompt `Save your Italian and Chinese progress to this account?` | 2 | **F3.** The order of the language names is not stated. Registry order gives "Italian and Chinese"; play order would give "Chinese and Italian" |
| 9 | Taps `Don't save` | 6.3 | **F4.** Guest rows are deleted, but `round:it` still points at a `gameId` whose games row is gone. Its next review rows would point at a game that never reaches the server, and the RLS insert check refuses them |
| 10 | Same, but taps `Save` | 6.3 | OK: games rows of both languages, then review rows |
| 11 | Level: as a guest they picked Level 2 in Chinese; the account has no `language_settings` rows | 6.3 | **F5.** Spec says "no row means level 1", so their Level 2 silently turns into 1 after sign-in |
| 12 | Second device: opens `/`, picker, signs in | 2 step 4 | OK: `serverLast` fills the device's last language for next time |
| 13 | Pull splits rows by language; `/zh/progress` shows only Chinese | 6.3, 3.4.1 | OK |
| 14 | Plays offline; signs out with queued rows | 6.3, 4.2 | U prompt, then sign-out |
| 15 | After sign-out, opens `/it` | 6.3 | **F6.** Sign-out clears `user:{id}:*` and the outbox, but `round:{code}` is device-level, not per user. The next person on the device would see the signed-out user's `Continue round` (Chi è? clears its `round` key on sign-out) |

## Journey 2: an October Chi è? guest arrives through the handoff

| # | Step | Spec | Result |
|---|---|---|---|
| 1 | Opens `https://chie.parlaplay.games/play` after launch | 5.3 | Handoff page reads `chi-e`: `guest`, `round`, `outbox:*` |
| 2 | Navigates to `/import#data=…&next=/it/play` | 5.3 | **F7.** `/import` follows `next` as given. A crafted link could send a visitor anywhere after saving data into their storage: an open redirect |
| 3 | `/import` validates rows, adds `language: "it"`, merges into `guest:it` | 5.3 | OK |
| 4 | A saved round arrives and `parlaplay.games` already has `round:it` | 5.3 | **F8.** "The one that started later wins", but a saved round has no start time; only its games row does |
| 5 | Navigates to `/it/play` | 5.3 | **F9.** The import never sets the last language, so `/` still opens the picker (or another language) next time, although this player only ever played Italian |
| 6 | Signs in; prompt for Italian; outbox rows flush for the same user | 5.3, 6.3 | OK |
| 7 | Opens the old link again: handoff runs twice | 5.3 | OK: union by id, nothing duplicated |

## Findings and fixes

| Id | Finding | Fix in v0.3 |
|---|---|---|
| F1 | `/` routes before the last language has loaded | 4.1 adds `hydrated`; 4.3 rule 0 waits for it, showing the skeleton |
| F2 | Picker cannot validate saved rounds | The build writes each language's `contentVersion` into the registry (3.1); the picker shows `Continue round` only when the saved round's `contentVersion` matches. Full validation still runs on entering the language |
| F3 | Order of languages in the prompt | Registry order (2, 6.3) |
| F4 | `Don't save` leaves orphan saved rounds | `Don't save` also removes `round:{code}` for those languages (6.3) |
| F5 | Guest level lost at sign-in | For each language with no `language_settings` row, the device level is upserted; an existing row wins (6.3) |
| F6 | Saved rounds survive sign-out | Sign-out also removes every `round:{code}` (6.3) |
| F7 | Open redirect through `next` | `next` must be one of `/it`, `/it/play`, `/it/progress`; anything else becomes `/it` (5.3) |
| F8 | No start time on a saved round | Compare the `startedAt` of the two rounds' games rows; keep the existing round if either is missing (5.3) |
| F9 | Import leaves the last language unset | A successful import dispatches CHOOSE `it` (5.3) |

Open after the trace: the largest fragment Safari on iOS accepts (PLAY-006).
