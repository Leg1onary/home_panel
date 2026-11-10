---
name: home-panel-release
description: Release cycle for the Home Panel HA add-on (repo Leg1onary/home_panel at C:\Users\ssholokhov\home_panel). Bump version, build, run tests, check Cyrillic integrity, commit and push. Use whenever a release or version bump is needed.
---

# Home Panel Release Cycle

## Context
- Repo: `C:\Users\ssholokhov\home_panel`, remote `origin main` (github.com/Leg1onary/home_panel).
- Dev tree: `development/`; build script syncs artifacts into `home_panel/` (add-on folder).
- Test contract: `node tests/run.mjs` from `development/` must print the exact final line
  `All N test suites passed.` (N currently 36; use the number found in tests/run.mjs).
- Current version: read from `development/package.json` (`version`).

## Steps (execute in order; never skip the verification gates)

1. **Bump version in exactly 3 files** (pure JSON edit via editor tool or python with utf-8, never PowerShell rewrite of Cyrillic files):
   - `home_panel/config.json` → `version`
   - `development/addon/home-panel/manifest.json` → `version`
   - `development/package.json` → `version`
   Note: `home_panel/package.json` is written by build.mjs — do not edit by hand.

2. **Build**: `cmd /c "cd /d C:\Users\ssholokhov\home_panel\development && node build.mjs"` —
   expect output ending with `Ready: dist (preview), release (local server, launcher, SQLite), home_panel (add-on).`

3. **Tests (detached, ~60 s)**: launch via `Start-Process -FilePath 'cmd' -ArgumentList '/c','cd /d C:\Users\ssholokhov\home_panel\development && node tests/run.mjs > qa_out.log 2>&1' -WindowStyle Hidden`,
   then poll twice with 28 s sleeps: count `^PASS` lines in `development/qa_out.log` and require the exact
   final line `All N test suites passed.` with N matching tests/run.mjs. Never rely on a single 30 s call —
   tool timeouts kill the run mid-way (known artifact, produces a truncated log with ~23 PASS lines).

4. **Cyrillic integrity check**: `python C:\Users\ssholokhov\scan2.py` must report `total: 0` (mojibake scan).
   If non-zero — STOP, restore from git, fix the file via editor tool only.

5. **Commit + push**:
   `git -C C:\Users\ssholokhov\home_panel add -A`
   commit message format: `<version>: <short summary of changes>`
   push: `cmd /c "git -C C:\Users\ssholokhov\home_panel push origin main 2>&1"`
   Verify with `git log --oneline -1` showing the new commit and `git status -sb` showing `## main...origin/main` in sync.

6. **Report to user** (always in Russian):
   - new version and commit hash,
   - tests N/N,
   - exact user update steps: «Репозитории → Обновить → Home Panel → Обновить аддон → Ctrl+F5»,
   - live build verification: check served `sw.js` contains `VERSION=<new>` at `http://192.168.8.182:8090/sw.js`
     (known pitfall: HA may say "updated" while the container still serves the old build).

## Rules
- Files containing Russian text are edited ONLY with the editor tool or python utf-8 scripts —
  PowerShell rewrites have caused double-encoding corruption before (incident history).
- Never bump `home_panel/package.json` manually.
- If tests fail: do not push; report the failing suite name and last 5 log lines.
- PowerShell quirk: inline python via `python -c "..."` breaks on quotes/Cyrillic — prefer writing
  a temp .py file with the editor tool and running it.
