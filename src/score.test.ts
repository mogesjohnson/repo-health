import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, mergeConfig } from './config.js';
import { healthy, neglected } from './fixtures/repos.js';
import {
  brokenLinks, hasTestFiles, rank, relativeLinks, resolveLink, scoreChecks, scoreOpenPrs, scoreRepo,
  scoreRuleDrift, scoreStaleBranches, scoreStaleDocs, scoreTests,
} from './score.js';

const c = DEFAULT_CONFIG;

describe('scoreRepo', () => {
  it('gives a healthy repo 100 in every category', () => {
    const s = scoreRepo(healthy(), c);
    expect(s.score).toBe(100);
    expect(Object.values(s.categories).every((v) => v === 100)).toBe(true);
    expect(s.fixFirst).toEqual([]);
  });

  it('scores a neglected repo low and lists its top 3 fixes, biggest first', () => {
    const s = scoreRepo(neglected(), c);
    expect(s.score).toBeLessThan(40);
    expect(s.fixFirst).toHaveLength(3);
    expect(s.fixFirst[0]).toMatch(/failing checks/);
    const pts = s.deductions.map((d) => d.points);
    expect([...pts].sort((a, b) => b - a)).toEqual(pts);
  });

  it('uses the configured weights', () => {
    const onlyChecks = mergeConfig({ weights: { staleDocs: 0, openPrs: 0, checks: 1, tests: 0, ruleDrift: 0, staleBranches: 0 } });
    expect(scoreRepo(neglected(), onlyChecks).score).toBe(0);
    const noChecks = mergeConfig({ weights: { ...c.weights, checks: 0 } });
    expect(scoreRepo(neglected(), noChecks).score).toBeGreaterThan(scoreRepo(neglected(), c).score);
  });

  it('rank sorts by score, then name', () => {
    const a = scoreRepo(neglected(), c);
    const b = scoreRepo(healthy(), c);
    expect(rank([a, b]).map((s) => s.repo)).toEqual(['me/good', 'me/bad']);
  });
});

describe('stale docs', () => {
  it('finds relative links and skips urls, anchors and code blocks', () => {
    expect(relativeLinks('[a](a.md) [b](https://b) [c](#c) ![d](img/d.png "t")\n```\n[e](e.md)\n```')).toEqual(['a.md', 'img/d.png']);
  });
  it('keeps a link with a malformed percent escape instead of throwing', () => {
    expect(relativeLinks('[a](docs/100%.md) [b](my%20file.md)')).toEqual(['docs/100%.md', 'my file.md']);
  });
  it('resolves links against the README folder', () => {
    expect(resolveLink('docs/README.md', '../src/x.ts')).toBe('src/x.ts');
    expect(resolveLink('README.md', './docs/')).toBe('docs');
    expect(resolveLink('README.md', '../outside')).toBeNull();
  });
  it('reports broken links and a lagging README', () => {
    expect(brokenLinks(neglected())).toEqual(['img/logo.png', './docs/missing.md']);
    const s = scoreStaleDocs(neglected(), c);
    expect(s.deductions.map((d) => d.message).join(' ')).toMatch(/days behind.*broken README links/s);
    expect(s.score).toBeLessThan(30);
  });
  it('a missing README scores 0', () => {
    expect(scoreStaleDocs({ ...healthy(), readme: null }, c).score).toBe(0);
  });
});

describe('open PRs', () => {
  it('deducts for count, age and drafts', () => {
    const s = scoreOpenPrs(neglected(), c);
    expect(s.score).toBe(100 - 10 - 10 - 5);
  });
});

describe('checks', () => {
  it('failing checks score 0; missing checks score 40', () => {
    expect(scoreChecks(neglected()).score).toBe(0);
    expect(scoreChecks({ ...healthy(), checkRuns: [] }).score).toBe(40);
    expect(scoreChecks({ ...healthy(), checkRuns: [], combinedStatus: 'error' }).score).toBe(0);
  });
});

describe('tests', () => {
  it('detects test files by name and folder', () => {
    expect(hasTestFiles(['a_test.go'])).toBe(true);
    expect(hasTestFiles(['pkg/__tests__/x.js'])).toBe(true);
    expect(hasTestFiles(['tests'])).toBe(true);
    expect(hasTestFiles(['src/contest.ts', 'latest/x.md'])).toBe(false);
  });
  it('treats the npm init placeholder as no test script', () => {
    expect(scoreTests(neglected()).score).toBe(0);
    expect(scoreTests({ ...healthy(), packageJson: null }).score).toBe(100);
  });
});

describe('rule drift and stale branches', () => {
  it('needs AGENTS.md, RULES.md and a size gate', () => {
    expect(scoreRuleDrift(neglected()).score).toBe(0);
    expect(scoreRuleDrift({ ...healthy(), tree: ['AGENTS.md', 'RULES.md', '.github/workflows/pr-checks.yml'] }).score).toBe(100);
  });
  it('counts branches older than the threshold', () => {
    expect(scoreStaleBranches(neglected(), c).score).toBe(80);
    expect(scoreStaleBranches(healthy(), c).score).toBe(100);
  });
});
