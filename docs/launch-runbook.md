# Launch-hour runbook (PLAY-046)

Friday November 13, 2026. Spec 10.4 day 16, in its order: migration 1 on production, deploy `main`, deploy the handoff page, add the redirect rules, switch the sign-in email. Each step has its check and its way back. The cards are PLAY-050 to PLAY-053.

**Status: draft, not rehearsed.** Written on Oct 12 from the specs and the repo, before staging had migration 1 (PLAY-022) and before PLAY-051 settled the Worker names. Everything marked `TBD:` or "confirm" has to be walked once on staging before the day. Commands were not run against production.

## The one thing to know

Until step 3, nothing a player can see has changed, and stopping costs nothing. Step 3 is the switch: it replaces Chi è? at `chie.parlaplay.games` with the handoff page. Its way back is one command and takes about a minute (see [Putting Chi è? back](#putting-chi-è-back)).

Migration 1 is not undone in any rollback. It only adds things, and Chi è? runs unchanged against it (spec 5.2; the compatibility test in CI checks exactly that).

## Before the hour

Do these the day before (PLAY-047, PLAY-049) and tick them again on the morning.

- [ ] `main` is green in CI, including the compatibility test, and holds everything that launches.
- [ ] The rehearsal passed: migration 1 on staging loaded with a copy of production, row counts matched, and the copy is deleted from every machine (PLAY-047).
- [ ] `wrangler.jsonc` names the Worker that serves `parlaplay.games`, with `parlaplay.games` as its custom domain. `TBD:` (PLAY-051) today it still names `italian` and `chie.parlaplay.games`, which is Chi è?'s live Worker. **Do not deploy `main` with it as it is: that would replace Chi è? with the merged site at the old address, with no handoff.**
- [ ] `handoff/wrangler.jsonc` names Chi è?'s Worker (`italian`) and `chie.parlaplay.games`. Confirm the name with `pnpm exec wrangler deployments list --name italian`.
- [ ] Write down the version id of Chi è?'s current deployment, from that same command. This is what the rollback goes back to: `CHIE_VERSION = ____________`
- [ ] The SES domain identity `parlaplay.games` is verified, with SPF, DKIM and DMARC in Cloudflare DNS (PLAY-002).
- [ ] The parlaplay email template is merged (`supabase/templates/sign-in-code.html`), and the current production subject, template and sender are copied into a note, to paste back if needed.
- [ ] Production's Email OTP Expiration is 3600 seconds (dashboard: Authentication, Email provider). Spec 6.3 has this as `TBD: verify`.
- [ ] DNS: `shei.parlaplay.games` and `www.parlaplay.games` each have a proxied record, so the redirect rules have something to act on. `TBD:` confirm which records exist; a proxied `AAAA` to `100::` is Cloudflare's usual placeholder.
- [ ] `supabase login` and `wrangler login` work on the machine you will use, and you know the production project ref.
- [ ] Two phones charged: an iPhone (Safari) and an Android phone (Chrome). On one of them, play a round of Chi è? as a guest at `chie.parlaplay.games` **today**, and do not clear its data: that is the real guest for the handoff check.
- [ ] Pick the hour. Fewest Chi è? players is best; the Supabase dashboard's API traffic shows when.

## The hour

Work top to bottom. Do not start a step until the one before has passed its check.

### 1. Migration 1 on production (PLAY-050)

First, the counts before, in the Supabase SQL editor on production. Keep the result.

```sql
select 'profiles' t, count(*) from profiles union all
select 'games', count(*) from games union all
select 'review_log', count(*) from review_log union all
select 'cards', count(*) from cards;
```

Then:

```bash
supabase link --project-ref <production ref>
```

```bash
supabase db push
```

`supabase db push` lists the migrations it will apply and asks before applying; it should list only `20261103000000_languages.sql`.

**Check.**

- The same counts again: all four match.
- Every row is Italian, and every profile has its level carried over. Run this straight away: a player who signs up in Chi è? after the migration has a profile and no settings row yet, which is expected:

  ```sql
  select
    (select count(*) from games where language <> 'it') +
    (select count(*) from review_log where language <> 'it') +
    (select count(*) from cards where language <> 'it') as not_italian,
    (select count(*) from language_settings) - (select count(*) from profiles) as settings_minus_profiles;
  ```

  Both are 0.
- Chi è? still works: at `chie.parlaplay.games`, signed in, play one question and see no sync banner.

**If it goes wrong.** If the push fails, stop. Chi è? is untouched and still live; fix the migration another day. If the push succeeds but Chi è? stops syncing, stop and look at the Supabase logs before anything else: the compatibility test says this cannot happen, so something differs from what was tested. There is no step back from a migration that applied, and none is needed for Chi è? to keep running.

### 2. Deploy `main` to `parlaplay.games` (PLAY-051)

With `wrangler.jsonc` fixed as in "Before the hour". `TBD:` (PLAY-051) either Workers Builds deploys on the merge to `main`, or by hand:

```bash
PRODUCTION_SUPABASE_URL=<url> PRODUCTION_SUPABASE_PUBLISHABLE_KEY=<key> SENTRY_DSN=<dsn> WORKERS_CI_BRANCH=main pnpm build:cloudflare
```

```bash
pnpm exec wrangler deploy
```

**Check.**

- `https://parlaplay.games/` shows the picker with both languages. `/it` and `/zh` each start a round.
- Sign in on `parlaplay.games` with an existing Chi è? account: its Italian progress is on `/it/progress`. (The email still has the old wording until step 5.)
- `https://chie.parlaplay.games/` is **still Chi è?**. If it is not, the wrong Worker was deployed: go to [Putting Chi è? back](#putting-chi-è-back) now.

**If it goes wrong.** Nothing points at `parlaplay.games` yet, so take the time to fix it, or stop here: remove the custom domain from the new Worker in the Cloudflare dashboard and launch another day. Chi è? is unaffected.

### 3. Deploy the handoff page to `chie.parlaplay.games` (PLAY-051)

This is the switch.

```bash
pnpm build:handoff
```

```bash
pnpm exec wrangler deploy -c handoff/wrangler.jsonc
```

**Check.**

- In a private window (no Chi è? data): `https://chie.parlaplay.games/play` lands on `https://parlaplay.games/it/play`, and `https://chie.parlaplay.games/` on `/it`.
- On the phone with the real guest round: open `https://chie.parlaplay.games/`. It says "Chi è? has moved to parlaplay.games. Bringing your progress…", then shows Italian on `parlaplay.games`, and `/it/progress` has that round's words.
- Open the old address on that phone a second time: same result, nothing doubled.

**If it goes wrong.** [Putting Chi è? back](#putting-chi-è-back). A guest who already moved loses nothing either way: the handoff page never deletes Chi è?'s data, and what they played on `parlaplay.games` stays there.

### 4. Redirect rules (PLAY-052)

In the Cloudflare dashboard, zone `parlaplay.games`, Rules, Redirect Rules, two Single Redirects (spec 5.4):

| When the request matches | Redirect to | Status |
|---|---|---|
| `https://shei.parlaplay.games/*` | `https://parlaplay.games/zh/${1}` | 301 |
| `https://www.parlaplay.games/*` | `https://parlaplay.games/${1}` | 301 |

**Check.**

```bash
curl -sI https://shei.parlaplay.games/play | grep -i -E "^(HTTP|location)"
```

```bash
curl -sI https://www.parlaplay.games/it | grep -i -E "^(HTTP|location)"
```

Each prints a 301 and the target: `https://parlaplay.games/zh/play` and `https://parlaplay.games/it`. `curl -sI` asks for the headers only.

**If it goes wrong.** Disable the rule. Neither address served players before, so nothing is lost while it is off.

### 5. The parlaplay sign-in email (PLAY-052)

In the Supabase dashboard on production, Authentication:

- SMTP settings: sender `hello@parlaplay.games`, sender name `parlaplay`, through the same SES credentials.
- Email templates, both Magic Link and Confirm signup: subject `Your parlaplay sign-in code`, body from `supabase/templates/sign-in-code.html`.

`supabase/config.toml` is for the local Supabase and is not pushed, so this is done by hand.

**Check.** On `parlaplay.games`, sign in with an address outside the team (a personal Gmail is fine). The email comes from `hello@parlaplay.games`, with that subject, a 6-digit code and no link, and the code signs in. Check the spam folder too, and note where it landed.

**If it goes wrong.** Paste the old sender, subject and template back from the note. Sign-in works with either wording, so this can wait until the email is right.

### 6. Verify on real phones (PLAY-053)

- [ ] A full round of Chi è? and of Shéi on the iPhone, and on the Android phone.
- [ ] The picker fits the screen without scrolling on both.
- [ ] Sign in on one phone, play, sign in on the other: the progress is there.
- [ ] The handoff check of step 3 was done on Safari iOS. If the guest phone was the Android one, repeat it on the iPhone with a fresh guest round. That cannot be made at the old address any more, so plan the guest round for the iPhone.
- [ ] Sentry: `TBD:` (PLAY-034) a test error from production arrives tagged `language`, with no query string and no fragment in any URL.
- [ ] `pnpm check:bundle` on the deployed commit is inside its budgets (CI already ran it).

## Putting Chi è? back

For any failure from step 3 on. Target: Chi è? live at `chie.parlaplay.games` again within 10 minutes. The first command does it; the rest tidies up.

1. **Roll the Worker back** to the version noted before the hour:

   ```bash
   pnpm exec wrangler rollback <CHIE_VERSION> --name italian
   ```

   `wrangler rollback` makes an earlier version of a Worker the live one again; it takes effect in seconds. Confirm the exact form with `pnpm exec wrangler rollback --help` during the rehearsal.

   If that fails, deploy Chi è? again from its own repo: in `jennarbates/Italian` at the tag `chie-launch`, build with the production variables and run `wrangler deploy`. That is the same deploy that put it there, about 5 minutes.

2. **Check:** `https://chie.parlaplay.games/` shows Chi è?'s Home, and a signed-in round syncs.
3. **Email:** if step 5 was done, paste the old sender, subject and template back, so Chi è?'s players get Chi è?'s email.
4. **Redirects:** leave them. They do not touch Chi è?.
5. **`parlaplay.games`:** your choice. Left up, it works, and both sites share the database safely (that is the compatibility window of spec 5.2). Taken down, remove its custom domain in the dashboard.
6. **Migration 1:** leave it. Chi è? runs against it.
7. Write down what failed, with the time, before fixing anything.

Players who crossed during the attempt: a guest's Chi è? data is still at the old address, untouched. Anything they played on `parlaplay.games` as a guest stays in that browser and joins their account if they sign in; a signed-in player's rounds are in the shared database and show in Chi è? too.

## After the hour

- [ ] Watch Sentry and the Supabase logs for the first hour, then at the end of the day.
- [ ] Note the launch time. Migration 2 waits until Fri Nov 27 at the earliest, and until no `chie-launch` client has synced for 7 days (PLAY-054).
- [ ] The handoff page comes down on Fri May 14 2027, when the subdomain becomes a plain redirect (D10).
- [ ] Tick the launch-day boxes of spec 10.3, each with its evidence (PLAY-049).
- [ ] Archive the old repos on Nov 27, not today (PLAY-055).
