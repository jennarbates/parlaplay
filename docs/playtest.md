# Playtest kit (PLAY-040, PLAY-041)

The plan is in spec 10.2: 3 or more HSK 1 learners play Shéi, and one Chi è? player checks that nothing regressed. At least 2 sessions are on a laptop (Chi è? desktop spec, DD13).

## The build

- URL: https://parlaplay-playtest.jennaraquelbates.workers.dev
- Database: `parlaplay-staging`, so nothing a tester does touches production
- Deploy or redeploy `main`: `supabase login` and `wrangler login` once, then `pnpm deploy:playtest`
- Before each session: open `/zh` and `/it` on a phone and play one question in each

## Recruiting message

> Hi! I'm building **谁？ (Shéi?)**, a small browser game for HSK 1 Mandarin learners. You and the computer each hide a character, and you take turns asking simple questions in Chinese (他是医生吗？) until someone guesses who it is.
>
> Would you play it for about 30 minutes, on a video call or in person? You'd play 3 short rounds on your phone or laptop and tell me what was confusing. No preparation needed. If you know the HSK 1 words, you're the right level.
>
> Could you do any of these times: ___?

For the Chi è? player:

> Chi è? now lives on a new site alongside the Chinese game. Could you play one round (about 10 minutes) and tell me if anything feels different or broken?

## Session script

Don't explain the game. If they're stuck for more than a minute, note it, then help.

1. Send the link. Ask them to share their screen, or watch over their shoulder. Note the device and browser.
2. "Pick the language you're learning and play a round." Watch the picker and the first round without helping.
3. Round 2: Level 1 again, or Level 2 if round 1 went well.
4. Round 3: Level 2 (every Shéi tester plays at least one round at Level 2).
5. Optional: "Sign in to save your progress." Check that the code email arrives and the guest rounds are kept.
6. Questions:
   - What was the most confusing moment?
   - Was any word or sentence new to you, or wrong?
   - Did it feel too easy, too hard, or about right?
   - Would you play again tomorrow? Why or why not?

Chi è? player: one round at their usual level, then: "Did anything change or break compared with before?"

## Findings log

One row per round, then one row per finding. Triage (PLAY-042) sorts findings into must-fix, should-fix, and later.

| Tester | Language | Device / browser | Round | Level | Won? | Minutes | Notes |
|---|---|---|---|---|---|---|---|
| | | | 1 | | | | |

| # | Tester | Where (screen, string) | What happened | Severity guess |
|---|---|---|---|---|
| 1 | | | | |
