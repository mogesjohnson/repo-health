// Runs collection and scoring for many repos; one repo's failure never stops the rest.
import { collectRepo, getRepo, listRepos } from './collect.js';
import { CATEGORIES, type Category, type Config } from './config.js';
import type { GhRunner } from './gh.js';
import { rank, scoreRepo, type RepoScore } from './score.js';
import type { RepoSummary } from './types.js';

export interface RunOptions { owner: string; repos?: string[]; publicOnly?: boolean; log?: (m: string) => void }

export function filterRepos(list: RepoSummary[], config: Config, publicOnly = false): RepoSummary[] {
  return list.filter((r) => !(config.skipArchived && r.isArchived) && !(config.skipForks && r.isFork) && !(publicOnly && r.visibility !== 'public'));
}

export async function run(gh: GhRunner, config: Config, opts: RunOptions): Promise<RepoScore[]> {
  const log = opts.log ?? (() => {});
  let targets: RepoSummary[];
  if (opts.repos?.length) {
    targets = [];
    for (const name of opts.repos) {
      try { targets.push(await getRepo(gh, opts.owner, name)); } catch (e) { log(`skip ${name}: ${(e as Error).message}`); }
    }
    if (opts.publicOnly) targets = targets.filter((r) => r.visibility === 'public');
  } else {
    targets = filterRepos(await listRepos(gh, opts.owner), config, opts.publicOnly);
  }
  const scores: RepoScore[] = [];
  for (const repo of targets) {
    log(`scoring ${repo.owner}/${repo.name}`);
    try {
      scores.push(scoreRepo(await collectRepo(gh, repo, config.thresholds.maxBranchesChecked), config));
    } catch (e) {
      const msg = String((e as { stderr?: string }).stderr || (e as Error).message).trim().split('\n')[0];
      scores.push({ repo: `${repo.owner}/${repo.name}`, score: 0, categories: Object.fromEntries(CATEGORIES.map((k) => [k, 0])) as Record<Category, number>, deductions: [], fixFirst: [], error: msg });
    }
  }
  return rank(scores);
}
