# 0001: repo-health v0.1

Status: in progress
Owner: Moges Johnson; agent: grok-bot

## Goal

`repo-health [owner] [--repos a,b] [--public-only] [--json] [--out path] [--config path]`
scores each repo 0-100 and writes a ranked HEALTH.md.

## Acceptance criteria

- [ ] Lists the owner's repos with `gh repo list --json`, skipping archived repos and forks by default.
- [ ] Six weighted categories: stale docs, open PRs, checks, missing tests, rule drift, stale branches.
- [ ] Weights and thresholds come from `repo-health.config.json`, with defaults shipped.
- [ ] HEALTH.md has a ranked table and a "Fix first" list (top 3 deductions) per repo; `--json` prints JSON.
- [ ] Only GET reads against GitHub. One repo's failure does not abort the run.
- [ ] Scoring is unit-tested with fixtures and no network.

## Out of scope

- Writing to any repo, caching, GitHub Enterprise hosts.
