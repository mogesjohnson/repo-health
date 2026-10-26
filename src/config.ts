// Loads repo-health.config.json and fills any missing key from the shipped defaults.
import { existsSync, readFileSync } from 'node:fs';

export type Category = 'staleDocs' | 'openPrs' | 'checks' | 'tests' | 'ruleDrift' | 'staleBranches';
export const CATEGORIES: Category[] = ['staleDocs', 'openPrs', 'checks', 'tests', 'ruleDrift', 'staleBranches'];

export interface Config {
  weights: Record<Category, number>;
  thresholds: { docsStaleDays: number; prAgeDays: number; branchStaleDays: number; maxBranchesChecked: number };
  skipArchived: boolean;
  skipForks: boolean;
}

export const DEFAULT_CONFIG: Config = {
  weights: { staleDocs: 15, openPrs: 15, checks: 25, tests: 20, ruleDrift: 15, staleBranches: 10 },
  thresholds: { docsStaleDays: 90, prAgeDays: 14, branchStaleDays: 90, maxBranchesChecked: 30 },
  skipArchived: true,
  skipForks: true,
};

export function mergeConfig(partial: Partial<Config> = {}): Config {
  return {
    weights: { ...DEFAULT_CONFIG.weights, ...partial.weights },
    thresholds: { ...DEFAULT_CONFIG.thresholds, ...partial.thresholds },
    skipArchived: partial.skipArchived ?? DEFAULT_CONFIG.skipArchived,
    skipForks: partial.skipForks ?? DEFAULT_CONFIG.skipForks,
  };
}

export function loadConfig(path = 'repo-health.config.json'): Config {
  if (!existsSync(path)) return mergeConfig();
  return mergeConfig(JSON.parse(readFileSync(path, 'utf8')) as Partial<Config>);
}
