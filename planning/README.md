# Planning

The parlaplay platform backlog, built from [`docs/spec.md`](../docs/spec.md).

- `backlog.py` is the one data source. Edit it, then run `python3 planning/backlog.py` from the repo root. It validates the backlog and rewrites `backlog.md`, `backlog.csv` and `issues.json`.
- `setup_github.py` creates the labels, sprint milestones, epic and card issues, sub-issue and blocked-by links, and the Project from `issues.json`. Progress is saved in `state.json`, so it can be re-run safely.
