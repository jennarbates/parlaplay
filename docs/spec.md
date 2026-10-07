# parlaplay: Platform Spec

| | |
|---|---|
| Status | v0.2 draft, 2026-10-07. Becomes `v1` after the sign-off in section 10.1 |
| Product name | **parlaplay**, written in lowercase everywhere, at `parlaplay.games`. The games keep their own names: **Chi è?** (Italian) and **谁？** (*Shéi?*, Chinese). Never use "Guess Who" or any Hasbro title in public branding, as in both game specs |
| Scope of this document | The shared platform: one site, one login, language choice, and data kept apart by language. Each game's rules, content, engine and game screens stay in its own spec: `docs/games/it.md` (today `jennarbates/Italian` `spec.md`) and `docs/games/zh.md` (today `jennarbates/Chinese` `spec.md`) |
| Audience | Whoever builds, reviews or tests the merged site |

Conventions: each section leads with the decision, then the reason. `TBD:` marks an open question. Strings in `code` are the exact strings the app must show. "Game spec" means the spec of the language in question. A rule in this document overrides a game spec only where it says so.

---

## 1. Scope and non-goals

**Goal.** One website where a learner signs in once, picks the language they want to practise, and plays that language's game, with progress in each language kept apart.

**Target user.** An adult learner of Italian (A1 to A2) or Mandarin (new HSK 1), possibly both, on a phone (portrait) or a laptop (1024 px wide or more), in 5 to 15 minute sessions. UI chrome is in English.

**Success criteria for the MVP.**

1. `parlaplay.games` serves both games: `/it` plays a full round of Chi è? and `/zh` a full round of 谁？, on an iPhone (Safari), an Android phone (Chrome) and a laptop at 1024 × 640.
2. One account signs in once and plays both languages without signing in again.
3. A test proves that no screen, sync or Progress view of one language shows a row of the other (section 3, invariant 1).
4. Every Chi è? player from before the merge keeps their progress: signed-in players by signing in on `parlaplay.games`, guests through the handoff from `chie.parlaplay.games` (section 5.3).
5. Each game's own definition of done still passes inside the merged site.

**In and out of the MVP.**

| In MVP | Out of MVP (future, section 11) |
|---|---|
| Two languages: Italian (`it`) and Chinese (`zh`) | A third language |
| One account across languages, email code sign-in | Google sign-in, in-app account deletion |
| Language picker; per-language Home, game, Progress and settings | Cross-language stats, streaks, a combined dashboard |
| Per-language level, saved round, history and review log | Per-language display names or avatars |
| Guest play in every language, uploaded together on sign-in | Moving progress between languages |
| Handoff of Chi è? guest progress from `chie.parlaplay.games` | Handoff for anything other than Chi è? guests |
| Redirects from `chie.` and `shei.parlaplay.games` | Keeping either subdomain as a separate app |
| English UI chrome | Translated UI chrome |

Anything not in the left column is out. New ideas go to section 11, not into the build.

---

## 2. Platform behavior

**Choosing a language.**

1. A first visit to `/` shows the language picker (route `/languages`). It shows one card per language, in registry order (section 3.1).
2. Tapping a card goes to that language's Home, `/{code}`, and records it as the last language (section 3.3).
3. A later visit to `/` goes straight to `/{lastLanguage}`. Every language Home has a `Change language` link to `/languages`.
4. A signed-in user on a device with no last language gets `profiles.last_language` from the server, if set.

**Inside a language.** Everything under `/{code}` is that language's game exactly as its game spec describes: Home (level, Play or Continue round), Game, Round end and Progress. The only platform additions are the `Change language` link on Home and the language switch on Progress (section 8).

**What is shared and what is per language.**

| Shared by every language | Kept per language |
|---|---|
| Account, email, sign-in session | Level (1 or 2) |
| Display name | Saved round in progress |
| Last language played | Games history and review log |
| Sign-out and account deletion | Cards and the Progress screen |
| The sync outbox (rows carry their language) | Device settings from the game spec (for example Shéi's pinyin toggle and pronoun switch) |

**Signing in.** As both game specs (6-digit email code), with one change: a guest who signs in with guest data in one or more languages sees one prompt covering all of them (section 6.3).

**Signing out.** Signs out of every language at once and clears the device's copy of that user's data in every language. The unsynced warning covers rows of every language.

**Edge cases.**

| Situation | Rule |
|---|---|
| A round is saved in Italian and the player switches to Chinese | Both saved rounds are kept. Each language Home offers its own `Continue round` |
| URL with an unknown language, e.g. `/fr/play` | Not-found screen: `We don't have that language yet.` with a link `Choose a language` to `/languages` |
| `/it/progress` for a player with no Italian data but some Chinese | Italian empty state from the game spec. The language switch still shows Chinese |
| Content version of one language changes | Only that language's saved round is discarded (game spec 3.6 or 3.7). Other languages keep theirs |
| Signed in on two devices, playing different languages at once | Independent: rows carry their language, sync is a union by id |
| Guest data in Italian and Chinese, then sign-in | One prompt: `Save your Italian and Chinese progress to this account?` (section 6.3) |
| Guest data in one language only, then sign-in | `Save your Italian progress to this account?` or `Save your Chinese progress to this account?` |
| `profiles.last_language` differs from the device's last language | The device wins on that device. Choosing a language writes both |
| Old link to `https://chie.parlaplay.games/play` | Handoff page, then `https://parlaplay.games/it/play` (section 5.3) |
| Old link to `https://shei.parlaplay.games/anything` | 301 to `https://parlaplay.games/zh/anything` (section 5.4) |
| Chi è? guest opens `chie.parlaplay.games` after the move | Handoff page carries their guest progress to `parlaplay.games` (section 5.3) |
| The handoff arrives when `parlaplay.games` already has Italian guest data | Union by row id; the newer saved round wins (section 5.3) |
| The handoff arrives twice | No duplicates (rows are keyed by id) |
| The handoff data is damaged or fails validation | Nothing is saved; screen shows `We couldn't bring your progress over.` with `Try again` and `Start fresh` |
| Chi è? player was signed in on `chie.parlaplay.games` | Must sign in again on `parlaplay.games` (sessions are per origin). Their data is on the server, so nothing is lost |
| Chi è? player had unsynced rows in their outbox on `chie.parlaplay.games` | The handoff carries the outbox too; it flushes when that same account signs in on `parlaplay.games`, never under another account (section 5.3) |
| Account deletion request | Deletes the account and every language's data (section 6.3) |
| Reload anywhere | Same route, same language, same saved round |

---

## 3. Data model

### 3.1 Language registry

The registry is the one list of languages. Adding a language is adding an entry and a module (3.2); nothing else lists language codes, except the database's `languages` table (6.1), which a test keeps in step.

```ts
const LanguageCode = z.enum(["it", "zh"]); // BCP 47 primary subtags, also the URL segment

const Language = z.strictObject({
  code: LanguageCode,
  englishName: z.string(),   // "Italian"
  gameTitle: z.string(),     // "Chi è?"
  gameTitleLang: z.string(), // lang attribute for the title: "it" or "zh-Hans"
  titlePinyin: z.string().optional(), // shown under the title when present
  blurb: z.string(),         // one English line on the picker card
  level: z.string(),         // the learner level the game targets
});
```

```json
[
  { "code": "it", "englishName": "Italian", "gameTitle": "Chi è?", "gameTitleLang": "it",
    "blurb": "Guess the hidden face by asking questions in Italian.", "level": "A1 to A2" },
  { "code": "zh", "englishName": "Chinese", "gameTitle": "谁？", "gameTitleLang": "zh-Hans",
    "titlePinyin": "Shéi?", "blurb": "Find the hidden person with simple Mandarin questions.",
    "level": "HSK 1" }
]
```

The registry lives in `src/core/languages.json`, validated with Zod at build time like all content.

### 3.2 Language module contract

Each language is a folder `src/languages/{code}/` that exports one module. The shell knows nothing else about a language.

```ts
type LanguageModule = {
  code: LanguageCode;
  contentVersion: number;                  // from the language's version.json
  routes: RouteObject[];                   // React Router routes under /{code}: "", "play", "progress"
  cardIds: () => string[];                 // lexicon ids that have FSRS cards (game spec section 6)
  labelFor: (id: string) => Label;         // how a review-log id shows in Progress
  isResumable: (saved: unknown) => boolean; // validates a saved round for this content version
  deviceSettings: z.ZodType;               // the game spec's device-only settings, with defaults
};

type Label =
  | { kind: "word"; text: string; reading?: string; gloss: string; lang: string }
  | { kind: "grammar"; title: string; explain: string };
```

Each module is loaded with a dynamic `import()` the first time its routes are visited, so the picker and one language never pay for the other (9, Performance).

### 3.3 Device storage

One IndexedDB database, `parlaplay`, with one key-value store `kv`. Every per-language key carries the language code.

| Key | Holds | Language |
|---|---|---|
| `app` | `{ lastLanguage?: LanguageCode }` | shared |
| `guest:{code}` | `{ games: GameRow[], reviewLog: ReviewLogRow[] }` | per language |
| `round:{code}` | `{ contentVersion, gameId, state }` | per language |
| `settings:{code}` | the module's `deviceSettings` | per language |
| `user:{userId}:{code}` | the signed-in user's local copy | per language |
| `outbox:{userId}` | queued rows; each row has `language` | shared |
| `handoff` | `{ from: "chie", at: string }` once a handoff has been saved (5.3) | shared |

The level shown before sign-in comes from `localStorage` key `parlaplay.level.{code}` (as both game specs keep it there), and from `language_settings` after sign-in (6.1).

```ts
const GameRow = z.strictObject({
  id: z.uuid(), language: LanguageCode, seed: z.int(), level: z.union([z.literal(1), z.literal(2)]),
  contentVersion: z.int().positive(), startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().optional(), result: z.enum(["won", "lost", "abandoned"]).optional(),
});

const ReviewLogRow = z.strictObject({
  id: z.uuid(), language: LanguageCode, gameId: z.uuid(), lexiconId: z.string(),
  direction: z.enum(["recognize", "produce"]),
  rating: z.enum(["again", "hard", "good", "slip"]),
  detail: z.strictObject({ slot: z.string(), given: z.string(), expected: z.string(), rule: z.string() }).optional(),
  localDay: z.iso.date(), createdAt: z.iso.datetime(),
});
```

```json
{ "id": "7b0c9d0e-3c1e-4c37-9a51-6f2f2f8d1a10", "language": "zh",
  "gameId": "0f6d1f6e-0a8e-4a0c-8e64-2c0f0c7d9b55", "lexiconId": "n.gou",
  "direction": "produce", "rating": "again",
  "detail": { "slot": "verb", "given": "是", "expected": "有", "rule": "verb.you" },
  "localDay": "2026-11-02", "createdAt": "2026-11-02T09:14:03.120Z" }
```

### 3.4 Invariants (each checked by a test)

1. **Separation.** Every row read by a language's screens, sync merge or FSRS replay has that language's code. A row of another language never reaches them.
2. Every `ReviewLogRow` points at a `GameRow` with the same `language`.
3. Lexicon ids of all languages are disjoint (no id appears in two languages). Needed by the compatibility window in 5.2.
4. The registry's codes equal the rows of the database `languages` table (6.1), checked against the migration files.
5. Every registry code has a module folder, and every module folder has a registry entry.
6. Every storage key a language writes matches one of the per-language patterns in 3.3 with its own code.
7. The sign-in prompt names exactly the languages with guest rows.

### 3.5 Content and ids

Each language keeps its own content files, versions and permanent ids, as its game spec says (Chi è? 3.6, Shéi 3.7). Language codes are permanent: a code is never renamed or reused. A retired language keeps its registry entry with `retired: true` (future; not needed in the MVP).

---

## 4. Shell contract

The shell is the code in `src/core/`: routing, language choice, account, storage and sync. It is plain React and TypeScript; the purity rules below apply only to `src/core/state/`, which holds the decisions and has no React, DOM, network or clock access, so it can be tested directly.

### 4.1 Types

```ts
type ShellState = {
  language: LanguageCode | null;   // the language whose routes are open
  lastLanguage: LanguageCode | null;
  account: { kind: "guest" } | { kind: "signedIn"; userId: string };
  guestLanguages: LanguageCode[];  // languages with guest rows on this device
  prompt: null | { kind: "saveGuest"; languages: LanguageCode[] } | { kind: "unsyncedSignOut" };
};

type ShellAction =
  | { type: "OPEN"; path: string }                         // any navigation, including the first load
  | { type: "CHOOSE"; code: LanguageCode }                 // a picker card
  | { type: "SIGNED_IN"; userId: string; serverLast: LanguageCode | null }
  | { type: "SAVE_GUEST"; answer: "yes" | "no" }
  | { type: "SIGN_OUT"; unsynced: boolean }
  | { type: "CONFIRM_SIGN_OUT"; answer: "signOut" | "wait" };

type ShellEffect =
  | { type: "navigate"; to: string; replace: boolean }
  | { type: "write"; key: "app"; value: { lastLanguage: LanguageCode } }
  | { type: "writeProfile"; lastLanguage: LanguageCode }
  | { type: "uploadGuest"; languages: LanguageCode[] }
  | { type: "deleteGuest"; languages: LanguageCode[] }
  | { type: "signOut" };
```

`reduce(state, action, registry) → { state, effects }` is the only place these decisions are made.

### 4.2 Transition table

`P` = the save-guest prompt is open. `U` = the unsynced sign-out prompt is open. `-` = ignored, no change, no effects.

| State | OPEN | CHOOSE | SIGNED_IN | SAVE_GUEST | SIGN_OUT | CONFIRM_SIGN_OUT |
|---|---|---|---|---|---|---|
| Guest, no prompt | Route (4.3) | Set language and last; effects `write`, `navigate /{code}` | If `guestLanguages` empty: signed in, last = device last or `serverLast`. Else signed in and P | - | - | - |
| Signed in, no prompt | Route (4.3) | As guest, plus `writeProfile` | - | - | `unsynced`: U. Else effects `signOut`, state guest | - |
| P open | Route (4.3), prompt stays | - | - | `yes`: `uploadGuest`; `no`: `deleteGuest`. Prompt closes | - | - |
| U open | Route (4.3), prompt stays | - | - | - | - | `signOut`: effects `signOut`, state guest. `wait`: prompt closes |

### 4.3 Routing order for OPEN

The first rule that matches decides.

1. Path is `/` and `lastLanguage` is set: `navigate /{lastLanguage}` with `replace: true`.
2. Path is `/` and `lastLanguage` is null: `navigate /languages` with `replace: true`.
3. Path is `/languages`, `/settings`, `/privacy` or `/import`: language becomes null; render that page.
4. First segment is a registry code: language becomes that code. `lastLanguage` and the `app` key change only on CHOOSE, never on OPEN, so following a link does not change the default. Starting a round in a language dispatches CHOOSE for it, so the language last played becomes the default.
5. Anything else: language null; render the not-found screen (section 2).

### 4.4 Invariants (each a test)

1. `reduce` is pure: same state and action give the same result.
2. `navigate` effects only ever point at routes in 4.3.
3. A prompt is never replaced by another prompt; P and U never open together.
4. After `SIGN_OUT` completes, `account.kind` is `guest` and no `user:{id}:*` key remains.
5. `uploadGuest` lists exactly `guestLanguages`.

### 4.5 Traced example

Guest with Italian and Chinese guest data signs in on `/zh/progress`.

1. State: `{ language: "zh", lastLanguage: "zh", account: guest, guestLanguages: ["it", "zh"], prompt: null }`.
2. The sign-in sheet verifies the code; the shell dispatches `SIGNED_IN { userId: "u1", serverLast: "it" }`.
3. Guest data exists, so the state becomes signed in with `prompt: { kind: "saveGuest", languages: ["it", "zh"] }`. The device's last language (`zh`) is kept over `serverLast` (section 2).
4. The prompt reads `Save your Italian and Chinese progress to this account?`. The player taps `Save`.
5. `SAVE_GUEST { answer: "yes" }` gives effect `uploadGuest ["it", "zh"]` and closes the prompt. The upload rewrites `user_id`, then flushes `games` rows of both languages before any `review_log` row (6.3).

**Variant: No.** `SAVE_GUEST { answer: "no" }` gives `deleteGuest ["it", "zh"]`; `guest:it` and `guest:zh` are removed; the account's server data loads.

**Variant: unknown language.** `OPEN { path: "/fr" }` sets `language: null` and renders the not-found screen. No effects.

---

## 5. Merging the two games

### 5.1 Repository

**Decision.** A new repository `jennarbates/parlaplay`, created on Wed Oct 7 from Chi è?'s `main` with its full history, plus this spec and the backlog. It holds only planning until the code moves in on Fri Oct 30, when Chi è?'s launch commit (tag `chie-launch`, made on Thu Oct 29) is merged into it. Shéi is brought in with its history. Both old repos are archived after launch.

**Steps.**

1. Merge Chi è?'s launch into the new repo: add `jennarbates/Italian` as remote `italian` and `git merge chie-launch`. This is a normal merge, because `parlaplay` `main` is an earlier Chi è? `main` plus planning commits.
2. Move the Italian game into place with `git mv`: `src/engine`, `src/content`, game screens and `public/art` go to `src/languages/it/`; shared code (`services`, account, sign-in, shell UI) goes to `src/core/`.
3. Bring in Shéi with history: add `jennarbates/Chinese` as remote `chinese`, then `git merge -s ours --no-commit --allow-unrelated-histories chinese/main` (record Shéi's history as a parent without taking its files), `git checkout chinese/main -- src/engine src/content src/ui/game public/art docs/reviews` into a temporary folder, `git mv` into `src/languages/zh/`, and commit. `git log --follow` then shows Shéi's history for its files.
4. Reconcile the shared code: where Shéi changed shared files (storage keys, `prefs`, slip rows, SRS card list), the shared version takes the language module's hooks (3.2) instead.
5. Port Chi è? fixes made after `chie-launch` by cherry-pick, logged in `docs/port-log.md`.

**Why.** One app needs one build and one deploy. Chi è?'s history is the trunk because it is the larger, launched game. A shared package across two repos was rejected: two apps would mean two origins, and IndexedDB, sessions and sign-in are per origin (D3).

### 5.2 Database migration

The existing Chi è? Supabase projects (staging and production) become parlaplay's. The migration in 6.2 adds a `language` column everywhere, defaulting to `'it'`, so every existing row is Italian and the live Chi è? app keeps working unchanged until it is replaced (its inserts leave `language` out and get `'it'`; its `cards` upsert targets the primary key, which includes `language` with the default filled in). A second migration, at least 14 days after launch, removes the defaults and the old `profiles.level` column (6.2).

**Compatibility window.** Between applying migration 1 to production and switching `chie.parlaplay.games` to the handoff page, both apps run against the same database. To keep it short, both happen in the same launch hour (milestone 16). A level changed in the old app during that window is not copied to `language_settings`; the player sees their previous level once and can change it again. A CI test runs the Chi è? `chie-launch` sync code against the migrated schema and must pass (10.2, Compatibility).

### 5.3 Guest handoff from `chie.parlaplay.games`

**Decision.** At launch, the `chie.parlaplay.games` Worker stops serving Chi è? and serves only a handoff page. The page reads Chi è?'s IndexedDB (`chi-e`, keys `guest`, `round`, and `outbox:{userId}` if any), and sends it to `https://parlaplay.games/import#data=` followed by the data, base64url-encoded JSON. The fragment never reaches a server (RFC 3986, section 3.5). The page then redirects there.

**Why.** IndexedDB is per origin, so `parlaplay.games` cannot read `chie.parlaplay.games` data, and a plain redirect would lose every Chi è? guest's progress (D9).

**Handoff page behavior.**

1. If `chi-e` has no `guest`, `round` or outbox data: redirect at once to `https://parlaplay.games/it` plus the original path (`/play` maps to `/it/play`, `/progress` to `/it/progress`, anything else to `/it`).
2. Else: show `Chi è? has moved to parlaplay.games. Bringing your progress…` and navigate to `/import#data=…&next=/it/play` (or the mapped path).
3. The handoff page never deletes Chi è?'s data, so `Try again` always works. It is removed 6 months after launch (Fri May 14 2027), after which the subdomain becomes a plain redirect.

**`/import` behavior on `parlaplay.games`.**

1. Read the fragment, then remove it from the address bar with `history.replaceState`.
2. Decode and validate with Zod: Chi è?'s `GameRow`, `ReviewLogRow` and saved round shapes. Add `language: "it"` to every row.
3. Merge into `guest:it` by id (union). The saved round goes to `round:it` unless one exists that started later.
4. Outbox rows go to `outbox:pending-handoff`, keeping their `user_id`. They are flushed only when that same user signs in on `parlaplay.games`. If a different account signs in, they stay untouched; they are deleted when the `handoff` key is older than 30 days.
5. Save `handoff`, then navigate to `next`.
6. On any failure: `We couldn't bring your progress over.` with `Try again` (back to `https://chie.parlaplay.games/`) and `Start fresh` (to `/it`).

**Size.** A heavy guest after two weeks has a few hundred log rows, about 100 KB of JSON. `TBD: verify` the largest fragment Safari on iOS accepts in a navigation; the CI handoff test uses a 500 KB payload in Chromium and WebKit.

### 5.4 Redirects

| From | To | How |
|---|---|---|
| `shei.parlaplay.games/*` | `https://parlaplay.games/zh/${1}`, status 301 | One Cloudflare Single Redirect rule with a wildcard (Free plan allows 10 per zone) |
| `chie.parlaplay.games/*` | Handoff page (5.3), then `parlaplay.games/it/...` | The existing Worker, redeployed with only the handoff page |
| `www.parlaplay.games/*` | `https://parlaplay.games/${1}`, status 301 | Single Redirect rule |

`shei.parlaplay.games` never served players, so it needs no handoff.

---

## 6. Data and backend

**Decision.** One Supabase project per environment, shared by every language: the projects Chi è? already uses. One `public` schema; every per-language table has a `language` column that references a `languages` table.

**Why.** Separation by column keeps one set of tables and one set of RLS policies, and a new language is one row (D5). A schema per language was rejected: each new language would need new tables, policies and an API settings change.

**Environments.**

| Environment | Supabase | Used by |
|---|---|---|
| Local | Supabase CLI in Docker, local inbox for sign-in emails | Development, Vitest sync and compatibility tests, Playwright, CI |
| Staging | The Chi è? staging project, renamed `parlaplay-staging` | Pull request previews of `jennarbates/parlaplay` |
| Production | The Chi è? production project (Pro from Wed Oct 28), renamed `parlaplay-prod` | `main` at `parlaplay.games` |

No new projects are needed. The Supabase Free plan allows 2 active free projects and pauses them after a week without activity; Pro is $25 a month per organization with $10 of compute credit, which covers one Micro instance (References). Production is already on Pro for Chi è?, so the merge adds no cost.

### 6.1 Tables after migration 1

```sql
create table public.languages (
  code text primary key,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  level smallint not null default 1 check (level in (1, 2)), -- Chi è? only; dropped in migration 2
  last_language text references public.languages (code),
  created_at timestamptz not null default now()
);

create table public.language_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  language text not null references public.languages (code),
  level smallint not null default 1 check (level in (1, 2)),
  updated_at timestamptz not null default now(),
  primary key (user_id, language)
);

create table public.games (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  language text not null default 'it' references public.languages (code), -- default dropped in migration 2
  seed bigint not null,
  level smallint not null check (level in (1, 2)),
  content_version int not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  result text check (result in ('won', 'lost', 'abandoned'))
);

create table public.review_log (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  language text not null default 'it' references public.languages (code),
  game_id uuid references public.games (id) on delete set null,
  lexicon_id text not null,     -- a lexicon id, or a grammar point id on slip rows
  direction text not null check (direction in ('recognize', 'produce')),
  rating text not null check (rating in ('again', 'hard', 'good', 'slip')),
  detail jsonb,
  local_day date not null,
  created_at timestamptz not null
);

create table public.cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  language text not null default 'it' references public.languages (code),
  lexicon_id text not null,
  direction text not null check (direction in ('recognize', 'produce')),
  state jsonb not null,
  due timestamptz not null,
  log_count int not null,        -- review_log rows of this language the state was built from
  updated_at timestamptz not null default now(),
  primary key (user_id, language, lexicon_id, direction)
);
```

`handle_new_user` and `cards_keep_newest` are unchanged from the Chi è? spec 7.1.

### 6.2 Migrations

**Migration 1, `supabase/migrations/20261103000000_languages.sql`** (written against Chi è?'s `20261019000000_init.sql`):

```sql
create table public.languages (
  code text primary key,
  created_at timestamptz not null default now()
);
insert into public.languages (code) values ('it'), ('zh');
alter table public.languages enable row level security; -- no policies: the app never reads it

alter table public.profiles add column last_language text references public.languages (code);

alter table public.games
  add column language text not null default 'it' references public.languages (code);
alter table public.review_log
  add column language text not null default 'it' references public.languages (code);
alter table public.cards
  add column language text not null default 'it' references public.languages (code);

alter table public.cards drop constraint cards_pkey;
alter table public.cards add primary key (user_id, language, lexicon_id, direction);

drop index public.review_log_user_created;
create index review_log_user_language_created on public.review_log (user_id, language, created_at);
create index games_user_language on public.games (user_id, language);

create table public.language_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  language text not null references public.languages (code),
  level smallint not null default 1 check (level in (1, 2)),
  updated_at timestamptz not null default now(),
  primary key (user_id, language)
);
insert into public.language_settings (user_id, language, level)
  select id, 'it', level from public.profiles;
alter table public.language_settings enable row level security;

create policy language_settings_select on public.language_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy language_settings_insert on public.language_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy language_settings_update on public.language_settings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- A log row's game must be the same user's and the same language's.
drop policy review_log_insert on public.review_log;
create policy review_log_insert on public.review_log for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (game_id is null or exists (
      select 1 from public.games g
      where g.id = game_id
        and g.user_id = (select auth.uid())
        and g.language = review_log.language
    ))
  );
```

All other policies from the Chi è? spec 7.2 stay as they are: they check `user_id` only, which is still the right rule, and language separation is enforced by the client and invariant 3.4.1, since a user may read all their own languages.

**Migration 2, `supabase/migrations/20261127000000_languages_cleanup.sql`**, applied no earlier than Fri Nov 27 and only once the handoff Worker no longer writes to the database (it never does) and no Chi è? `chie-launch` client has synced for 7 days (checked in the Supabase logs):

```sql
alter table public.games alter column language drop default;
alter table public.review_log alter column language drop default;
alter table public.cards alter column language drop default;
alter table public.profiles drop column level;
```

Order for each migration: local, then staging, then production, with the Supabase CLI, before merging code that needs it (as Chi è? 7). `jennarbates/parlaplay` becomes the only repo that holds `supabase/migrations/` (D7).

### 6.3 Auth and sync

As Chi è? spec 7.3 in full, with these changes.

- **Email.** Sender `hello@parlaplay.games` through AWS SES, from a new SES domain identity `parlaplay.games` (SPF, DKIM and DMARC in Cloudflare DNS). SES production access is per account and Region, so the Chi è? account's access carries over (References). Subject `Your parlaplay sign-in code`. Body:

  ```html
  <h2>Your parlaplay sign-in code</h2>
  <p>Type this code into the parlaplay tab where you asked for it:</p>
  <p style="font-size:2em;letter-spacing:0.2em"><strong>{{ .Token }}</strong></p>
  <p>It works for 1 hour. If you didn't ask for it, you can ignore this email.</p>
  ```

  `TBD: verify` the code lifetime set in the production project's Auth settings and match the sentence to it.
- **Guest to account.** One prompt for every language with guest data (section 2 strings). `Save` uploads all of them; `Don't save` deletes all of them. The upload sends every language's `games` rows, then every language's `review_log` rows, with `on conflict (id) do nothing`.
- **Sync.** Each row carries `language`. The outbox flushes `games` before `review_log` across all languages. A pull downloads the user's rows of every language (RLS allows it) and splits them into `user:{userId}:{code}`. Each language replays only its own rows and upserts its own `cards` with `log_count` set to that language's row count.
- **Settings.** Level is read from `language_settings` for the open language (no row means level 1) and written with an upsert on `(user_id, language)`. `last_language` is written to `profiles` on CHOOSE (4.2).
- **Sign-out.** Clears `user:{userId}:*` for every language and `outbox:{userId}`, after the unsynced warning if any row is queued in any language. Keeps `settings:*` and `app` (device settings, as Shéi 7.3).
- **Account deletion.** By email request to `privacy@parlaplay.games`, handled within one month. Deleting the auth user cascades to every language's rows. The privacy note says that deleting the account deletes progress in every language.

---

## 7. Languages at launch

Each game ships exactly as its own spec and definition of done describe, with these platform changes:

| Game spec item | Change in the merged site |
|---|---|
| Routes `/`, `/play`, `/progress` | Become `/{code}`, `/{code}/play`, `/{code}/progress` |
| Routes `/settings`, `/privacy` | Shared: one Settings page, one privacy note (section 8) |
| Home title | Home shows the registry title and a `Change language` link |
| Storage keys (`guest`, `round`, `user:{id}`, level key) | Per-language keys of 3.3 |
| Supabase projects, sender domain, Sentry project | Shared (6, 9) |
| Shéi `spec.md` D18 to D21 (own repo, own Supabase projects, staging timing, own SES identity) | Superseded by this spec (D3, D5, D6) |
| Chi è? and Shéi privacy notes | Replaced by one note (section 8) |

---

## 8. UX

### 8.1 Screens and flow

```
/ ──► /languages (first visit) ──► /{code} Home ──► /{code}/play ──► Round end
 └──► /{code} (returning)              │                 └──► /{code} Home
                                       ├──► /{code}/progress ◄──► other language's progress
                                       ├──► /settings ──► Sign-in sheet
                                       │            └──► /privacy
                                       └──► /languages (Change language)
```

| Screen | Contents |
|---|---|
| Language picker `/languages` | Heading `Choose a language`. One card per registry entry: game title (with `lang`, and pinyin under 谁？), English name, level, blurb, and `Continue round` under the title if that language has a saved round. Sign-in status in the corner as on each Home |
| Language Home `/{code}` | The game spec's Home, plus `Change language` (link to `/languages`) and the English name under the title |
| Game `/{code}/play` | The game spec's game screen, unchanged |
| Progress `/{code}/progress` | The game spec's Progress, with a language switch above the tabs: one segmented button per language, the current one pressed. Switching navigates to `/{other}/progress` |
| Settings `/settings` | Account (sign in or out, unsynced warning), then one section per language with its level and its device settings (for example `Show pinyin at Level 2` for Chinese), then a link to the privacy note |
| Privacy `/privacy` | One note for the whole site: what is stored per language, the third parties (9), that one account covers every language, that deleting it deletes every language's progress, the deletion email `privacy@parlaplay.games`, and that guest data can be cleared by Safari |
| Import `/import` | Only during a handoff: `Bringing your progress…`, then the failure screen from 5.3 if needed |
| Not found | `We don't have that language yet.` and `Choose a language` (for an unknown code), or `Page not found.` and `Go home` |

### 8.2 States

| State | Where | Behavior |
|---|---|---|
| Loading a language | First visit to `/{code}` in a session | Skeleton of that language's Home while its module loads (target under 1 s on Lighthouse mobile) |
| Language failed to load | Module import fails (offline on first visit) | `Couldn't load Chinese. Check your connection.` with `Try again` |
| Save-guest prompt | After sign-in with guest data | Dialog with the exact strings of section 2, buttons `Save` and `Don't save` |
| Handoff in progress | `/import` | `Bringing your progress…` |
| Handoff failed | `/import` | 5.3 strings |
| All other states | Inside a language | As that game spec's states table |

### 8.3 Layout

The picker fits 360 × 560 without scrolling for two languages: each card at least 44 px tall, full width with 16 px side margins. From 1024 px wide the cards sit side by side, at most 480 px each. Inside a language, the game spec's phone and desktop layouts apply unchanged.

---

## 9. Non-functional

**Browsers, stack, accessibility target, error policy.** As both game specs: current and previous major versions of iOS Safari, Android Chrome, desktop Chrome, Firefox, Safari, Edge; React, TypeScript (strict), Vite, React Router, Zustand, Tailwind CSS, Zod, `ts-fsrs`, Supabase JS, `idb`; Vitest, fast-check, Playwright; pnpm, ESLint, Prettier; WCAG 2.2 AA.

**`lang` attributes.** The document is `lang="en"`. Each game's text carries its own `lang` (`it`, `zh-Hans`, `zh-Latn-pinyin`) as its game spec says. The picker cards carry the registry's `gameTitleLang`.

**Performance.**
- `/languages`: initial JS under 150 KB gzipped (shell, Supabase client, Sentry; no language module).
- `/{code}` and below: under 250 KB gzipped for the shell plus that one language's module.
- The other language's module is never loaded until visited (checked by the bundle check script, which reads the build manifest).
- LCP under 2.5 s on Lighthouse mobile for `/languages`, `/it` and `/zh`.

**Folder structure.**

```
src/
  core/
    state/       shell reducer (pure), routing rules
    languages.json
    services/    storage, sync, srs, errors, supabase
    store/       account, auth, prefs, progress (language-aware)
    ui/          Layout, LanguagePicker, Settings, SignInSheet, SaveGuestPrompt, Privacy, Import, NotFound
  languages/
    it/          engine/, content/, ui/, art/, index.ts (the LanguageModule)
    zh/          engine/, content/, ui/, art/, index.ts
  routes.tsx
handoff/         the chie.parlaplay.games handoff page and its Worker config
supabase/        migrations/ (the only copy, D7)
e2e/             Playwright tests, one folder per language plus core/
docs/            spec.md (this file), games/it.md, games/zh.md, port-log.md, reviews/
```

The engine purity lint rule and test cover `src/languages/*/engine/` and `src/core/state/`.

**Repo, CI and deploy.** As both game specs, for `jennarbates/parlaplay`: GitHub Actions runs typecheck, lint, Vitest, Playwright (Chromium, WebKit) and the compatibility test (10.2) with a local Supabase on every push and pull request; `main` is protected. Cloudflare Workers Builds builds each pull request to a preview URL with `parlaplay-staging` settings, and `main` to production at `parlaplay.games`. The handoff page is a second Worker, `chie-handoff`, in the same repo, deployed by hand once at launch (`wrangler deploy` from `handoff/`).

**Hosting.** Cloudflare Workers static assets at `parlaplay.games`, with `assets.not_found_handling = "single-page-application"` so deep links work. Requests to static assets are free and unlimited (References). Rejected alternatives as both game specs (Vercel's free plan is non-commercial; GitHub Pages forbids running a business and has no previews).

**Error reporting.** One Sentry project, `parlaplay`, replacing the two game projects. Every event is tagged `language` (`it`, `zh` or `none`). Same privacy rules as Chi è? 9 (errors only, every data collection category off, URLs scrubbed of query strings and fragments, which matters more now because `/import` carries data in the fragment). The free Developer plan allows one user and 5,000 errors a month (References); `TBD: verify` on sentry.io/pricing before launch.

**Privacy.** Guests' data never leaves the device, in any language. Accounts store email, profile, per-language settings, games, review log and cards. Third parties as both game specs: Supabase, Cloudflare, AWS SES, Sentry. No analytics.

**Security.** RLS as section 6. The handoff fragment holds only the player's own game data, never a session token: the handoff page does not read Supabase's session from `localStorage`. `/import` validates everything with Zod before saving and never executes or renders it as HTML.

---

## 10. Test plan and definition of done

### 10.1 Spec sign-off (before building)

1. Paper-trace, using only this spec and the two game specs: a new guest plays Chinese, then Italian, signs in, plays on a second device, and signs out; and a Chi è? guest from October arrives through the handoff. Every guess becomes a fix or a `TBD:`.
2. The owner does a second paper trace of sections 4 and 6 a day after writing them. `TBD:` name a developer reviewer if one is available.
3. Tag the spec `v1`. From then, every change adds a dated changelog line.

### 10.2 Tests

| Layer | Tool | What |
|---|---|---|
| Registry | Vitest | `languages.json` passes Zod; codes match the migration's `languages` rows (3.4.4); every code has a module and every module a code (3.4.5) |
| Shell reducer | Vitest | Every cell of 4.2; routing order 4.3 with each rule first; invariants 4.4; the traced example 4.5 and its two variants |
| Shell properties | fast-check | Random action sequences keep 4.4; random paths never throw and always give exactly one route outcome |
| Separation | Vitest + fast-check | Mixed `it` and `zh` rows through storage, sync merge, replay and Progress selectors: each language sees only its own (3.4.1) |
| Lexicon ids | Vitest | No id appears in two languages' lexicons (3.4.3) |
| Storage keys | Vitest | Every write by a language matches its own patterns in 3.3 (3.4.6) |
| Sync | Vitest + local Supabase | Both game specs' sync tests, run per language; a user's `it` and `zh` rows round-trip; `review_log` insert with a game of the other language is refused by RLS; `language_settings` RLS blocks another user |
| Migration | Vitest + local Supabase | Migration 1 on a database holding `init.sql` data: every old row becomes `it`, levels copy to `language_settings`, row counts unchanged; migration 2 applies after it |
| Compatibility | Vitest + local Supabase | Chi è? `chie-launch` sync code (pinned copy in `e2e/compat/`) uploads, pulls and upserts cards against the migrated schema without errors (5.2) |
| Handoff | Vitest | Encoding round-trip; Zod rejects damaged data; merge into existing `guest:it` is a union; second import adds nothing |
| E2E | Playwright (Chromium, WebKit) | First visit to `/` shows the picker; choosing `zh` then reloading `/` opens `/zh`; a full round in each language; a saved round in each language survives switching; Progress switch shows only that language; sign-in with guest data in both languages shows the combined prompt and uploads both; sign-out clears both; `/fr` shows the not-found screen; handoff from a seeded `chi-e` database at a second origin lands the rows in `/it/progress`; a 500 KB handoff payload works |
| Each game | As its game spec | Every test in both game specs passes inside the merged repo |
| Bundle | Script | Budgets in 9; `/languages` loads no language module; `/zh` does not load `it` |
| Manual | Real iPhone, Android phone, Windows laptop, Mac laptop | Picker fits 360 × 560; switching languages; handoff from a real Chi è? guest on Safari iOS; sign-in email from `hello@parlaplay.games` arrives |
| Playtest | 3 or more HSK 1 learners and 1 Chi è? player | Shéi playtest as its spec (milestone 10), plus one Chi è? player confirming nothing regressed and their handoff worked |

### 10.3 Definition of done

- [ ] `parlaplay.games` serves the picker, `/it` and `/zh` from `main`.
- [ ] A full round of each game on an iPhone, an Android phone, and a laptop at 1024 × 640.
- [ ] One account plays both languages without signing in twice.
- [ ] The separation tests (3.4.1) pass.
- [ ] Migration 1 applied to production; every pre-merge Chi è? row is `it`; `language_settings` holds every Chi è? player's level.
- [ ] A Chi è? guest from before launch gets their progress through the handoff, on Safari iOS.
- [ ] `shei.parlaplay.games` and `www.parlaplay.games` redirect with 301.
- [ ] Sign-in email from `hello@parlaplay.games` with subject `Your parlaplay sign-in code` reaches an address outside the team.
- [ ] Privacy note live, saying one account covers every language and giving `privacy@parlaplay.games`.
- [ ] Sentry receives a test error tagged `language` with no personal data and no URL fragment.
- [ ] Bundle budgets in section 9 met; LCP under 2.5 s on `/languages`, `/it`, `/zh`.
- [ ] Both game specs' definitions of done pass in the merged site.
- [ ] CI green, including the compatibility test.
- [ ] README covers running, testing, deploying, adding a language, and the migration order.
- [ ] `jennarbates/Italian` and `jennarbates/Chinese` archived with a README line pointing to `jennarbates/parlaplay`.
- [ ] Migration 2 applied (after Fri Nov 27).
- [ ] Every `TBD:` here resolved or moved to section 11.

### 10.4 Milestones

Capacity follows the Shéi spec: half days until Thu Oct 29 (the Chi è? launch), full days from Fri Oct 30. Shéi's game work (its spec's milestones 1 to 4) continues in `jennarbates/Chinese` until then; its UI milestones (6 to 8) are already built on the branch `shei-content-engine` and move into the new repo on day 6.

| Day | Date | Capacity | Deliverable | Done when |
|---|---|---|---|---|
| 1 | Thu Oct 8 | Half | (Done Wed Oct 7: `jennarbates/parlaplay` created with this spec and the backlog.) Confirm `parlaplay.games` root is owned and unused; create the SES domain identity `parlaplay.games`; this spec to owner review | Root domain answers only Cloudflare; SES identity pending verification; review date set (Wed Oct 14) |
| 2 | Fri Oct 9 | Half | Paper trace 10.1; spike: largest handoff fragment in Safari iOS | Trace done, TBDs listed; fragment limit recorded in 5.3 |
| 3 | Mon Oct 12 to Wed Oct 14 | Half | Revise spec; tag `v1` | Spec `v1` tagged |
| 4 | Thu Oct 15 to Wed Oct 28 | Half | Shéi game work per its spec (content review, engine), in `jennarbates/Chinese` | Shéi spec milestones 3 and 4 done |
| 5 | Thu Oct 29 | Half | Chi è? launches on `chie.parlaplay.games`; tag `chie-launch` | Tag exists on Chi è? `main` |
| 6 | Fri Oct 30 | Full | Merge `chie-launch` into the new repo; move Italian into `src/languages/it` and shared code into `src/core`; import Shéi with history into `src/languages/zh` | CI green with both games' unit tests in the new layout |
| 7 | Mon Nov 2 | Full | Registry, module contract, shell reducer and routes; lazy loading; per-language storage keys | Shell reducer tests pass; `/it` and `/zh` play locally; bundle check passes |
| 8 | Tue Nov 3 | Full | Migration 1 local and staging; language-aware sync, settings, sign-in prompt, sign-out; compatibility test | Sync, migration and compatibility tests pass on local; staging migrated |
| 9 | Wed Nov 4 | Full | Picker, Home link, Progress switch, Settings, not-found screens, email template on staging; previews on staging; separation tests | A preview signs in against staging and plays both languages |
| 10 | Thu Nov 5 | Full | Handoff page and `/import`; platform e2e suite; playtest build on staging | Handoff e2e passes; playtest build deployed |
| 11 | Fri Nov 6 | Full | Playtests (Shéi spec milestone 11, plus one Chi è? player) on staging; around them: accessibility and real-device pass, Sentry project, privacy note | Findings logged and triaged; manual checklist done |
| 12 to 14 | Mon Nov 9 to Wed Nov 11 | Full | Fix findings | Every must-fix finding fixed |
| 15 | Thu Nov 12 | Full | Rehearse migration 1 on staging loaded with a copy of production data; README; DoD sweep | Rehearsal row counts match; every DoD item except launch-day ones checked |
| 16 | Fri Nov 13 | Full | Launch hour: migration 1 on production, deploy `main`, deploy `chie-handoff`, add redirect rules, SES sender live | `parlaplay.games` live; handoff and redirects verified on a phone |
| 17 | Fri Nov 27 | Short | Migration 2; archive old repos | Migration 2 on production; repos archived |

---

## 11. Future work and decision log

### 11.1 Future work

**A third language.** The registry, the `languages` table and the module contract are built for it: a new folder, a registry entry and one `insert into public.languages`. Out of the MVP because there is no third game yet.

**Shared engine package.** Both engines share their shape (step, transition table, ratings, CPU) but not their grammar. Once a third game shows what is truly common, move that into `src/core/engine-kit/`. Out of the MVP because two examples are not enough to know (Shéi D18).

**Cross-language dashboard.** A Home that shows due words in every language at once. Needs a design for mixing scripts and levels; out because each Progress screen already works.

**Translated UI chrome.** English chrome is a decision of both games (Chi è? and Shéi D16). Translating it needs an i18n layer; out.

**In-app account deletion, Google sign-in.** As both game specs.

### 11.2 Decision log

| Id | Decision | Reason |
|---|---|---|
| D1 | One site at `parlaplay.games`, games at `/it` and `/zh` | One origin is what makes one login and one device store possible |
| D2 | Language codes are BCP 47 primary subtags (`it`, `zh`) and double as URL segments | Standard, short, and the same string in URLs, storage keys and the database |
| D3 | One repo with `src/core` and `src/languages/{code}`, not two apps sharing a package | Two apps mean two origins: separate sessions and IndexedDB, so no single login without cross-origin tricks |
| D4 | New repo from Chi è?'s history, created early for planning; `chie-launch` merged in on Oct 30; Shéi merged in with history | Chi è? is the launched trunk; both histories stay searchable; issues need a repo with the spec on `main` now |
| D5 | One Supabase project per environment; a `language` column referencing a `languages` table | One set of tables and RLS; a new language is one row; no extra projects or cost |
| D6 | Reuse Chi è?'s staging and production projects | They exist, production is already Pro, and the Free plan allows only 2 active projects |
| D7 | `supabase/migrations/` lives only in `jennarbates/parlaplay` | The CLI refuses to push when the database has migrations its folder lacks; one owner avoids that |
| D8 | Migration 1 defaults `language` to `'it'`; migration 2 removes the default 14 days later | The live Chi è? app keeps working unchanged until it is replaced |
| D9 | Chi è? guests move through a fragment handoff page, not a plain redirect | IndexedDB is per origin; a redirect would lose every guest's progress. Fragments never reach a server |
| D10 | Keep the handoff page 6 months, then a plain redirect | Long enough for occasional players to return once |
| D11 | Separation enforced in the client and by tests; RLS checks only the user | A user may read all their own languages; RLS by language would add nothing for privacy |
| D12 | Level per language in `language_settings`; device settings per language in IndexedDB | A learner is often at different levels in different languages |
| D13 | `/` opens the last language; the picker is at `/languages` | Returning players land in their game in one step |
| D14 | Following a link does not change the last language; choosing or playing does | A shared link should not change someone's default |
| D15 | One save-guest prompt for all languages | One decision per sign-in, not one per language |
| D16 | Sign-out and account deletion cover every language | One account is one person's data |
| D17 | Each language's module is lazy-loaded | Keeps the 250 KB budget per page as languages are added |
| D18 | One Sentry project tagged by language | One place to look; the free plan allows one user |
| D19 | Sender `hello@parlaplay.games`, subject `Your parlaplay sign-in code` | Neutral for every language; SES production access is per account and Region, so it carries over |
| D20 | Chi è? launches unchanged on Oct 29; the merged site launches with Shéi on Nov 13 | Keeps the merge from risking Chi è?'s launch |
| D21 | Lexicon ids must be disjoint across languages | Makes the compatibility window safe and keeps Progress labels unambiguous |

---

## References

- Supabase pricing (Free plan 2 active projects, pause after 1 week; Pro $25 with $10 compute credit): https://supabase.com/pricing
- Supabase pricing summary used for the figures above: https://www.activepieces.com/blog/supabase-pricing-free-tier-limits-pro-costs-egress
- Cloudflare URL forwarding and Single Redirects (10 rules on Free, wildcards on all plans): https://developers.cloudflare.com/rules/url-forwarding/
- Cloudflare Workers pricing (static assets free and unlimited): https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Workers static assets, single-page application routing: https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- Amazon SES, production access per account and Region: https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
- Sentry free Developer plan (1 user, 5,000 errors a month), secondary source, `TBD: verify` on sentry.io: https://costbench.com/software/developer-tools/sentry/free-plan/
- RFC 3986, section 3.5: the fragment is not sent to the server: https://www.rfc-editor.org/rfc/rfc3986#section-3.5
- MDN, same-origin policy and storage (IndexedDB is per origin): https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy
- BCP 47 language tags: https://www.rfc-editor.org/info/bcp47
- Chi è? spec: `jennarbates/Italian` `spec.md` and `spec-desktop.md`
- Shéi spec: `jennarbates/Chinese` `spec.md`

---

## Changelog

- 2026-10-07: v0 draft.
- 2026-10-07: v0.2. The repo is created now from Chi è? `main` to hold the spec and backlog; `chie-launch` is merged into it on Oct 30 instead of being its starting point (5.1, D4).
- 2026-10-07: v0.1. Milestones days 9 to 11 rebalanced to match the backlog (accessibility pass, Sentry and privacy note move to day 11).
