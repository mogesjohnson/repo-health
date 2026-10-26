import type { RepoData } from '../types.js';

export const NOW = '2026-10-25T00:00:00Z';

export function healthy(): RepoData {
  return {
    repo: { name: 'good', owner: 'me', isArchived: false, isFork: false, visibility: 'public', defaultBranch: 'main' },
    now: NOW,
    readme: { path: 'README.md', content: '# Good\n\nSee [docs](docs/guide.md) and [site](https://x.dev).\n', lastCommitAt: '2026-10-20T00:00:00Z' },
    latestCommitAt: '2026-10-24T00:00:00Z',
    headSha: 'abc',
    tree: ['README.md', 'AGENTS.md', 'RULES.md', 'docs', 'docs/guide.md', 'scripts/check/pr-size.mjs', 'src/a.test.ts', 'package.json'],
    treeTruncated: false,
    packageJson: { scripts: { test: 'vitest run' } },
    pulls: [],
    checkRuns: [{ name: 'ci', status: 'completed', conclusion: 'success' }],
    combinedStatus: null,
    branches: [{ name: 'feature', lastCommitAt: '2026-10-01T00:00:00Z' }],
  };
}

export function neglected(): RepoData {
  return {
    ...healthy(),
    repo: { ...healthy().repo, name: 'bad' },
    readme: { path: 'README.md', content: '# Bad\n\n![logo](img/logo.png) [guide](./docs/missing.md#x)\n', lastCommitAt: '2025-01-01T00:00:00Z' },
    tree: ['README.md', 'package.json', 'src/index.js'],
    packageJson: { scripts: { test: 'echo "Error: no test specified" && exit 1' } },
    pulls: [
      { number: 1, draft: true, createdAt: '2026-01-01T00:00:00Z' },
      { number: 2, draft: false, createdAt: '2026-10-24T00:00:00Z' },
    ],
    checkRuns: [{ name: 'build', status: 'completed', conclusion: 'failure' }],
    branches: [{ name: 'old', lastCommitAt: '2025-06-01T00:00:00Z' }, { name: 'older', lastCommitAt: '2024-01-01T00:00:00Z' }],
  };
}
