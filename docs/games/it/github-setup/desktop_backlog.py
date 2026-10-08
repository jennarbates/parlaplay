"""The Desktop epic (spec-desktop.md): one data source for its backlog cards.

Run from the repo root:  python3 github-setup/desktop_backlog.py
It writes the Desktop cards into backlog.md, backlog.csv and github-setup/issues.json,
recomputes the day, sprint and epic point totals, then validates the whole backlog.
Re-running replaces the Desktop cards in place, so the three files never drift apart.
"""
import csv, io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = "spec-desktop.md"
EPIC, EPIC_KEY, EPIC_LABEL = "Desktop", "E11", "epic: Desktop"
REPO_URL = "https://github.com/jennarbates/Italian/blob/main/"

# Day number -> (sprint, milestone key, day label, date label, ISO date), from backlog.md.
DAYS = {
    1: ("Sprint 1: Foundations", "S1", "Day 1", "Wed Oct 7", "2026-10-07"),
    3: ("Sprint 1: Foundations", "S1", "Day 3", "Fri Oct 9", "2026-10-09"),
    4: ("Sprint 2: Playable round", "S2", "Day 4", "Mon Oct 12", "2026-10-12"),
    5: ("Sprint 2: Playable round", "S2", "Day 5", "Tue Oct 13", "2026-10-13"),
    6: ("Sprint 2: Playable round", "S2", "Day 6", "Wed Oct 14", "2026-10-14"),
    7: ("Sprint 2: Playable round", "S2", "Day 7", "Thu Oct 15", "2026-10-15"),
    8: ("Sprint 2: Playable round", "S2", "Day 8", "Fri Oct 16", "2026-10-16"),
    9: ("Sprint 3: Progress, sync, playtest", "S3", "Day 9", "Mon Oct 19", "2026-10-19"),
    10: ("Sprint 3: Progress, sync, playtest", "S3", "Day 10", "Tue Oct 20", "2026-10-20"),
    11: ("Sprint 3: Progress, sync, playtest", "S3", "Day 11", "Wed Oct 21", "2026-10-21"),
}

# id, title, type, points, day, depends on, waits on others, spec refs, description, acceptance criteria
CARDS = [
    ("CHI-116", "Request developer review of the desktop spec", "task", 1, 1, [], True,
     ["DS 13.1", "DS 4", "DS 6", "DS 8"],
     "Send DS 4, DS 6 and DS 8 of spec-desktop.md to the developer reviewer.",
     ["DS 4, DS 6 and DS 8 sent with a return date of Fri Oct 9",
      "Comments collected in one place"]),
    ("CHI-117", "Ask playtesters to play one round on a laptop", "task", 1, 1, [], True,
     ["DS 13.2", "DD13"],
     "Ask the MVP playtesters booked for Thu Oct 22 to bring a laptop for one extra round.",
     ["At least 2 playtesters confirm they can play one round on a laptop",
      "Each knows whether they will use a mouse or a trackpad"]),
    ("CHI-118", "Paper-trace a desktop round and tag spec v1", "spike", 2, 3, ["CHI-116"], False,
     ["DS 13.1", "DS 2.1"],
     "Trace the DS 2.1 round by keyboard and by mouse using only the spec, fold in the review, tag v1.",
     ["DS 2.1 traced twice, once by keyboard and once by mouse",
      "Every guess logged as a fix or a TBD",
      "Every TBD resolved or moved to DS 14.1",
      "spec-desktop.md tagged v1"]),
    ("CHI-119", "Build the desktop app shell and breakpoint", "task", 2, 4, ["CHI-118"], False,
     ["DS 5", "DD1", "DD5", "DD11"],
     "useIsDesktop(), a full-width shell at lg with DesktopNav on every screen but Game.",
     ["useIsDesktop() is true at 1024px wide and above, false below, and re-renders on resize",
      "DesktopNav shows Chi è?, Play (or Continue), Progress, Settings and the account on every screen except /play",
      "The current route's link has aria-current=\"page\"",
      "Below 1024px every screen looks exactly as before"]),
    ("CHI-120", "Lay out the game as a 6 × 4 board and side panel", "story", 5, 5, ["CHI-119"], False,
     ["DS 6", "DS 2.2", "DD2", "DD3", "DD4"],
     "As a learner at a laptop, I see the board large on the left and the questions beside it.",
     ["At 1024 × 640 all 24 cards and the whole panel are visible with no page scroll",
      "The panel is aside[aria-label=\"Questions\"] built from sheetFor(), with no collapse toggle",
      "Card positions do not change between playerTurn and playerReview",
      "Resizing across 1024px mid-round keeps flipped cards, a guess in progress and a half-built Level 2 question",
      "Card names scale between 10px and 16px with the card"]),
    ("CHI-121", "Add the hover preview and right-click detail", "story", 3, 6, ["CHI-120"], False,
     ["DS 7", "DD6"],
     "As a learner with a mouse, I see a face up close by hovering, and open its details by right-clicking.",
     ["The preview appears after 350 ms on a card, only at lg with (hover: hover) and (pointer: fine)",
      "The preview never shows while guessing or with a dialog open, and never covers the hovered card",
      "Right-click or the context menu key on a card opens CardDetail; other elements keep the browser menu",
      "No layout shift on hover; no fade under prefers-reduced-motion"]),
    ("CHI-122", "Adapt round end and dialogs for desktop", "task", 2, 6, ["CHI-119"], False,
     ["DS 9.2", "DS 9.6"],
     "Two-column round end with an unfixed action bar; SignInSheet as a centred modal; dialog widths from DS 9.6.",
     ["Round end is two columns at lg and Play again has focus when it appears",
      "SignInSheet is a centred 28rem modal at lg and a bottom sheet below",
      "Every dialog closes on Esc and on a backdrop click and returns focus to its opener"]),
    ("CHI-123", "Add keyboard shortcuts and the board grid", "story", 5, 7, ["CHI-120"], False,
     ["DS 4", "DS 8", "DD7", "DD8", "DD9", "DD14"],
     "As a learner at a keyboard, I play a whole round without the mouse.",
     ["keyToAction() returns exactly what the DS 4.2 table says for every cell, checked by unit tests",
      "Keys are ignored with Ctrl, Cmd or Alt held, in inputs, and with a dialog open",
      "The board is an ARIA grid with one tab stop; arrows, Home, End, Ctrl+Home and Ctrl+End move focus",
      "? and the GameMenu item open the Keyboard shortcuts dialog",
      "GameMenu closes on Esc and on an outside click"]),
    ("CHI-124", "Lay out Home, Settings and Privacy for desktop", "story", 3, 8, ["CHI-119"], False,
     ["DS 9.1", "DS 9.4", "DS 9.5"],
     "Two-column Home, row-based Settings and a prose-width Privacy page at lg.",
     ["Home is two columns at lg with the level cards and Play on the right",
      "Settings rows are label and description left, control right, under Game, Account and About",
      "Privacy is one max-w-prose column with a Back to Settings link",
      "No horizontal scroll at 1024; phone layouts unchanged"]),
    ("CHI-125", "Build the Progress dashboard", "story", 3, 9, ["CHI-119"], False,
     ["DS 9.3", "DS 3", "DD10"],
     "As a learner at a laptop, I see my totals and both word lists at once.",
     ["At lg there is no tablist and Mistakes and Due show side by side",
      "Tiles read Words seen, Due today, Mistakes this week and Rounds played",
      "progressStats() matches the DS 3 definitions and invariants, checked by unit tests",
      "With no data the empty message shows once, full width, with no tiles"]),
    ("CHI-126", "Add desktop Playwright projects and specs", "test", 3, 10,
     ["CHI-120", "CHI-121", "CHI-122", "CHI-123", "CHI-124", "CHI-125"], False,
     ["DS 13.2", "DS 13.3"],
     "desktop-chromium and desktop-webkit projects at 1440 × 900 and e2e/desktop.spec.ts with every DS 13.3 case.",
     ["Every DS 13.3 case is a passing test on both desktop projects",
      "Phone-only specs skip on desktop projects; phone specs pass without edits",
      "a11y.spec.ts passes on the desktop projects",
      "CI runs all four projects green"]),
    ("CHI-127", "Run the desktop manual laptop pass", "test", 2, 11, ["CHI-126"], False,
     ["DS 13.4"],
     "The DS 13.4 checks on a MacBook and a Windows laptop, before the playtest build.",
     ["A full round by mouse and by keyboard in Chrome and Safari on a MacBook at 1280 and 1440",
      "The same plus right-click detail in Edge and Firefox on Windows at 1920 × 1080",
      "Window dragged across 1024px mid-round loses nothing",
      "Results logged in the playtest findings doc"]),
]

DOD = [  # DS 13.5 item -> cards
    ("spec-desktop.md reviewed and tagged v1", ["CHI-116", "CHI-118"]),
    ("A full round plays by mouse only and by keyboard only at 1024 × 640 and 1440 × 900", ["CHI-121", "CHI-123", "CHI-126"]),
    ("At 1024 × 640 the 24 cards and the whole panel fit with no scroll", ["CHI-120", "CHI-126"]),
    ("No horizontal scroll on any screen at 1024 and 1440", ["CHI-122", "CHI-124", "CHI-125", "CHI-126"]),
    ("The hover preview and right-click detail work; neither shows on touch", ["CHI-121"]),
    ("Resizing across 1024px mid-round loses nothing", ["CHI-120", "CHI-126"]),
    ("The phone layout is unchanged; all existing phone e2e tests pass without edits", ["CHI-119", "CHI-126"]),
    ("Desktop Playwright projects green in CI; axe clean at desktop size", ["CHI-126"]),
    ("The manual checks in DS 13.4 are done and logged", ["CHI-127"]),
    ("At least 2 playtesters have played one round on a laptop; findings logged with the rest", ["CHI-117", "CHI-103"]),
]

# Spec sections with a deliverable; each needs at least one card.
DELIVERABLE_SECTIONS = ["DS 2", "DS 3", "DS 4", "DS 5", "DS 6", "DS 7", "DS 8", "DS 9", "DS 13"]

DASH = "—"
problems = []


def p(path):
    return os.path.join(ROOT, path)


def anchors():
    """Map 'DS 4' / 'DS 13.1' to GitHub heading anchors in the spec."""
    out = {}
    for line in open(p(SPEC), encoding="utf-8"):
        m = re.match(r"#{2,3} (DS [\d.]+)\.? (.*)", line.strip())
        if m:
            text = (m.group(1) + " " + m.group(2)).lower()
            slug = re.sub(r"[^\w\- ]", "", text).replace(" ", "-")
            out[m.group(1).rstrip(".")] = slug
    return out


def spec_links(refs, anc):
    parts = []
    for r in refs:
        if r in anc:
            parts.append(f"[{r}]({REPO_URL}{SPEC}#{anc[r]})")
        elif r.startswith("DD"):
            parts.append(f"[{r}]({REPO_URL}{SPEC}#{anc['DS 14.2']})")
        else:
            problems.append(f"spec ref {r} has no heading in {SPEC}")
            parts.append(r)
    return " · ".join(parts)


def card_md(c):
    k, t, ty, pts, day, deps, waits, refs, desc, ac = c
    head = f"#### {k} {t}" + (" *(waits on others)*" if waits else "")
    meta = f"{EPIC} · {ty} · {pts} pt{'s' if pts != 1 else ''} · {', '.join(refs)}"
    if deps:
        meta += f" · depends on {', '.join(deps)}"
    return f"{head}\n\n{meta}\n\n{desc}\n\n" + "\n".join(f"- [ ] {a}" for a in ac) + "\n"


def write_md():
    md = open(p("backlog.md"), encoding="utf-8").read()
    # Drop Desktop cards from an earlier run.
    md = re.sub(rf"#### CHI-\d+ [^\n]*\n\n{EPIC} · .*?(?=\n#### |\n### |\n## )\n?", "", md, flags=re.S)
    md = re.sub(r"\n## Desktop definition of done \(DS 13\.5\) mapped to cards\n.*?(?=\n## |\Z)", "\n", md, flags=re.S)
    for day in sorted(DAYS):
        cards = [c for c in CARDS if c[4] == day]
        if not cards:
            continue
        label = DAYS[day][2]
        m = re.search(rf"^### {re.escape(label)},[^\n]*\n", md, flags=re.M)
        if not m:
            problems.append(f"backlog.md has no heading for {label}")
            continue
        nxt = re.search(r"^#{2,3} ", md[m.end():], flags=re.M)
        end = m.end() + nxt.start() if nxt else len(md)
        block = md[:end].rstrip("\n") + "\n\n" + "\n".join(card_md(c) for c in cards) + "\n"
        md = block + md[end:]
    open(p("backlog.md"), "w", encoding="utf-8").write(md)


def write_csv():
    with open(p("backlog.csv"), encoding="utf-8", newline="") as f:
        fields, *raw = list(csv.reader(f))
    rows = []
    for r in raw:
        if len(r) > len(fields):
            # An unquoted comma in the acceptance criteria split the field; join it back.
            extra = len(r) - len(fields)
            r = r[:13] + [",".join(r[13:14 + extra])] + r[14 + extra:]
            print(f"Fixed an unquoted comma in {r[0]}'s acceptance criteria")
        rows.append(dict(zip(fields, r)))
    rows = [r for r in rows if r["Epic"] != EPIC]
    for k, t, ty, pts, day, deps, waits, refs, desc, ac in CARDS:
        sprint, _, dlabel, date, _ = DAYS[day]
        body = desc + "\n\nAcceptance criteria:\n" + "\n".join("- " + a for a in ac) + "\n\nSpec: " + ", ".join(refs)
        rows.append(dict(zip(fields, [k, t, "To do", EPIC, ty, sprint, dlabel, date, str(pts), ", ".join(deps),
                                      "yes" if waits else "", ", ".join(refs), body, " | ".join(ac),
                                      f"{EPIC},{ty}" + (",waits-on-others" if waits else "")])))
    rows.sort(key=lambda r: int(r["ID"].split("-")[1]))
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, lineterminator="\r\n")  # matches the original file
    w.writeheader()
    w.writerows(rows)
    open(p("backlog.csv"), "w", encoding="utf-8", newline="").write(buf.getvalue())
    return rows


def write_issues(anc):
    path = p("github-setup/issues.json")
    j = json.load(open(path, encoding="utf-8"))
    titles = {c["key"]: c["title"].split(" ", 1)[1] for c in j["cards"]}
    titles.update({c[0]: c[1] for c in CARDS})
    if not any(l["name"] == EPIC_LABEL for l in j["labels"]):
        j["labels"].append({"name": EPIC_LABEL, "color": "0e8a16", "description": "Backlog epic: Desktop"})
    pts = sum(c[3] for c in CARDS)
    j["epics"] = [e for e in j["epics"] if e["key"] != EPIC_KEY] + [{
        "key": EPIC_KEY, "title": f"Epic: {EPIC}",
        "body": f"Epic for the Chi è? desktop layout. {len(CARDS)} cards, {pts} story points.\n\n"
                f"Spec: [{SPEC}]({REPO_URL}{SPEC}). The cards are attached as sub-issues below. "
                f"Full backlog: [backlog.md]({REPO_URL}backlog.md).",
        "labels": ["epic", EPIC_LABEL]}]
    j["cards"] = [c for c in j["cards"] if c.get("epic") != EPIC_KEY]
    for k, t, ty, pts, day, deps, waits, refs, desc, ac in CARDS:
        sprint, ms, dlabel, date, iso = DAYS[day]
        body = f"**{sprint}** · {dlabel}, {date} · **{pts} points** · {ty}\nEpic: {{{{{EPIC_KEY}}}}}\n\n"
        if waits:
            body += "> [!NOTE]\n> Waits on someone outside the build. Start it early and chase it.\n\n"
        body += desc + "\n\n### Acceptance criteria\n\n" + "\n".join("- [ ] " + a for a in ac)
        if deps:
            body += "\n\n### Depends on\n\n" + "\n".join(f"- {{{{{d}}}}} {titles[d]}" for d in deps)
        body += "\n\n### Spec\n\n" + spec_links(refs, anc)
        labels = [f"type: {ty}", EPIC_LABEL] + (["waits on others"] if waits else [])
        j["cards"].append({"key": k, "title": f"{k} {t}", "body": body, "labels": labels, "milestone": ms,
                           "epic": EPIC_KEY, "deps": deps, "points": pts, "target_date": iso})
    with open(path, "w", encoding="utf-8") as f:
        json.dump(j, f, indent=1, ensure_ascii=False)
        f.write("\n")


def day_num(label):
    return int(re.search(r"\d+", label).group())


def recompute_totals(rows):
    md = open(p("backlog.md"), encoding="utf-8").read()
    by_day, by_sprint, by_epic = {}, {}, {}
    for r in rows:
        n = int(r["Story points"])
        by_day[r["Day"]] = by_day.get(r["Day"], 0) + n
        by_sprint[r["Sprint"]] = by_sprint.get(r["Sprint"], 0) + n
        e = by_epic.setdefault(r["Epic"], [0, 0])
        e[0] += 1
        e[1] += n
    total = sum(int(r["Story points"]) for r in rows)
    md = re.sub(r"\*\*\d+ cards, \d+ points\.\*\*", f"**{len(rows)} cards, {total} points.**", md)

    def day_head(m):
        n = by_day.get(m.group(2), 0)
        return f"### {m.group(2)}{m.group(3)} ({n} pt{'s' if n != 1 else ''})"
    md = re.sub(r"^### ((Days? [\d to]+?))(, [^\n(]+) \(\d+ pts?\)", day_head, md, flags=re.M)
    for s, n in by_sprint.items():
        md = re.sub(rf"^(\| {re.escape(s)} \| [^|]+ \| )\d+( \|)", rf"\g<1>{n}\2", md, flags=re.M)
    for e, (cnt, n) in by_epic.items():
        if re.search(rf"^\| {re.escape(e)} \| \d+ \| \d+ \|$", md, flags=re.M):
            md = re.sub(rf"^\| {re.escape(e)} \| \d+ \| \d+ \|$", f"| {e} | {cnt} | {n} |", md, flags=re.M)
        else:
            md = re.sub(r"(^\| Launch \| \d+ \| \d+ \|$)", rf"\1\n| {e} | {cnt} | {n} |", md, flags=re.M)
    table = "\n## Desktop definition of done (DS 13.5) mapped to cards\n\n| Item | Cards |\n|---|---|\n"
    table += "\n".join(f"| {item} | {', '.join(cards)} |" for item, cards in DOD) + "\n"
    md = md.rstrip("\n") + "\n" + table
    open(p("backlog.md"), "w", encoding="utf-8").write(md)
    return by_day, by_sprint


def validate(rows, by_day, by_sprint):
    ids = [r["ID"] for r in rows]
    if len(ids) != len(set(ids)):
        problems.append("duplicate ids: " + ", ".join(sorted({i for i in ids if ids.count(i) > 1})))
    byid = {r["ID"]: r for r in rows}
    graph = {}
    for r in rows:
        deps = [d.strip() for d in r["Depends on"].split(",") if d.strip()]
        graph[r["ID"]] = deps
        for d in deps:
            if d not in byid:
                problems.append(f"{r['ID']} depends on missing {d}")
            elif day_num(byid[d]["Day"]) > day_num(r["Day"]):
                problems.append(f"{r['ID']} ({r['Day']}) is scheduled before its dependency {d} ({byid[d]['Day']})")
    seen, stack = set(), set()

    def visit(n):
        if n in stack:
            problems.append(f"dependency cycle through {n}")
            return
        if n in seen:
            return
        stack.add(n)
        for d in graph.get(n, []):
            visit(d)
        stack.discard(n)
        seen.add(n)
    for n in graph:
        visit(n)
    for item, cards in DOD:
        for c in cards:
            if c not in byid:
                problems.append(f"DoD item '{item}' maps to missing {c}")
    desktop_refs = " ".join(", ".join(c[7]) for c in CARDS)
    for s in DELIVERABLE_SECTIONS:
        if not re.search(rf"{re.escape(s)}(\.|\b)", desktop_refs):
            problems.append(f"{s} has no card")
    for f in ["backlog.md", "backlog.csv", "github-setup/issues.json", SPEC]:
        if DASH in open(p(f), encoding="utf-8").read():
            problems.append(f"em dash in {f}")
    avg = sum(by_day.values()) / len(by_day)
    print(f"Desktop: {len(CARDS)} cards, {sum(c[3] for c in CARDS)} points")
    print("Points per day (all epics, planned):")
    for d in sorted(by_day, key=day_num):
        desk = sum(c[3] for c in CARDS if DAYS[c[4]][2] == d)
        flag = "  <- well above average" if by_day[d] > 1.6 * avg else ""
        print(f"  {d:<14} {by_day[d]:>3}  (desktop {desk}){flag}")
    print(f"  average {avg:.1f}")
    print("Points per sprint:", ", ".join(f"{s}: {n}" for s, n in by_sprint.items()))


if __name__ == "__main__":
    anc = anchors()
    write_md()
    rows = write_csv()
    write_issues(anc)
    by_day, by_sprint = recompute_totals(rows)
    validate(rows, by_day, by_sprint)
    if problems:
        print("\nProblems:")
        for x in problems:
            print("  - " + x)
        sys.exit(1)
    print("\nAll checks passed.")
