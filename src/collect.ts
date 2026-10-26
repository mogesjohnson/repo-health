// Collects RepoData for each repo with read-only gh calls.
import { getJson, type GhRunner } from './gh.js';
import type { Branch, CheckRun, PullRequest, RepoData, RepoSummary } from './types.js';

interface ListedRepo {
  name: string; isArchived: boolean; isFork: boolean; visibility: string;
  defaultBranchRef: { name: string } | null; owner: { login: string };
}

export async function listRepos(gh: GhRunner, owner: string): Promise<RepoSummary[]> {
  const out = await gh(['repo', 'list', owner, '--limit', '500', '--json', 'name,isArchived,isFork,visibility,defaultBranchRef,owner']);
  return (JSON.parse(out) as ListedRepo[]).map((r) => ({
    name: r.name, owner: r.owner.login, isArchived: r.isArchived, isFork: r.isFork,
    visibility: r.visibility.toLowerCase(), defaultBranch: r.defaultBranchRef?.name ?? 'main',
  }));
}

export async function getRepo(gh: GhRunner, owner: string, name: string): Promise<RepoSummary> {
  const r = await getJson<{ name: string; archived: boolean; fork: boolean; visibility: string; default_branch: string; owner: { login: string } }>(gh, `repos/${owner}/${name}`);
  if (!r) throw new Error(`repo ${owner}/${name} not found`);
  return { name: r.name, owner: r.owner.login, isArchived: r.archived, isFork: r.fork, visibility: r.visibility, defaultBranch: r.default_branch };
}

type Commit = { sha: string; commit: { committer: { date: string } } };

async function lastCommit(gh: GhRunner, base: string, sha: string, path?: string): Promise<Commit | null> {
  const q = `${base}/commits?sha=${encodeURIComponent(sha)}&per_page=1${path ? `&path=${encodeURIComponent(path)}` : ''}`;
  const list = await getJson<Commit[]>(gh, q);
  return list?.[0] ?? null;
}

export async function collectRepo(gh: GhRunner, repo: RepoSummary, maxBranches = 30, now = new Date()): Promise<RepoData> {
  const base = `repos/${repo.owner}/${repo.name}`;
  const branch = repo.defaultBranch;
  const head = await lastCommit(gh, base, branch);
  const headSha = head?.sha ?? null;

  const readmeRaw = await getJson<{ path: string; content: string; encoding: string }>(gh, `${base}/readme`);
  let readme: RepoData['readme'] = null;
  if (readmeRaw) {
    const content = Buffer.from(readmeRaw.content, 'base64').toString('utf8');
    const c = await lastCommit(gh, base, branch, readmeRaw.path);
    readme = { path: readmeRaw.path, content, lastCommitAt: c?.commit.committer.date ?? null };
  }

  const treeRaw = headSha ? await getJson<{ tree: { path: string; type: string }[]; truncated: boolean }>(gh, `${base}/git/trees/${headSha}?recursive=1`) : null;
  const tree = treeRaw?.tree.filter((t) => t.type === 'blob' || t.type === 'tree').map((t) => t.path) ?? [];

  let packageJson: RepoData['packageJson'] = null;
  if (tree.includes('package.json')) {
    const pj = await getJson<{ content: string }>(gh, `${base}/contents/package.json?ref=${encodeURIComponent(branch)}`);
    try { packageJson = pj ? JSON.parse(Buffer.from(pj.content, 'base64').toString('utf8')) : null; } catch { packageJson = {}; }
  }

  const pullsRaw = (await getJson<{ number: number; draft: boolean; created_at: string }[]>(gh, `${base}/pulls?state=open&per_page=100`)) ?? [];
  const pulls: PullRequest[] = pullsRaw.map((p) => ({ number: p.number, draft: p.draft, createdAt: p.created_at }));

  let checkRuns: CheckRun[] = [];
  let combinedStatus: string | null = null;
  if (headSha) {
    const cr = await getJson<{ check_runs: CheckRun[] }>(gh, `${base}/commits/${headSha}/check-runs?per_page=100`);
    checkRuns = (cr?.check_runs ?? []).map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion }));
    const st = await getJson<{ state: string; total_count: number }>(gh, `${base}/commits/${headSha}/status`);
    combinedStatus = st && st.total_count > 0 ? st.state : null;
  }

  const branchList = (await getJson<{ name: string }[]>(gh, `${base}/branches?per_page=100`)) ?? [];
  const branches: Branch[] = [];
  for (const b of branchList.filter((x) => x.name !== branch).slice(0, maxBranches)) {
    const c = await lastCommit(gh, base, b.name);
    branches.push({ name: b.name, lastCommitAt: c?.commit.committer.date ?? null });
  }

  return {
    repo, now: now.toISOString(), readme, latestCommitAt: head?.commit.committer.date ?? null, headSha,
    tree, treeTruncated: treeRaw?.truncated ?? false, packageJson, pulls, checkRuns, combinedStatus, branches,
  };
}
