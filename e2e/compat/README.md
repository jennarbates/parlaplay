# Chi è? compatibility code (PLAY-024)

`chie-launch/` holds a pinned, unedited copy of Chi è?'s sync code from `jennarbates/Italian`: `src/services/sync.ts`, every file it imports, and the lexicon its `pull` is called with. `scripts/chie-compat.integration.test.ts` runs it against the local Supabase with every migration applied, to show the launched Chi è? app keeps syncing through the compatibility window (platform spec 5.2, 10.2).

`chie-launch/PINNED.json` records the commit it came from and each file's sha256. The test fails if a pinned file is edited, and the folder is skipped by ESLint and Prettier so it stays byte for byte as Chi è? shipped it.

## Re-pinning

The copy is made by a script, never by hand:

```bash
git fetch italian --tags
node scripts/pin-chie-compat.ts chie-launch
```

Until Chi è? tags `chie-launch` (Thu Oct 29, platform milestone 5) it is pinned from `italian/main`. Re-pin from the tag that day, and check that `PINNED.json` says `"ref": "chie-launch"`.
