# Port log

Shéi started from Chi è? `main` at `29a45c1` (spec section 9, "Repo"). Chi è? is the `italian` remote. To see Chi è? commits not yet considered here:

```bash
git fetch italian && git log --oneline 29a45c1..italian/main
```

Each Chi è? fix after the fork gets one line: date, Chi è? commit, and whether it was cherry-picked (with the Shéi commit) or skipped (with why). Move the starting point in the command above when you log a batch.

| Date | Chi è? commit | Outcome |
|---|---|---|
