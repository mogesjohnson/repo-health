// Plain data collected for one repo. Scoring reads only this, so tests use fixtures.

export interface RepoSummary {
  name: string;
  owner: string;
  isArchived: boolean;
  isFork: boolean;
  visibility: string;
  defaultBranch: string;
}

export interface PullRequest { number: number; draft: boolean; createdAt: string }
export interface CheckRun { name: string; status: string; conclusion: string | null }
export interface Branch { name: string; lastCommitAt: string | null }

export interface RepoData {
  repo: RepoSummary;
  /** When the data was collected; ages are measured from here. */
  now: string;
  readme: { path: string; content: string; lastCommitAt: string | null } | null;
  latestCommitAt: string | null;
  headSha: string | null;
  /** Every file path in the default branch tree. */
  tree: string[];
  treeTruncated: boolean;
  packageJson: { scripts?: Record<string, string> } | null;
  pulls: PullRequest[];
  checkRuns: CheckRun[];
  /** Combined commit status state: success, failure, error, pending; null when there are no statuses. */
  combinedStatus: string | null;
  branches: Branch[];
}
