// Scores RepoData 0-100. Pure: no network, no clock (ages are measured from data.now).
import { CATEGORIES, type Category, type Config } from './config.js';
import type { RepoData } from './types.js';

export interface Deduction { category: Category; points: number; message: string }
export interface CategoryScore { score: number; deductions: Deduction[] }
export interface RepoScore {
  repo: string;
  score: number;
  categories: Record<Category, number>;
  deductions: Deduction[];
  fixFirst: string[];
  error?: string;
}

const DAY = 86_400_000;
const days = (from: string | null, to: string | null) => (from && to ? Math.max(0, (Date.parse(to) - Date.parse(from)) / DAY) : 0);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function category(category: Category, items: [number, string][]): CategoryScore {
  const deductions = items.filter(([p]) => p > 0).map(([points, message]) => ({ category, points, message }));
  return { score: clamp(100 - deductions.reduce((s, d) => s + d.points, 0)), deductions };
}

/** Relative links and images in a markdown README, without anchors or queries. */
export function relativeLinks(markdown: string): string[] {
  const out = new Set<string>();
  const body = markdown.replace(/```[\s\S]*?```/g, '');
  for (const m of body.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    const url = m[1];
    if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(url)) continue;
    const path = url.split(/[?#]/)[0];
    if (path) out.add(safeDecode(path));
  }
  return [...out];
}

/** decodeURIComponent, but a malformed escape such as a bare `%` keeps the raw text. */
function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

/** Resolves a README-relative link to a repo path; null when it escapes the repo. */
export function resolveLink(readmePath: string, link: string): string | null {
  const parts = link.startsWith('/') ? [] : readmePath.split('/').slice(0, -1);
  for (const seg of link.replace(/^\//, '').split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { if (!parts.length) return null; parts.pop(); } else parts.push(seg);
  }
  return parts.join('/').replace(/\/$/, '');
}

export function brokenLinks(data: RepoData): string[] {
  if (!data.readme || data.treeTruncated) return [];
  const paths = new Set(data.tree);
  return relativeLinks(data.readme.content).filter((l) => {
    const p = resolveLink(data.readme!.path, l);
    return p !== null && p !== '' && !paths.has(p);
  });
}

export function scoreStaleDocs(d: RepoData, c: Config): CategoryScore {
  if (!d.readme) return category('staleDocs', [[100, 'Add a README; the repo has none.']]);
  const lag = days(d.readme.lastCommitAt, d.latestCommitAt);
  const broken = brokenLinks(d);
  return category('staleDocs', [
    [lag > c.thresholds.docsStaleDays ? Math.min(60, 30 + Math.floor((lag - c.thresholds.docsStaleDays) / 30) * 10) : 0,
      `Update the README; it is ${Math.round(lag)} days behind the latest commit (limit ${c.thresholds.docsStaleDays}).`],
    [Math.min(50, broken.length * 15), `Fix ${broken.length} broken README link${broken.length === 1 ? '' : 's'}: ${broken.slice(0, 3).join(', ')}.`],
  ]);
}

export function scoreOpenPrs(d: RepoData, c: Config): CategoryScore {
  const old = d.pulls.filter((p) => days(p.createdAt, d.now) > c.thresholds.prAgeDays);
  const drafts = d.pulls.filter((p) => p.draft);
  return category('openPrs', [
    [Math.min(40, d.pulls.length * 5), `Merge or close the ${d.pulls.length} open PR${d.pulls.length === 1 ? '' : 's'}.`],
    [Math.min(40, old.length * 10), `Review ${old.length} PR${old.length === 1 ? '' : 's'} open longer than ${c.thresholds.prAgeDays} days: ${old.slice(0, 3).map((p) => `#${p.number}`).join(', ')}.`],
    [Math.min(20, drafts.length * 5), `Finish or close ${drafts.length} draft PR${drafts.length === 1 ? '' : 's'}.`],
  ]);
}

const FAILED = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure']);

export function scoreChecks(d: RepoData): CategoryScore {
  const failing = d.checkRuns.filter((r) => r.conclusion && FAILED.has(r.conclusion));
  const statusFailed = d.combinedStatus === 'failure' || d.combinedStatus === 'error';
  if (!d.checkRuns.length && !d.combinedStatus) {
    return category('checks', [[60, `Add CI; the ${d.repo.defaultBranch} HEAD has no check runs or statuses.`]]);
  }
  const pending = d.checkRuns.some((r) => r.status !== 'completed') || d.combinedStatus === 'pending';
  return category('checks', [
    [failing.length || statusFailed ? 100 : 0,
      `Fix the failing checks on ${d.repo.defaultBranch}: ${failing.slice(0, 3).map((r) => r.name).join(', ') || 'commit status'}.`],
    [pending && !failing.length ? 10 : 0, `Checks on ${d.repo.defaultBranch} are still pending.`],
  ]);
}

const TEST_FILE = /(^|\/)(test|tests|__tests__)\/|\.test\.[a-z]+$|_test\.[a-z]+$|(^|\/)(test|tests|__tests__)$/i;

export function hasTestFiles(tree: string[]): boolean {
  return tree.some((p) => TEST_FILE.test(p));
}

export function scoreTests(d: RepoData): CategoryScore {
  const script = d.packageJson?.scripts?.test;
  const hasScript = Boolean(script && !/no test specified/.test(script));
  const files = hasTestFiles(d.tree);
  return category('tests', [
    [files ? 0 : 60, 'Add tests; no *.test.*, *_test.*, test/, tests/ or __tests__ files were found.'],
    [hasScript || !d.packageJson ? 0 : 40, 'Add a "test" script to package.json.'],
    [!d.packageJson && !files ? 40 : 0, 'Add a test command so CI can run the tests.'],
  ]);
}

export function scoreRuleDrift(d: RepoData): CategoryScore {
  const has = (p: string) => d.tree.includes(p);
  const sizeGate = d.tree.some((p) => /^scripts\/check\/pr-size/.test(p) || /^\.github\/workflows\/pr-checks\.ya?ml$/.test(p));
  return category('ruleDrift', [
    [has('AGENTS.md') ? 0 : 35, 'Add AGENTS.md from the BEST-OF-AI-DEV template.'],
    [has('RULES.md') ? 0 : 35, 'Add RULES.md from the BEST-OF-AI-DEV template.'],
    [sizeGate ? 0 : 30, 'Add the PR size gate (scripts/check/pr-size.mjs or a pr-checks workflow).'],
  ]);
}

export function scoreStaleBranches(d: RepoData, c: Config): CategoryScore {
  const stale = d.branches.filter((b) => b.lastCommitAt && days(b.lastCommitAt, d.now) > c.thresholds.branchStaleDays);
  return category('staleBranches', [
    [Math.min(100, stale.length * 10),
      `Delete or merge ${stale.length} branch${stale.length === 1 ? '' : 'es'} with no commits in ${c.thresholds.branchStaleDays} days: ${stale.slice(0, 3).map((b) => b.name).join(', ')}.`],
  ]);
}

export function scoreRepo(d: RepoData, c: Config): RepoScore {
  const parts: Record<Category, CategoryScore> = {
    staleDocs: scoreStaleDocs(d, c), openPrs: scoreOpenPrs(d, c), checks: scoreChecks(d),
    tests: scoreTests(d), ruleDrift: scoreRuleDrift(d), staleBranches: scoreStaleBranches(d, c),
  };
  const total = CATEGORIES.reduce((s, k) => s + c.weights[k], 0) || 1;
  const score = clamp(CATEGORIES.reduce((s, k) => s + parts[k].score * c.weights[k], 0) / total);
  // Rank deductions by their effect on the overall score.
  const deductions = CATEGORIES.flatMap((k) => parts[k].deductions.map((x) => ({ ...x, points: Math.round((Math.min(x.points, 100) * c.weights[k]) / total * 10) / 10 })))
    .sort((a, b) => b.points - a.points);
  return {
    repo: `${d.repo.owner}/${d.repo.name}`,
    score,
    categories: Object.fromEntries(CATEGORIES.map((k) => [k, parts[k].score])) as Record<Category, number>,
    deductions,
    fixFirst: deductions.slice(0, 3).map((x) => x.message),
  };
}

export function rank(scores: RepoScore[]): RepoScore[] {
  return [...scores].sort((a, b) => b.score - a.score || a.repo.localeCompare(b.repo));
}
