# parlaplay

Small games for people learning a language, on one site with one login: [parlaplay.games](https://parlaplay.games), launching Friday November 13, 2026. Each game is a round against the computer: 24 faces, one of them hidden, and yes-or-no questions to find it. Every question you ask or answer is in the language you're learning, and gets checked, so a wrong article or verb gets caught and explained. Built for phones first.

| Language | Game | Level | Where |
|---|---|---|---|
| Italian | **Chi è?** | A1 to A2 | `/it` |
| Chinese | **谁？** (*Shéi?*) | HSK 1 | `/zh` |

Chi è? started on its own at [chie.parlaplay.games](https://chie.parlaplay.games), in [jennarbates/Italian](https://github.com/jennarbates/Italian). This repo merges it with Shéi. A guest who played at the old address keeps their progress: the old address hands it to the new one inside the browser ([spec 5.3](docs/spec.md#53-guest-handoff-from-chieparlaplaygames)).

## Planning

I'm running this like a team project even though it's just me, partly to keep the scope under control and partly because I wanted to practice the process properly. All of it is public:

- [docs/spec.md](docs/spec.md): the platform spec. What is shared and what is per language, the shell, the merge, the handoff, the database, the tests and the definition of done.
- [docs/games/it.md](docs/games/it.md) and [docs/games/zh.md](docs/games/zh.md): each game's own spec. Rules, content model, engine, learning model. [it-desktop.md](docs/games/it-desktop.md) and [zh-desktop.md](docs/games/zh-desktop.md) are their desktop layouts.
- Decision logs: [platform](docs/spec.md#112-decision-log), [Chi è?](docs/games/it.md#112-decision-log). Every real decision and why I made it.
- [planning/backlog.md](planning/backlog.md): every card with acceptance criteria, points, dependencies and the spec section it comes from, and the sprint plan. [planning/README.md](planning/README.md) says how it is generated.
- [Issues](https://github.com/jennarbates/parlaplay/issues), [milestones](https://github.com/jennarbates/parlaplay/milestones) and the [project board](https://github.com/jennarbates/parlaplay/projects): the same backlog in GitHub. Each sprint is a milestone, and each card is a sub-issue of its epic.
- [docs/process.md](docs/process.md): how I work. Definition of ready and done, estimating, branches.
- [docs/reviews](docs/reviews/): paper traces and review packets. [docs/sprints](docs/sprints/): a review and retro at the end of every sprint.

If something isn't in a spec's scope table, it's not in the MVP. New ideas go in future work ([platform](docs/spec.md#111-future-work), [Chi è?](docs/games/it.md#111-future-work)).

## Stack

React, TypeScript, Vite, Tailwind, Zustand, Zod, Supabase, `ts-fsrs` for spaced repetition, and Sentry. Tests use Vitest, fast-check and Playwright. It's hosted on Cloudflare. My reasons for each choice are in [section 9 of the Chi è? spec](docs/games/it.md#9-non-functional); what the platform adds is in [section 9 of the platform spec](docs/spec.md#9-non-functional).

## Running it

You need Node 24 and pnpm (the version is pinned in `package.json`; `corepack enable` sets it up).

```bash
pnpm install
pnpm dev           # http://localhost:5173
```

The first visit opens the language picker at `/languages`; Chi è? is at `/it` and Shéi at `/zh`, each loaded only when visited. That's enough to play as a guest: everything runs in the browser and saves to IndexedDB. Sign-in and sync need a Supabase. For a local one (needs Docker):

```bash
supabase start                      # applies supabase/migrations/
eval "$(supabase status -o env)"
VITE_SUPABASE_URL=$API_URL VITE_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY pnpm dev
```

Sign-in codes land in the local inbox at <http://127.0.0.1:54324>.

How the code is laid out:

| Folder | What's in it |
|---|---|
| `src/core/` | Shared by every language: the language registry, the shell reducer (`state/`), services (IndexedDB storage, FSRS replay, Supabase, sync, errors), stores (account, sign-in, progress, level), shared screens (layout, picker, settings, sign-in, privacy) and `handoff/` (what `/import` does with a Chi è? player's data) |
| `src/languages/it/` | Chi è?: `engine/` (pure TypeScript `step(state, action, content)` and the CPU, no React, DOM or time), `content/` (every word, character and message as JSON with Zod schemas), `ui/` (game screens), `store/` (the round) |
| `src/languages/zh/` | Shéi, laid out the same way |
| `public/art/{code}/` | The SVG layers each face is built from, per language |
| `handoff/` | The page `chie.parlaplay.games` serves after the move: it carries a Chi è? guest's progress to `/import` here (spec 5.3) |
| `scripts/` | Shared checks (content, bundle, engine purity, database); `scripts/{code}/` holds each game's character and art generators and its CPU simulation |
| `supabase/` | Migrations (tables and Row Level Security) and the sign-in email template |
| `planning/` | The platform backlog and the script that puts it in GitHub |
| `docs/` | `spec.md` (the platform spec), `games/{code}.md` (each game's spec) and `games/{code}/` (its backlog) |

## Testing

```bash
pnpm test          # Vitest: engines, content, stores, services, the handoff, plus migrations and RLS in PGlite
pnpm test:watch    # Vitest in watch mode
pnpm test:e2e      # Playwright against the production build
pnpm typecheck && pnpm lint && pnpm format:check
pnpm build && pnpm check:bundle   # /languages under 150 KB gzipped, each language under 250 KB
```

The first time, install the Playwright browsers with `pnpm exec playwright install chromium webkit`. Each `src/languages/{code}/engine/` must keep 90% line coverage or `pnpm test` fails.

Playwright runs four profiles: two phones (Chromium as a Pixel 7, WebKit as an iPhone 15) and two desktops at 1440 × 900. It builds and serves the app, and the handoff page at a second origin, itself. Tests that need a real Supabase (sign-in, sync, and `scripts/sync.integration.test.ts`) are skipped without one. CI starts a local Supabase and runs them all; [e2e/README.md](e2e/README.md) shows how to run them locally and what each end-to-end test covers.

`node scripts/it/simulate.ts` and `node scripts/zh/simulate.ts` play 1,000 games against the CPU and print how many questions it needs.

## Adding a language

A language is a folder, a registry entry and one database row. The shell knows nothing else about it ([spec 3](docs/spec.md#3-data-model)).

1. **Registry entry.** Add the language to [src/core/languages.json](src/core/languages.json) (`code`, `englishName`, `gameTitle`, `gameTitleLang`, `blurb`, `level`, and `titlePinyin` if the title needs a reading), and its code to `LanguageCode` in [src/core/languages.ts](src/core/languages.ts). The code is a BCP 47 primary subtag and becomes the URL segment. Registry order is the picker's order.
2. **Module folder.** Create `src/languages/{code}/` with an `index.ts` whose default export is a `LanguageModule` ([src/core/language-module.ts](src/core/language-module.ts)): its routes (Home, `play`, `progress`), `cardIds`, `labelFor`, `isResumable` and `deviceSettings`. It needs a `content/version.json`; the build copies its `contentVersion` into the registry. Lexicon ids must not clash with another language's (D21). Device settings that belong on the Settings page go in an optional `src/languages/{code}/settings.tsx`.
3. **One `languages` row.** Add a migration that inserts the code into `public.languages`, and apply it in the order below. Every `games`, `review_log`, `cards` and `language_settings` row references that table.

`pnpm test` then checks most of the rest by itself: every registry code has a folder and every folder a code, each `contentVersion` matches its `version.json`, and the module has the three routes, a label for every card and defaults for its device settings. Add the new language by hand to [src/languages/storage-keys.test.ts](src/languages/storage-keys.test.ts), which checks every storage key it writes carries its code. `pnpm check:bundle` checks no page loads another language's module.

## Adding a character

Characters are data. Nothing in the code names them. These steps are for Chi è?; Shéi is the same under `src/languages/zh/`, with the rules of its own spec ([zh.md 3.2](docs/games/zh.md)).

1. Add an entry to [src/languages/it/content/characters.json](src/languages/it/content/characters.json): a permanent `id` (`c.` plus the lowercase name; ids are never reused, spec 3.6), an Italian `name`, the eight `attrs`, and a `skin` (`s1` to `s5`).
2. Keep the deck fair. `pnpm test` checks the spec 3.2 rules: no two characters with the same eight attributes, as many men as women, no beard or mustache on women, and every question answered "yes" by 3 to 15 characters. With a new character added, the 12/12 and 24 counts in `src/languages/it/content/invariants.ts` need updating too.
3. Bump `contentVersion` in [src/languages/it/content/version.json](src/languages/it/content/version.json), so saved rounds from the old deck are discarded instead of resumed.
4. Run `pnpm dev` and check the face: the art is picked from the attributes, so there's nothing to draw. Long-press the card to check it large.

To make a whole new deck, `node scripts/it/generate-characters.ts --seed <n>` draws 24 that pass every rule; review it, name them, and replace the file.

To change the art, replace files in `public/art/it/` with new SVGs of the same names on the same 100 × 120 canvas. `node scripts/it/generate-placeholder-art.ts` rewrites the placeholders, and the tests check the files match it, so update or remove that test when the final art lands.

## Migrations

The schema lives in [supabase/migrations](supabase/migrations/), and this is the only repo that holds it (D7). Each migration is applied **local, then staging, then production**, with the Supabase CLI, before merging code that needs it:

```bash
supabase start && supabase db reset            # local: applies every migration from scratch
supabase link --project-ref <staging ref>  && supabase db push
supabase link --project-ref <production ref> && supabase db push
```

`pnpm test` runs every migration in PGlite and checks the tables and Row Level Security, so a migration is tested before it reaches any of the three.

| Migration | What it does | When |
|---|---|---|
| `20261019000000_init.sql` | Chi è?'s tables, RLS and triggers | Applied |
| `20261103000000_languages.sql` (migration 1) | Adds `languages`, a `language` column everywhere (default `it`), `language_settings` and `profiles.last_language` | Staging first (PLAY-022); production in the launch hour |
| `20261127000000_languages_cleanup.sql` (migration 2, not written yet; [spec 6.2](docs/spec.md#62-migrations) has its SQL) | Removes the defaults and the old `profiles.level` | No earlier than Fri Nov 27, once no Chi è? `chie-launch` client has synced for 7 days |

Chi è? shares the staging and production projects until launch. Migration 1 is written so the live Chi è? app keeps working against it ([spec 5.2](docs/spec.md#52-database-migration)), and `scripts/chie-compat.integration.test.ts` runs Chi è?'s own sync code against the migrated schema in CI. `supabase/config.toml` configures the local Supabase only and is never pushed.

## Deploying

The app is the Vite build served as Cloudflare Workers static assets ([wrangler.jsonc](wrangler.jsonc)). Cloudflare's GitHub integration (Workers Builds) deploys it, as it does Chi è?. Connecting it to this repo is PLAY-014; this is how it works once it is:

- Every pull request is uploaded as a preview version with its own `workers.dev` URL, built against the **staging** Supabase project. Cloudflare comments the URL on the PR.
- Merging to `main` deploys, built against **production**. Until launch, [wrangler.jsonc](wrangler.jsonc) still names Chi è?'s Worker and `chie.parlaplay.games`; pointing it at `parlaplay.games` is a launch-hour step (PLAY-051).
- `pnpm deploy:playtest` builds against staging and deploys by hand to a separate playtest Worker ([wrangler.playtest.jsonc](wrangler.playtest.jsonc)), which can never replace the live site.

[scripts/cloudflare-build.ts](scripts/cloudflare-build.ts) picks the keys from the branch name, tags Sentry with the commit and environment, and fails the build if a variable is missing, if a preview would point at production, or if a key is a secret or service role key.

One-time setup in the Cloudflare dashboard (Workers & Pages → Create → Import a repository → this repo):

| Setting | Value |
|---|---|
| Build command | `pnpm build:cloudflare` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch builds | On, with the default preview command |
| Build variables | `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_PUBLISHABLE_KEY`, `PRODUCTION_SUPABASE_URL`, `PRODUCTION_SUPABASE_PUBLISHABLE_KEY`, `SENTRY_DSN` |

Only the publishable (anon) keys go in there. The `parlaplay.games` zone has to be on the same Cloudflare account for the custom domain. Without `SENTRY_DSN` the app builds with error reporting off. In the Sentry project, turn on Settings → Security & Privacy → "Prevent Storing of IP Addresses".

### The handoff page

After the move, `chie.parlaplay.games` serves only [handoff/](handoff/): a static page that reads a Chi è? player's saved progress in the browser and carries it to `/import` here in the URL fragment, which never reaches a server. It is built and deployed on its own, by hand, in the launch hour:

```bash
pnpm build:handoff
pnpm exec wrangler deploy -c handoff/wrangler.jsonc
```

Set `VITE_PARLAPLAY_URL` when building it to send players somewhere other than `https://parlaplay.games` (staging). It stays up for six months, then the subdomain becomes a plain redirect (D10).
