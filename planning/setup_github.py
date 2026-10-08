#!/usr/bin/env python3
"""Creates the parlaplay platform backlog on GitHub: labels, sprint milestones, epic issues,
card issues (as sub-issues of their epic, with blocked-by links), and a Project with
Points, Target date and Status filled in.

Run from anywhere:  python3 planning/setup_github.py

Safe to re-run. It also updates the issue (title, body, labels, milestone), the
blocked-by links and the project fields of any card changed in backlog.py since.
Progress is saved in planning/state.json, so if something fails
partway, fix the problem and run it again; it skips everything already done.
Needs the GitHub CLI (gh), signed in with the "project" scope.
"""
import hashlib
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = json.load(open(os.path.join(HERE, "issues.json"), encoding="utf-8"))
REPO = DATA["repo"]
OWNER = DATA["owner"]
STATE_PATH = os.path.join(HERE, "state.json")

state = {"labels": [], "milestones": {}, "issues": {}, "subissues": [], "blocked": [], "sent": {},
         "blocked_unsupported": False, "project": None, "fields": {}, "items": {}, "edited": []}
if os.path.exists(STATE_PATH):
    state.update(json.load(open(STATE_PATH, encoding="utf-8")))


def save():
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=1, ensure_ascii=False)


class GhError(Exception):
    pass


def gh(args, body=None, pause=0.0):
    """Run a gh command. Returns parsed JSON when the output is JSON, else the text.
    Waits and retries when GitHub asks us to slow down."""
    for attempt in range(6):
        proc = subprocess.run(["gh"] + args,
                              input=json.dumps(body) if body is not None else None,
                              capture_output=True, text=True)
        if proc.returncode == 0:
            if pause:
                time.sleep(pause)
            out = proc.stdout.strip()
            if not out:
                return {}
            try:
                return json.loads(out)
            except ValueError:
                return out
        err = (proc.stderr + proc.stdout).strip()
        low = err.lower()
        if "rate limit" in low or "abuse" in low or "secondary" in low:
            print("   GitHub asked us to slow down. Waiting 60 seconds, then retrying...")
            time.sleep(60)
            continue
        if "http 502" in low or "http 503" in low or "timeout" in low:
            time.sleep(5 * (attempt + 1))
            continue
        raise GhError(err)
    raise GhError("gave up after repeated rate limits: " + " ".join(args[:3]))


def api(method, path, body=None, pause=0.0):
    args = ["api", "--method", method, path]
    if body is not None:
        args += ["--input", "-"]
    return gh(args, body, pause)


def _friendly(exc_type, exc, tb):
    if exc_type is GhError:
        print("\n!! GitHub returned an error:\n   " + str(exc).replace("\n", "\n   "))
        print("\nNothing is lost: progress is saved in planning/state.json.")
        print("Fix the problem above if it is clear, then run the same command again to continue.")
        sys.exit(1)
    sys.__excepthook__(exc_type, exc, tb)


sys.excepthook = _friendly


def step(title):
    print("\n== " + title)


# preflight
step("Checking GitHub access")
try:
    gh(["--version"])
except FileNotFoundError:
    sys.exit("The GitHub CLI (gh) is not installed. Install it, then run this again.")
try:
    perms = api("GET", "repos/" + REPO).get("permissions", {})
except GhError as e:
    sys.exit("Could not open " + REPO + ". Is gh signed in to the right account?\n" + str(e))
if not perms.get("push"):
    sys.exit("The account gh is signed in as cannot push to " + REPO + ". "
             "Sign in with an account that has write access (gh auth login).")
try:
    gh(["project", "list", "--owner", OWNER, "--format", "json", "--limit", "1"])
except GhError as e:
    sys.exit("gh cannot read Projects yet. Run:  gh auth refresh -s project\n"
             "then run this script again.\n" + str(e))
print("   OK: write access to " + REPO + " and Projects access for " + OWNER)

# labels
step("Labels")
for lab in DATA["labels"]:
    if lab["name"] in state["labels"]:
        continue
    gh(["label", "create", lab["name"], "--repo", REPO, "--color", lab["color"],
        "--description", lab["description"], "--force"])
    state["labels"].append(lab["name"])
    save()
    print("   " + lab["name"])

# milestones
step("Sprint milestones")
existing = {m["title"]: m["number"] for m in
            api("GET", "repos/" + REPO + "/milestones?state=all&per_page=100")}
for m in DATA["milestones"]:
    if m["key"] in state["milestones"]:
        continue
    if m["title"] in existing:
        state["milestones"][m["key"]] = existing[m["title"]]
    else:
        made = api("POST", "repos/" + REPO + "/milestones",
                   {"title": m["title"], "description": m["description"], "due_on": m["due_on"]})
        state["milestones"][m["key"]] = made["number"]
    save()
    print("   " + m["title"])


# issues
def fill(body):
    for key, info in state["issues"].items():
        body = body.replace("{{" + key + "}}", "#" + str(info["number"]))
    return body


def create_issue(item, milestone=None):
    if item["key"] in state["issues"]:
        return
    payload = {"title": item["title"], "body": fill(item["body"]), "labels": item["labels"]}
    if milestone:
        payload["milestone"] = milestone
    made = api("POST", "repos/" + REPO + "/issues", payload, pause=1.0)
    state["issues"][item["key"]] = {"number": made["number"], "id": made["id"],
                                    "url": made["html_url"]}
    save()
    print("   #" + str(made["number"]) + "  " + item["title"])


step("Epic issues (" + str(len(DATA["epics"])) + ")")
for e in DATA["epics"]:
    create_issue(e)

step("Backlog issues (" + str(len(DATA["cards"])) + "). This takes a few minutes.")
for c in DATA["cards"]:
    create_issue(c, state["milestones"][c["milestone"]])

# updates: a card edited in backlog.py after its issue was made
step("Updating issues whose card changed")


def desired(c):
    want = {"title": c["title"], "body": fill(c["body"]), "labels": sorted(c["labels"])}
    if "milestone" in c:  # cards only; epics have none
        want["milestone"] = state["milestones"][c["milestone"]]
    return want


def digest(d):
    return hashlib.sha256(json.dumps(d, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


changed = 0
for c in DATA["epics"] + DATA["cards"]:
    want = desired(c)
    if state["sent"].get(c["key"]) == digest(want):
        continue
    num = str(state["issues"][c["key"]]["number"])
    have = api("GET", "repos/" + REPO + "/issues/" + num)
    have_labels = [lab["name"] for lab in have.get("labels", [])]
    patch = {}
    if have.get("title") != want["title"]:
        patch["title"] = want["title"]
    if (have.get("body") or "") != want["body"]:
        patch["body"] = want["body"]
    if "milestone" in want and (have.get("milestone") or {}).get("number") != want["milestone"]:
        patch["milestone"] = want["milestone"]
    # Replace only the backlog's own labels; keep any added by hand (bug, and so on).
    ours = lambda n: n.startswith(("type: ", "epic")) or n == "waits on others"
    labels = sorted([n for n in have_labels if not ours(n)] + want["labels"])
    if sorted(have_labels) != labels:
        patch["labels"] = labels
    if patch:
        api("PATCH", "repos/" + REPO + "/issues/" + num, patch, pause=1.0)
        changed += 1
        print("   #" + num + "  " + c["title"] + "  (" + ", ".join(sorted(patch)) + ")")
    state["sent"][c["key"]] = digest(want)
    save()
print("   done" + ("" if changed else ": nothing changed"))

# sub-issues
step("Attaching cards to their epics as sub-issues")
skipped_sub = 0
for c in DATA["cards"]:
    if c["key"] in state["subissues"]:
        continue
    parent = state["issues"][c["epic"]]["number"]
    child = state["issues"][c["key"]]["id"]
    try:
        api("POST", "repos/" + REPO + "/issues/" + str(parent) + "/sub_issues",
            {"sub_issue_id": child}, pause=0.5)
    except GhError as e:
        if "already" not in str(e).lower():
            skipped_sub += 1
            print("   could not attach " + c["key"] + ": " + str(e).splitlines()[0])
            continue
    state["subissues"].append(c["key"])
    save()
print("   done" + ("" if not skipped_sub else " (" + str(skipped_sub) + " skipped, see above)"))

# blocked-by
step("Removing blocked-by links no longer in the backlog")
wanted = {c["key"] + "<" + d for c in DATA["cards"] for d in c["deps"]}
for pair in [p for p in state["blocked"] if p not in wanted]:
    key, dep = pair.split("<")
    num = str(state["issues"][key]["number"])
    try:
        api("DELETE", "repos/" + REPO + "/issues/" + num + "/dependencies/blocked_by/"
            + str(state["issues"][dep]["id"]), pause=0.5)
    except GhError as e:
        if "404" not in str(e) and "not found" not in str(e).lower():
            raise
    state["blocked"].remove(pair)
    save()
    print("   removed " + pair)
print("   done")

step("Adding blocked-by links")
if state["blocked_unsupported"]:
    print("   skipped: this repo does not support issue dependencies; each issue lists them instead")
else:
    for c in DATA["cards"]:
        for dep in c["deps"]:
            pair = c["key"] + "<" + dep
            if pair in state["blocked"]:
                continue
            num = state["issues"][c["key"]]["number"]
            try:
                api("POST", "repos/" + REPO + "/issues/" + str(num) + "/dependencies/blocked_by",
                    {"issue_id": state["issues"][dep]["id"]}, pause=0.5)
            except GhError as e:
                msg = str(e).lower()
                if "already" in msg:
                    pass
                elif "404" in msg or "not found" in msg:
                    state["blocked_unsupported"] = True
                    save()
                    print("   issue dependencies are not available here; each issue's "
                          "'Depends on' section still links them")
                    break
                else:
                    print("   could not link " + pair + ": " + str(e).splitlines()[0])
                    continue
            state["blocked"].append(pair)
            save()
        if state["blocked_unsupported"]:
            break
    print("   done")

# project
step("Project board")
if not state["project"]:
    proj = gh(["project", "create", "--owner", OWNER, "--title", DATA["project_title"],
               "--format", "json"])
    state["project"] = {"number": proj["number"], "id": proj["id"], "url": proj.get("url", "")}
    save()
    print("   created: " + state["project"]["url"])
    try:
        gh(["project", "link", str(proj["number"]), "--owner", OWNER, "--repo", REPO])
    except GhError as e:
        print("   could not link the project to the repo (optional): " + str(e).splitlines()[0])
PNUM = str(state["project"]["number"])
PID = state["project"]["id"]


def field_map():
    fl = gh(["project", "field-list", PNUM, "--owner", OWNER, "--format", "json", "--limit", "100"])
    return {f["name"]: f for f in fl.get("fields", [])}


fields = field_map()
for name, kind in (("Points", "NUMBER"), ("Target date", "DATE")):
    if name not in fields:
        gh(["project", "field-create", PNUM, "--owner", OWNER, "--name", name, "--data-type", kind])
        print("   added field: " + name)
fields = field_map()
status = fields.get("Status", {})
todo_option = next((o["id"] for o in status.get("options", []) if o["name"].lower() == "todo"), None)

step("Adding issues to the project and filling Points, Target date, Status")
for c in DATA["cards"]:
    key = c["key"]
    if key not in state["items"]:
        item = gh(["project", "item-add", PNUM, "--owner", OWNER,
                   "--url", state["issues"][key]["url"], "--format", "json"], pause=0.3)
        state["items"][key] = item["id"]
        save()
    fields_now = [c["points"], c["target_date"]]
    # Cards set before fields were recorded are set once more, so a changed one is caught.
    if key in state["edited"] and state["fields"].get(key) == fields_now:
        continue
    iid = state["items"][key]
    base = ["project", "item-edit", "--id", iid, "--project-id", PID]
    gh(base + ["--field-id", fields["Points"]["id"], "--number", str(c["points"])], pause=0.3)
    if c["target_date"]:  # unscheduled sprints have no date yet
        gh(base + ["--field-id", fields["Target date"]["id"], "--date", c["target_date"]], pause=0.3)
    if todo_option:
        gh(base + ["--field-id", status["id"], "--single-select-option-id", todo_option], pause=0.3)
    if key not in state["edited"]:
        state["edited"].append(key)
    state["fields"][key] = fields_now
    save()
    print("   " + key)

step("All done")
print("Project: " + state["project"]["url"])
print("Issues:  https://github.com/" + REPO + "/issues")
print("Next: in the project, add a 'Review' option to Status and create the Board and Roadmap views.")
