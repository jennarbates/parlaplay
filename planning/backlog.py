"""The parlaplay platform backlog: the one data source for backlog.md, backlog.csv and
issues.json (the input of setup_github.py). Built from docs/parlaplay-spec.md.

Run from the repo root:  python3 planning/backlog.py
It validates the backlog first and writes nothing if a check fails.
"""
import csv
import io
import json
import os
import re
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SPEC_PATH = os.path.join(ROOT, "docs", "spec.md")
REPO = "jennarbates/parlaplay"
SPEC_URL = f"https://github.com/{REPO}/blob/main/docs/spec.md"
BACKLOG_URL = f"https://github.com/{REPO}/blob/main/planning/backlog.md"

# Day -> (date label, ISO date, capacity). From spec 10.4.
DAYS = {
    1: ("Thu Oct 8", "2026-10-08", "half"),
    2: ("Fri Oct 9", "2026-10-09", "half"),
    3: ("Wed Oct 14", "2026-10-14", "half"),
    5: ("Thu Oct 29", "2026-10-29", "half"),
    6: ("Fri Oct 30", "2026-10-30", "full"),
    7: ("Mon Nov 2", "2026-11-02", "full"),
    8: ("Tue Nov 3", "2026-11-03", "full"),
    9: ("Wed Nov 4", "2026-11-04", "full"),
    10: ("Thu Nov 5", "2026-11-05", "full"),
    11: ("Fri Nov 6", "2026-11-06", "full"),
    12: ("Mon Nov 9", "2026-11-09", "full"),
    13: ("Tue Nov 10", "2026-11-10", "full"),
    14: ("Wed Nov 11", "2026-11-11", "full"),
    15: ("Thu Nov 12", "2026-11-12", "full"),
    16: ("Fri Nov 13", "2026-11-13", "full"),
    17: ("Fri Nov 27", "2026-11-27", "half"),
}
# Points a day can hold: about 5 on a half day, about 12 on a full day (one person).
CAPACITY = {"half": 5, "full": 12}

SPRINTS = [  # key, title, first day, last day, due date, goal
    ("S1", "Sprint 1: Spec and vendors", 1, 3, "2026-10-16",
     "Spec tagged v1, the handoff size limit measured, and every vendor step that waits on others started."),
    ("S2", "Sprint 2: Fork point", 5, 6, "2026-10-30",
     "Chi è? launched and tagged, and the new repo holds both games in the new layout with CI green."),
    ("S3", "Sprint 3: Merged site on staging", 7, 11, "2026-11-06",
     "One login and the language picker work on staging with both games, the handoff is built, and the playtest has run."),
    ("S4", "Sprint 4: Fix and launch", 12, 16, "2026-11-13",
     "Must-fix findings closed, migration rehearsed, and parlaplay.games live with redirects and the handoff."),
    ("S5", "Sprint 5: Cleanup", 17, 17, "2026-11-27",
     "Compatibility defaults removed and the old repos archived."),
]

EPICS = [  # key, name
    ("E0", "Spec sign-off"),
    ("E1", "Vendors and email"),
    ("E2", "Repo merge"),
    ("E3", "Shell and routing"),
    ("E4", "Accounts and storage"),
    ("E5", "Database and sync"),
    ("E6", "Picker and shared screens"),
    ("E7", "Handoff and redirects"),
    ("E8", "Quality and performance"),
    ("E9", "Playtest and fixes"),
    ("E10", "Launch and cleanup"),
]

# id, title, epic, type, points, day, depends on, waits on others, spec refs, description, acceptance criteria
CARDS = [
    # Day 1
    ("PLAY-001", "Confirm parlaplay.games root is ours and unused", "E1", "chore", 1, 1, [], True,
     ["10.4", "D1"],
     "Check the root domain before anything is built on it.",
     ["parlaplay.games is a zone in the Cloudflare account that holds chie.parlaplay.games",
      "The root and www have no records serving anything else",
      "Result written into the spec's day 1 row"]),
    ("PLAY-002", "Create the SES domain identity for parlaplay.games", "E1", "chore", 1, 1, [], True,
     ["6.3", "D19"],
     "Add parlaplay.games as an SES identity in the Region Chi è? already uses.",
     ["SES domain identity parlaplay.games created in the same account and Region as chie.parlaplay.games",
      "SPF, DKIM and DMARC records added in Cloudflare DNS",
      "Identity shows Verified"]),
    ("PLAY-056", "Create jennarbates/parlaplay with the spec and backlog", "E2", "chore", 1, 1,
     [], False,
     ["5.1", "D4"],
     "Done Wed Oct 7: the repo exists early so issues can link to the spec.",
     ["jennarbates/parlaplay main is Chi è? main with its history plus docs/spec.md and planning/",
      "Spec links in the issues open the right headings"]),
    ("PLAY-003", "Request owner review of the platform spec", "E0", "task", 1, 1, [], True,
     ["10.1"],
     "Book a read of the whole spec with a return date of Wed Oct 14.",
     ["Spec sent with a return date of Wed Oct 14",
      "Comments collected in one place"]),
    ("PLAY-004", "Find a developer reviewer for sections 4 to 6", "E0", "task", 1, 1, [], True,
     ["10.1", "4", "5", "6"],
     "Ask a developer to review the shell contract, the merge plan and the data model.",
     ["Sections 4, 5 and 6 sent with a return date of Wed Oct 14",
      "If nobody is available by Fri Oct 9, the owner's second paper trace is booked instead"]),
    # Day 2
    ("PLAY-005", "Paper-trace both journeys in spec 10.1", "E0", "spike", 2, 2, [], False,
     ["10.1", "2", "4.5", "5.3"],
     "Walk the new-guest journey and the Chi è? handoff journey using only the specs.",
     ["Journey 1 traced: guest plays zh then it, signs in, second device, signs out",
      "Journey 2 traced: an October Chi è? guest arrives through the handoff",
      "Every guess logged as a fix or a TBD"]),
    ("PLAY-006", "Measure the largest handoff fragment on phones", "E7", "spike", 2, 2, [], False,
     ["5.3"],
     "Find how much data a URL fragment can carry in a navigation on real phones.",
     ["A test page navigates with 100 KB, 500 KB, 1 MB and 2 MB fragments",
      "Tried on Safari on a real iPhone and Chrome on a real Android phone",
      "The largest size that arrives intact is written into spec 5.3",
      "If it is under 500 KB, spec 5.3 gets a decision (compress or split) and a decision log entry"]),
    # Day 3
    ("PLAY-007", "Fold in the reviews and tag the spec v1", "E0", "task", 2, 3,
     ["PLAY-003", "PLAY-004", "PLAY-005", "PLAY-006"], False,
     ["10.1", "1"],
     "Apply every review comment, resolve or move each TBD, and tag v1.",
     ["Every review comment applied or answered",
      "Every TBD resolved or moved to section 11",
      "Changelog line added and the spec tagged v1"]),
    ("PLAY-008", "Verify the remaining vendor facts", "E1", "spike", 1, 3, [], False,
     ["6.3", "9", "References"],
     "Check the facts the spec marks TBD: verify.",
     ["Sentry free plan limits checked on sentry.io and cited",
      "Sign-in code lifetime read from the production Auth settings and matched in the email text",
      "Each result written into the spec with its source"]),
    # Day 5
    ("PLAY-009", "Tag chie-launch on Chi è? main", "E2", "chore", 1, 5, [], False,
     ["5.1", "D20"],
     "Mark the exact commit Chi è? launched from, the fork point of the new repo.",
     ["Tag chie-launch on the commit deployed to chie.parlaplay.games",
      "Tag pushed to jennarbates/Italian"]),
    # Day 6
    ("PLAY-010", "Merge chie-launch into jennarbates/parlaplay", "E2", "chore", 2, 6,
     ["PLAY-007", "PLAY-009", "PLAY-056"], False,
     ["5.1", "D4"],
     "Bring Chi è? as launched into the new repo with a normal merge.",
     ["main contains the chie-launch commit and git log shows Chi è? history",
      "main is protected and needs green CI to merge",
      "docs/games/it.md is the Chi è? spec; docs/spec.md is still this spec"]),
    ("PLAY-011", "Move Italian into src/languages/it and shared code into src/core", "E2", "task", 3, 6,
     ["PLAY-010"], False,
     ["5.1", "7", "9"],
     "Restructure with git mv so history follows every file.",
     ["Folder structure matches spec 9",
      "git log --follow shows Chi è? history for moved files",
      "Every Chi è? unit and e2e test passes in the new layout"]),
    ("PLAY-012", "Import Shéi with its history into src/languages/zh", "E2", "task", 3, 6,
     ["PLAY-011"], False,
     ["5.1", "7"],
     "Bring in Shéi's engine, content, screens and art as spec 5.1 step 3 describes.",
     ["The merge commit has jennarbates/Chinese main as a parent",
      "Shéi files live under src/languages/zh and git log --follow shows their history",
      "docs/games/zh.md is the Shéi spec; docs/reviews holds the golden strings file",
      "Every Shéi unit test passes in the new layout"]),
    ("PLAY-013", "Reconcile the shared code Shéi changed", "E2", "task", 2, 6,
     ["PLAY-012"], False,
     ["5.1", "3.2"],
     "Storage keys, prefs, slip rows and the SRS card list become module hooks instead of forks.",
     ["src/core has one copy of storage, sync, srs, prefs and progress",
      "Language differences come only through the LanguageModule fields of spec 3.2",
      "Both games' unit tests pass"]),
    ("PLAY-014", "Set up CI and Workers Builds for the new repo", "E2", "chore", 2, 6,
     ["PLAY-010"], False,
     ["9", "10.3"],
     "Typecheck, lint, Vitest and Playwright on every push, previews per pull request.",
     ["GitHub Actions runs typecheck, lint, Vitest and Playwright (Chromium, WebKit) with a local Supabase",
      "Cloudflare Workers Builds builds each pull request to a preview URL",
      "Both games' test suites run in CI and pass"]),
    # Day 7
    ("PLAY-015", "Add the language registry with Zod validation", "E3", "task", 1, 7,
     ["PLAY-013"], False,
     ["3.1", "3.4"],
     "src/core/languages.json with the two entries of spec 3.1, checked at build time.",
     ["languages.json matches the spec 3.1 example",
      "The content check plugin fails the build on an invalid entry",
      "A test checks every code has a module folder and every folder a code (3.4.5)"]),
    ("PLAY-016", "Define the LanguageModule contract and both modules", "E3", "task", 3, 7,
     ["PLAY-015"], False,
     ["3.2", "3.5", "D17"],
     "Each language exports one LanguageModule; the shell knows nothing else about a language.",
     ["src/languages/it/index.ts and src/languages/zh/index.ts export the type of spec 3.2",
      "Routes /{code}, /{code}/play and /{code}/progress come from the module",
      "A test checks lexicon ids are disjoint across languages (3.4.3)"]),
    ("PLAY-017", "Build the pure shell reducer and routing rules", "E3", "task", 3, 7,
     ["PLAY-015"], False,
     ["4.1", "4.2", "4.3", "D13", "D14"],
     "reduce(state, action, registry) in src/core/state, with no React, DOM, network or clock.",
     ["Types match spec 4.1",
      "Routing follows the order of spec 4.3",
      "The engine purity lint rule and test cover src/core/state"]),
    ("PLAY-018", "Test the shell reducer", "E3", "test", 3, 7,
     ["PLAY-017"], False,
     ["4.2", "4.4", "4.5", "10.2"],
     "Unit and property tests for the shell contract.",
     ["Every cell of the 4.2 table is a test",
      "Each 4.3 routing rule is tested as the first match",
      "fast-check sequences keep every 4.4 invariant",
      "The 4.5 traced example and both variants pass"]),
    ("PLAY-019", "Lazy-load language modules and extend the bundle check", "E8", "task", 2, 7,
     ["PLAY-016"], False,
     ["9", "D17"],
     "Each module loads with import() on first visit; the bundle check enforces the budgets.",
     ["/languages initial JS is under 150 KB gzipped",
      "/it and /zh are each under 250 KB gzipped with one module",
      "The check fails if /zh loads the it module or /languages loads either"]),
    # Day 8
    ("PLAY-020", "Namespace device storage keys by language", "E4", "task", 2, 8,
     ["PLAY-016"], False,
     ["3.3", "3.4"],
     "IndexedDB database parlaplay with the keys of spec 3.3.",
     ["Every key matches a pattern in the spec 3.3 table",
      "The level before sign-in uses localStorage key parlaplay.level.{code}",
      "A test checks every write by a language uses its own code (3.4.6)"]),
    ("PLAY-021", "Write migration 1 and its migration test", "E5", "task", 3, 8,
     ["PLAY-013"], False,
     ["6.1", "6.2", "D5", "D8"],
     "supabase/migrations/20261103000000_languages.sql exactly as spec 6.2.",
     ["The migration file matches spec 6.2",
      "On a database seeded with init.sql data every old row becomes it and row counts are unchanged",
      "language_settings holds one it row per profile with the profile's level",
      "RLS refuses a review_log row whose game has the other language"]),
    ("PLAY-022", "Apply migration 1 to staging", "E5", "chore", 1, 8,
     ["PLAY-021"], False,
     ["6.2"],
     "Run migration 1 on parlaplay-staging with the Supabase CLI.",
     ["supabase db push applies migration 1 to staging without errors",
      "The staging projects are renamed parlaplay-staging and parlaplay-prod in the dashboard"]),
    ("PLAY-023", "Make sync, replay and settings language-aware", "E5", "task", 3, 8,
     ["PLAY-020", "PLAY-021"], False,
     ["6.3", "D12"],
     "Rows carry language; each language replays and upserts only its own cards.",
     ["The outbox flushes games before review_log across all languages",
      "A pull splits rows into user:{userId}:{code}",
      "cards upserts set log_count to that language's row count",
      "Level reads and upserts language_settings on (user_id, language)"]),
    ("PLAY-024", "Add the Chi è? compatibility test", "E5", "test", 2, 8,
     ["PLAY-021"], False,
     ["5.2", "10.2"],
     "Chi è?'s chie-launch sync code runs against the migrated schema in CI.",
     ["A pinned copy of the chie-launch sync code lives in e2e/compat",
      "It uploads games and review_log, pulls, and upserts cards without errors",
      "The test runs in CI on every push"]),
    ("PLAY-025", "Combine the save-guest prompt and multi-language sign-out", "E4", "story", 2, 8,
     ["PLAY-017", "PLAY-023"], False,
     ["2", "6.3", "D15", "D16"],
     "As a guest who played both games, I decide once whether to keep my progress.",
     ["With guest data in both: Save your Italian and Chinese progress to this account?",
      "With one: Save your Italian progress to this account? or Save your Chinese progress to this account?",
      "Sign-out clears user:{userId}:* for every language and keeps settings:* and app",
      "The unsynced warning counts queued rows of every language"]),
    # Day 9
    ("PLAY-026", "Test separation across storage, sync and Progress", "E8", "test", 2, 9,
     ["PLAY-023"], False,
     ["3.4", "10.2"],
     "Mixed it and zh rows never reach the other language.",
     ["fast-check runs mixed rows through storage, sync merge, replay and Progress selectors",
      "Each language sees only its own rows (3.4.1)",
      "Every review_log row points at a game of its language (3.4.2)"]),
    ("PLAY-027", "Build the language picker at /languages", "E6", "story", 3, 9,
     ["PLAY-017", "PLAY-016"], False,
     ["2", "8.1", "8.3"],
     "As a new visitor, I choose which language to play.",
     ["Heading Choose a language and one card per registry entry in registry order",
      "Each card shows the title with its lang, pinyin under 谁？, the English name, level and blurb",
      "A language with a saved round shows Continue round on its card",
      "Fits 360 × 560 with no scroll; side by side from 1024 px, at most 480 px each"]),
    ("PLAY-028", "Add Change language and the Progress language switch", "E6", "story", 2, 9,
     ["PLAY-027"], False,
     ["8.1", "2"],
     "As a learner of both languages, I move between them from Home and Progress.",
     ["Every language Home shows Change language linking to /languages and the English name under the title",
      "Progress shows one segmented button per language, the current one pressed",
      "Switching navigates to /{other}/progress"]),
    ("PLAY-029", "Merge Settings into one page with per-language sections", "E6", "story", 2, 9,
     ["PLAY-023"], False,
     ["8.1", "D12"],
     "As a learner, I set each language's level and options in one place.",
     ["Account section first, then one section per language, then the privacy link",
      "Each language section shows its level and its device settings",
      "Chinese shows Show pinyin at Level 2"]),
    ("PLAY-030", "Write the shared privacy note", "E6", "task", 1, 11, [], False,
     ["8.1", "9", "6.3"],
     "One note for the whole site at /privacy.",
     ["Says one account covers every language and deleting it deletes every language's progress",
      "Gives privacy@parlaplay.games and lists Supabase, Cloudflare, AWS SES and Sentry",
      "Says guest data can be cleared by Safari"]),
    ("PLAY-031", "Switch the sign-in email to parlaplay", "E1", "chore", 1, 9,
     ["PLAY-002", "PLAY-022"], False,
     ["6.3", "D19"],
     "The neutral template and subject on staging, ready for production.",
     ["Subject Your parlaplay sign-in code",
      "Body matches the spec 6.3 template",
      "Template committed to supabase/templates and applied to staging"]),
    ("PLAY-032", "Point previews at parlaplay-staging", "E5", "chore", 1, 9,
     ["PLAY-022", "PLAY-014"], False,
     ["6", "9"],
     "Workers Builds preview builds use the staging URL and publishable key.",
     ["A pull request preview signs in against parlaplay-staging",
      "No preview build contains production settings"]),
    ("PLAY-033", "Add the not-found screens", "E6", "story", 1, 9,
     ["PLAY-017"], False,
     ["2", "8.1"],
     "As a visitor on a wrong link, I find my way back.",
     ["/fr shows We don't have that language yet. with Choose a language",
      "Any other unknown path shows Page not found. with Go home"]),
    ("PLAY-034", "Create the parlaplay Sentry project with language tags", "E8", "chore", 1, 11,
     ["PLAY-016"], False,
     ["9", "D18"],
     "One Sentry project replaces the two game projects.",
     ["Every event has a language tag of it, zh or none",
      "URLs are scrubbed of query strings and fragments",
      "The setting that prevents storing IP addresses is on"]),
    # Day 10
    ("PLAY-035", "Build /import with validation and merge", "E7", "story", 3, 10,
     ["PLAY-020", "PLAY-006"], False,
     ["5.3", "D9"],
     "As a Chi è? guest arriving from the old address, my progress is waiting for me.",
     ["The fragment is removed from the address bar before anything else",
      "Data is validated with Zod and every row gets language it",
      "Rows merge into guest:it by id; a second import adds nothing",
      "Outbox rows flush only when the same user signs in",
      "Failure shows We couldn't bring your progress over. with Try again and Start fresh"]),
    ("PLAY-036", "Build the chie handoff page Worker", "E7", "task", 3, 10,
     ["PLAY-035"], False,
     ["5.3", "5.4", "D10"],
     "handoff/ serves only the move page at chie.parlaplay.games.",
     ["With no Chi è? data it redirects to parlaplay.games/it plus the mapped path",
      "With data it shows Chi è? has moved to parlaplay.games. Bringing your progress… and navigates to /import",
      "It never reads the Supabase session and never deletes Chi è? data"]),
    ("PLAY-037", "Test the handoff end to end", "E7", "test", 2, 10,
     ["PLAY-036"], False,
     ["5.3", "10.2"],
     "Playwright with a seeded chi-e database at a second origin.",
     ["Seeded rows appear in /it/progress after the handoff",
      "A 500 KB payload works in Chromium and WebKit",
      "Damaged data shows the failure screen and saves nothing"]),
    ("PLAY-038", "Write the platform e2e suite", "E8", "test", 3, 10,
     ["PLAY-025", "PLAY-027", "PLAY-028", "PLAY-033"], False,
     ["10.2"],
     "The E2E row of spec 10.2 for the platform.",
     ["First visit to / shows the picker; choosing zh then reloading / opens /zh",
      "A full round in each language; both saved rounds survive switching",
      "Sign-in with guest data in both languages shows the combined prompt and uploads both",
      "Sign-out clears both; /fr shows the not-found screen"]),
    ("PLAY-039", "Run the accessibility and real-device pass", "E8", "test", 2, 11,
     ["PLAY-027", "PLAY-035"], False,
     ["9", "10.2", "8.3"],
     "The Manual row of spec 10.2 for the platform screens.",
     ["Picker fits 360 × 560 on a real iPhone and Android phone",
      "Touch targets at least 44 × 44 px on the picker, Settings and /import",
      "LCP under 2.5 s on Lighthouse mobile for /languages, /it and /zh"]),
    ("PLAY-040", "Deploy the playtest build to staging", "E9", "chore", 1, 10,
     ["PLAY-038", "PLAY-032"], False,
     ["10.4"],
     "A stable staging build for Friday's playtests.",
     ["main deployed to the staging preview URL",
      "Both games and sign-in work there"]),
    # Day 11
    ("PLAY-041", "Run the playtests on staging", "E9", "test", 3, 11,
     ["PLAY-040"], True,
     ["10.2"],
     "Shéi's planned playtest plus one Chi è? player, on the merged site.",
     ["3 or more HSK 1 learners play as Shéi spec 10.2 says",
      "One Chi è? player plays a round and confirms nothing regressed",
      "Every confusing string and bug logged"]),
    ("PLAY-042", "Triage the playtest findings", "E9", "task", 1, 11,
     ["PLAY-041"], False,
     ["10.4"],
     "Sort findings into must-fix and later.",
     ["Each finding is must-fix or moved to section 11 of the right spec",
      "Each must-fix finding is an issue in the Sprint 4 milestone"]),
    # Days 12 to 14
    ("PLAY-043", "Fix the first must-fix findings", "E9", "task", 5, 12,
     ["PLAY-042"], False,
     ["10.4"],
     "Work the must-fix list from the top.",
     ["The highest-priority must-fix findings fixed with tests",
      "CI green"]),
    ("PLAY-044", "Fix the remaining must-fix findings", "E9", "task", 5, 13,
     ["PLAY-043"], False,
     ["10.4"],
     "Finish the must-fix list.",
     ["Every must-fix finding closed",
      "CI green"]),
    ("PLAY-045", "Retest fixes on real phones", "E9", "test", 2, 14,
     ["PLAY-044"], False,
     ["10.2"],
     "Repeat the manual pass for every screen a fix touched.",
     ["Each fix checked on a real iPhone and Android phone",
      "Results logged"]),
    ("PLAY-046", "Write the launch-hour runbook", "E10", "task", 2, 14,
     ["PLAY-022"], False,
     ["5.2", "10.4"],
     "Every launch step in order, with the check after each and how to roll back.",
     ["Steps match spec 10.4 day 16 in order",
      "Each step names its check and its rollback",
      "Rollback restores chie.parlaplay.games to Chi è? within 10 minutes"]),
    # Day 15
    ("PLAY-047", "Rehearse migration 1 on a copy of production", "E10", "test", 3, 15,
     ["PLAY-022", "PLAY-046"], False,
     ["6.2", "10.4"],
     "Load a production dump into staging and run migration 1 there.",
     ["Row counts before and after match for profiles, games, review_log and cards",
      "Every row has language it",
      "The compatibility test passes against the rehearsed database",
      "The dump is deleted from every machine afterwards"]),
    ("PLAY-048", "Write the README", "E10", "task", 2, 15,
     ["PLAY-016"], False,
     ["10.3"],
     "How to run, test, deploy, add a language and apply migrations.",
     ["Covers run, test, deploy and the migration order local, staging, production",
      "Adding a language: registry entry, module folder, one languages row"]),
    ("PLAY-049", "Sweep the definition of done", "E10", "task", 1, 15,
     ["PLAY-045", "PLAY-047", "PLAY-048"], False,
     ["10.3"],
     "Check every 10.3 box that can be checked before launch.",
     ["Every pre-launch 10.3 item checked with a link to its evidence",
      "Launch-day items listed in the runbook"]),
    # Day 16
    ("PLAY-050", "Apply migration 1 to production", "E10", "chore", 1, 16,
     ["PLAY-047", "PLAY-049"], False,
     ["6.2", "5.2"],
     "First step of the launch hour.",
     ["supabase db push applies migration 1 to parlaplay-prod",
      "Row counts match the rehearsal's checks"]),
    ("PLAY-051", "Deploy parlaplay.games and the handoff Worker", "E10", "chore", 2, 16,
     ["PLAY-050", "PLAY-036"], False,
     ["5.3", "9"],
     "Production deploy of main and of handoff/.",
     ["parlaplay.games serves the picker, /it and /zh from main",
      "chie.parlaplay.games serves only the handoff page"]),
    ("PLAY-052", "Turn on redirects and the parlaplay sender", "E10", "chore", 1, 16,
     ["PLAY-051", "PLAY-031", "PLAY-001"], False,
     ["5.4", "6.3"],
     "Redirect rules and the production email settings.",
     ["shei.parlaplay.games/* and www.parlaplay.games/* return 301 to the spec 5.4 targets",
      "Production sends from hello@parlaplay.games with the parlaplay template",
      "A sign-in code email reaches an address outside the team"]),
    ("PLAY-053", "Verify the launch on real phones", "E10", "test", 1, 16,
     ["PLAY-052"], False,
     ["10.3"],
     "The launch-day checks of 10.3.",
     ["A full round of each game on a real iPhone and Android phone",
      "A real Chi è? guest's progress arrives through the handoff on Safari iOS",
      "Sentry receives a test error tagged language with no fragment"]),
    # Day 17
    ("PLAY-054", "Apply migration 2 after old clients stop", "E10", "chore", 2, 17,
     ["PLAY-050"], False,
     ["6.2", "D8"],
     "Remove the compatibility defaults and profiles.level.",
     ["Supabase logs show no chie-launch client sync for 7 days",
      "Migration 2 applied local, staging, then production",
      "The compatibility test is removed from CI in the same pull request"]),
    ("PLAY-055", "Archive the Italian and Chinese repos", "E10", "chore", 1, 17,
     ["PLAY-051"], False,
     ["10.3", "D4"],
     "Point both old repos at the new one and archive them.",
     ["Each README's first line points to jennarbates/parlaplay",
      "Both repos archived on GitHub"]),
]

DOD = [  # spec 10.3 item -> cards
    ("parlaplay.games serves the picker, /it and /zh from main", ["PLAY-051"]),
    ("A full round of each game on an iPhone, an Android phone, and a laptop at 1024 × 640", ["PLAY-039", "PLAY-053"]),
    ("One account plays both languages without signing in twice", ["PLAY-025", "PLAY-038"]),
    ("The separation tests (3.4.1) pass", ["PLAY-026"]),
    ("Migration 1 applied to production; every pre-merge Chi è? row is it; language_settings holds every level", ["PLAY-021", "PLAY-050"]),
    ("A Chi è? guest from before launch gets their progress through the handoff, on Safari iOS", ["PLAY-006", "PLAY-037", "PLAY-053"]),
    ("shei.parlaplay.games and www.parlaplay.games redirect with 301", ["PLAY-052"]),
    ("Sign-in email from hello@parlaplay.games reaches an address outside the team", ["PLAY-002", "PLAY-031", "PLAY-052"]),
    ("Privacy note live", ["PLAY-030"]),
    ("Sentry receives a test error tagged language with no personal data and no URL fragment", ["PLAY-034", "PLAY-053"]),
    ("Bundle budgets met; LCP under 2.5 s on /languages, /it, /zh", ["PLAY-019", "PLAY-039"]),
    ("Both game specs' definitions of done pass in the merged site", ["PLAY-014", "PLAY-041"]),
    ("CI green, including the compatibility test", ["PLAY-014", "PLAY-024"]),
    ("README covers running, testing, deploying, adding a language, and the migration order", ["PLAY-048"]),
    ("jennarbates/Italian and jennarbates/Chinese archived", ["PLAY-055"]),
    ("Migration 2 applied (after Fri Nov 27)", ["PLAY-054"]),
    ("Every TBD resolved or moved to section 11", ["PLAY-007", "PLAY-008"]),
]

# Spec sections with a deliverable: each needs at least one card.
SECTIONS_WITH_DELIVERABLES = ["1", "2", "3.1", "3.2", "3.3", "3.4", "4.1", "4.2", "4.3", "4.4",
                              "4.5", "5.1", "5.2", "5.3", "5.4", "6.1", "6.2", "6.3", "7", "8.1",
                              "8.3", "9", "10.1", "10.2", "10.3", "10.4"]

COLORS = ["a14dcb", "cf7a24", "4d8ccb", "4d57cb", "4db6cb", "4dcba1", "8bcb4d", "cb4d6e",
          "cbaa4d", "6e7781", "3d8b3d"]
TYPE_COLORS = {"story": "1f6feb", "task": "8250df", "test": "bf3989", "chore": "6e7781",
               "spike": "d4a72c"}

FIELDS = ["id", "title", "epic", "type", "points", "day", "deps", "waits", "refs", "desc", "ac"]
cards = [dict(zip(FIELDS, c)) for c in CARDS]
by_id = {c["id"]: c for c in cards}
epic_name = dict(EPICS)


def sprint_of(day):
    for s in SPRINTS:
        if s[2] <= day <= s[3]:
            return s
    raise ValueError(f"day {day} has no sprint")


# ---------- validation ----------

def validate():
    problems, notes = [], []
    ids = [c["id"] for c in cards]
    if len(ids) != len(set(ids)):
        problems.append("duplicate card ids")
    for c in cards:
        if c["points"] not in (1, 2, 3, 5):
            problems.append(f"{c['id']}: {c['points']} points")
        if c["day"] not in DAYS:
            problems.append(f"{c['id']}: unknown day {c['day']}")
        if c["epic"] not in epic_name:
            problems.append(f"{c['id']}: unknown epic {c['epic']}")
        if not 2 <= len(c["ac"]) <= 7:
            problems.append(f"{c['id']}: {len(c['ac'])} acceptance criteria")
        if len(c["title"]) > 70:
            problems.append(f"{c['id']}: title over 70 characters")
        for d in c["deps"]:
            if d not in by_id:
                problems.append(f"{c['id']}: depends on unknown {d}")
            elif by_id[d]["day"] > c["day"]:
                problems.append(f"{c['id']} (day {c['day']}) depends on {d} (day {by_id[d]['day']})")
    # issues are created in list order, so each dependency must come earlier in the list
    pos = {c["id"]: i for i, c in enumerate(cards)}
    for c in cards:
        for d in c["deps"]:
            if d in pos and pos[d] > pos[c["id"]]:
                problems.append(f"{c['id']} is listed before its dependency {d}")
    # cycles
    state = {}

    def visit(i, path):
        if state.get(i) == 1:
            problems.append("cycle: " + " -> ".join(path + [i]))
            return
        if state.get(i) == 2:
            return
        state[i] = 1
        for d in by_id[i]["deps"]:
            if d in by_id:
                visit(d, path + [i])
        state[i] = 2
    for i in ids:
        visit(i, [])
    # definition of done and spec coverage
    for item, refs in DOD:
        for r in refs:
            if r not in by_id:
                problems.append(f"DoD '{item}': unknown card {r}")
    covered = {r for c in cards for r in c["refs"]}
    for s in SECTIONS_WITH_DELIVERABLES:
        if s not in covered and not any(r.startswith(s + ".") for r in covered):
            problems.append(f"spec section {s} has no card")
    # spec refs resolve to headings
    for c in cards:
        for r in c["refs"]:
            if re.fullmatch(r"\d+(\.\d+)*", r) and r not in ANCHORS:
                problems.append(f"{c['id']}: spec ref {r} has no heading")
    # no em dashes anywhere
    blob = json.dumps(CARDS + SPRINTS + EPICS + DOD, ensure_ascii=False)
    if "\u2014" in blob:
        problems.append("em dash found in backlog data")
    # load per day
    load = defaultdict(int)
    for c in cards:
        load[c["day"]] += c["points"]
    for day, pts in sorted(load.items()):
        cap = CAPACITY[DAYS[day][2]]
        if pts > cap + 2:
            notes.append(f"day {day} ({DAYS[day][0]}) has {pts} points against about {cap}")
    return problems, notes, load


# ---------- spec anchors ----------

def github_slug(heading):
    s = heading.strip().lower()
    s = re.sub(r"[^\w\- ]", "", s)
    return s.replace(" ", "-")


ANCHORS = {}
for line in open(SPEC_PATH, encoding="utf-8"):
    m = re.match(r"^(#{2,3}) ((\d+(?:\.\d+)*)\.? .*)$", line.rstrip())
    if m:
        ANCHORS[m.group(3)] = github_slug(m.group(2))


def ref_link(r):
    if r in ANCHORS:
        return f"[{r}]({SPEC_URL}#{ANCHORS[r]})"
    if r.startswith("D"):
        return f"[{r}]({SPEC_URL}#112-decision-log)"
    if r == "References":
        return f"[References]({SPEC_URL}#references)"
    return r


# ---------- outputs ----------

def write_outputs(load):
    total = sum(c["points"] for c in cards)
    md = io.StringIO()
    w = md.write
    w("# parlaplay platform backlog\n\n")
    w("Built from `docs/spec.md` (the parlaplay platform spec, v0.2). Generated by "
      "`planning/backlog.py`; edit that file, not this one.\n\n")
    w(f"**{len(cards)} cards, {total} points.** Cards marked *waits on others* depend on someone "
      "outside the build, so start them first. Shéi's own game work (its spec's milestones 1 to 4) "
      "is in the Shéi backlog, not here.\n\n")
    w("## Sprints\n\n| Sprint | Dates | Points | Goal |\n|---|---|---|---|\n")
    for key, title, first, last, due, goal in SPRINTS:
        pts = sum(c["points"] for c in cards if first <= c["day"] <= last)
        w(f"| {title} | {DAYS[first][0]} to {DAYS[last][0]} | {pts} | {goal} |\n")
    w("\n## Epics\n\n| Epic | Cards | Points |\n|---|---|---|\n")
    for key, name in EPICS:
        cs = [c for c in cards if c["epic"] == key]
        w(f"| {name} | {len(cs)} | {sum(c['points'] for c in cs)} |\n")
    for key, title, first, last, due, goal in SPRINTS:
        w(f"\n## {title} ({DAYS[first][0]} to {DAYS[last][0]})\n\nGoal: {goal}\n")
        for day in sorted(d for d in DAYS if first <= d <= last):
            cs = [c for c in cards if c["day"] == day]
            if not cs:
                continue
            w(f"\n### Day {day}, {DAYS[day][0]} ({load[day]} pts, {DAYS[day][2]} day)\n")
            for c in cs:
                waits = " *(waits on others)*" if c["waits"] else ""
                pt = "pt" if c["points"] == 1 else "pts"
                w(f"\n#### {c['id']} {c['title']}{waits}\n\n")
                w(f"{epic_name[c['epic']]} · {c['type']} · {c['points']} {pt} · spec {', '.join(c['refs'])}")
                if c["deps"]:
                    w(f" · depends on {', '.join(c['deps'])}")
                w(f"\n\n{c['desc']}\n\n")
                for a in c["ac"]:
                    w(f"- [ ] {a}\n")
    w("\n## Definition of done mapping\n\n| Spec 10.3 item | Cards |\n|---|---|\n")
    for item, refs in DOD:
        w(f"| {item} | {', '.join(refs)} |\n")
    open(os.path.join(HERE, "backlog.md"), "w", encoding="utf-8").write(md.getvalue())

    with open(os.path.join(HERE, "backlog.csv"), "w", encoding="utf-8", newline="") as f:
        out = csv.writer(f)
        out.writerow(["ID", "Title", "Status", "Epic", "Type", "Sprint", "Day", "Date", "Story points",
                      "Depends on", "Waits on others", "Spec refs", "Description",
                      "Acceptance criteria"])
        for c in cards:
            out.writerow([c["id"], c["title"], "To do", epic_name[c["epic"]], c["type"],
                          sprint_of(c["day"])[1], f"Day {c['day']}", DAYS[c["day"]][0], c["points"],
                          ", ".join(c["deps"]), "yes" if c["waits"] else "no", ", ".join(c["refs"]),
                          c["desc"], "\n".join(c["ac"])])

    labels = [{"name": f"type: {t}", "color": col, "description": f"Backlog card type: {t}"}
              for t, col in TYPE_COLORS.items()]
    labels += [{"name": "waits on others", "color": "cf3a24",
                "description": "Depends on someone outside the build. Start early."},
               {"name": "epic", "color": "3d2c8d", "description": "Parent issue grouping related backlog cards"}]
    labels += [{"name": f"epic: {n}", "color": COLORS[i % len(COLORS)],
                "description": f"Card belongs to the {n} epic"} for i, (_, n) in enumerate(EPICS)]
    milestones = [{"key": k, "title": t, "description": f"{DAYS[a][0]} to {DAYS[b][0]}. Goal: {g}",
                   "due_on": f"{due}T23:59:59Z"} for k, t, a, b, due, g in SPRINTS]
    epics = []
    for key, name in EPICS:
        cs = [c for c in cards if c["epic"] == key]
        epics.append({"key": key, "title": f"Epic: {name}",
                      "body": f"Epic for the parlaplay platform. {len(cs)} cards, "
                              f"{sum(c['points'] for c in cs)} story points.\n\nThe cards are attached "
                              f"as sub-issues below. Full backlog: [backlog.md]({BACKLOG_URL}).",
                      "labels": ["epic", f"epic: {name}"]})
    issue_cards = []
    for c in cards:
        s = sprint_of(c["day"])
        pt = "point" if c["points"] == 1 else "points"
        body = f"**{s[1]}** · Day {c['day']}, {DAYS[c['day']][0]} · **{c['points']} {pt}** · {c['type']}\n"
        body += f"Epic: {{{{{c['epic']}}}}}\n\n"
        if c["waits"]:
            body += "> [!NOTE]\n> Waits on someone outside the build. Start it early and chase it.\n\n"
        body += c["desc"] + "\n\n### Acceptance criteria\n\n"
        body += "".join(f"- [ ] {a}\n" for a in c["ac"])
        if c["deps"]:
            body += "\n### Depends on\n\n" + "".join(f"- {{{{{d}}}}}\n" for d in c["deps"])
        body += "\n### Spec\n\n" + " · ".join(ref_link(r) for r in c["refs"])
        issue_cards.append({
            "key": c["id"], "title": f"{c['id']} {c['title']}", "body": body,
            "labels": [f"type: {c['type']}", f"epic: {epic_name[c['epic']]}"]
                      + (["waits on others"] if c["waits"] else []),
            "milestone": s[0], "epic": c["epic"], "deps": c["deps"], "points": c["points"],
            "target_date": DAYS[c["day"]][1]})
    data = {"repo": REPO, "owner": REPO.split("/")[0], "project_title": "parlaplay platform",
            "labels": labels, "milestones": milestones, "epics": epics, "cards": issue_cards}
    with open(os.path.join(HERE, "issues.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    return total


if __name__ == "__main__":
    problems, notes, load = validate()
    if problems:
        print("Backlog problems, nothing written:")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    total = write_outputs(load)
    print(f"{len(cards)} cards, {total} points; wrote backlog.md, backlog.csv, issues.json")
    print("Points per day:", ", ".join(f"d{d}={p}" for d, p in sorted(load.items())))
    for n in notes:
        print("  note:", n)
    # final em dash check on the written files
    for name in ("backlog.md", "backlog.csv", "issues.json"):
        if "\u2014" in open(os.path.join(HERE, name), encoding="utf-8").read():
            print(f"  em dash found in {name}")
            sys.exit(1)
