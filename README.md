# repo-health

Score every GitHub repo an owner has from 0 to 100, and write a ranked `HEALTH.md` with what
to fix first. It reads GitHub only, through `gh` (GET calls and `gh repo list`), and never writes.

## Usage

Needs Node 22+ and `gh` logged in (`gh auth status`).

```sh
npm ci && npm run build
node dist/cli.js                                  # all of mogesjohnson's repos -> HEALTH.md
node dist/cli.js someone --public-only --out reports/HEALTH.md
node dist/cli.js --repos shadow-army,post-it-board --json
```

| Flag | Meaning |
| --- | --- |
| `[owner]` | User or org to scan. Default: `mogesjohnson`. |
| `--repos a,b` | Score only these repos of the owner (archived and fork filters do not apply). |
| `--public-only` | Skip repos whose visibility is not public. |
| `--json` | Print JSON to stdout (or to `--out`) instead of writing Markdown. |
| `--out path` | Output file. Default: `HEALTH.md`. |
| `--config path` | Config file. Default: `repo-health.config.json` in the working directory. |

Archived repos and forks are skipped by default. A repo that fails to collect gets an entry in
an "Errors" section; the run goes on.

## Config

`repo-health.config.json` ships with the defaults. Any missing key falls back to them.

```json
{
  "weights": {
    "staleDocs": 15,
    "openPrs": 15,
    "checks": 25,
    "tests": 20,
    "ruleDrift": 15,
    "staleBranches": 10
  },
  "thresholds": {
    "docsStaleDays": 90,
    "prAgeDays": 14,
    "branchStaleDays": 90,
    "maxBranchesChecked": 30
  },
  "skipArchived": true,
  "skipForks": true
}
```

## Scoring

Each category scores 0-100 (100 minus its deductions). The repo score is the weighted average.
"Fix first" lists the three deductions that cost the most overall points.

| Category | Weight | Deductions |
| --- | --- | --- |
| Docs (`staleDocs`) | 15 | No README: all 100. README's last commit more than `docsStaleDays` behind the branch's latest commit: 30, plus 10 per extra 30 days (max 60). Each broken relative link or image in the README (checked against the git tree): 15 (max 50). |
| PRs (`openPrs`) | 15 | 5 per open PR (max 40), 10 per PR older than `prAgeDays` (max 40), 5 per draft (max 20). |
| Checks (`checks`) | 25 | On the default branch HEAD: any failing check run or a failing combined status: 100. No check runs and no statuses: 60. Still pending: 10. |
| Tests (`tests`) | 20 | No `*.test.*`, `*.spec.*`, `*_test.*`, `*_spec.*`, `test_*.py`, `*Test(s).java|kt|cs`, `test/`, `tests/`, `spec/` or `__tests__` in the tree: 60. A package.json with no real `test` script: 40. No package.json and no test files: another 40. |
| Rules (`ruleDrift`) | 15 | Against BEST-OF-AI-DEV: no `AGENTS.md`: 35, no `RULES.md`: 35, no size gate (`scripts/check/pr-size*` or `.github/workflows/pr-checks.yml`): 30. |
| Branches (`staleBranches`) | 10 | 10 per non-default branch with no commits in `branchStaleDays` (first `maxBranchesChecked` branches only). |

## Example: mogesjohnson, public repos only

`node dist/cli.js mogesjohnson --public-only`, run on 2026-10-25. The top of the table
is below; the full report is [`examples/HEALTH.public.md`](examples/HEALTH.public.md).

| Rank | Repo | Score | Docs | PRs | Checks | Tests | Rules | Branches |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | mogesjohnson/BEST-OF-AI-DEV | **100** | 100 | 100 | 100 | 100 | 100 | 100 |
| 2 | mogesjohnson/spec-to-tests | **100** | 100 | 100 | 100 | 100 | 100 | 100 |
| 3 | mogesjohnson/care-reminder | **90** | 100 | 100 | 100 | 100 | 30 | 100 |
| 4 | mogesjohnson/post-it-board | **85** | 100 | 100 | 100 | 100 | 0 | 100 |
| 5 | mogesjohnson/shadow-army | **75** | 100 | 35 | 100 | 100 | 0 | 100 |
| 6 | mogesjohnson/how-to-post-it | **70** | 100 | 100 | 40 | 100 | 0 | 100 |
| 7 | mogesjohnson/Bobs-Bodyguards-webapp | **65** | 100 | 100 | 100 | 0 | 0 | 100 |

Fix first, for two of them:

### mogesjohnson/shadow-army (75)

1. Merge or close the 7 open PRs.
2. Add AGENTS.md from the BEST-OF-AI-DEV template.
3. Add RULES.md from the BEST-OF-AI-DEV template.

### mogesjohnson/trace-workbench (62)

1. Fix the failing checks on main: windows.
2. Merge or close the 17 open PRs.
3. Add the PR size gate (scripts/check/pr-size.mjs or a pr-checks workflow).

## Development

See [AGENTS.md](AGENTS.md) and [RULES.md](RULES.md). `npm test` runs the Vitest suite
(fixtures only, no network), `npm run typecheck` the types, and
`node scripts/setup-hooks.mjs` installs the hooks.

## Limits

- Branch ages cost one API call per branch, capped by `maxBranchesChecked`.
- Broken-link checks are skipped when GitHub truncates the tree (very large repos).
- The date in HEALTH.md is UTC.
