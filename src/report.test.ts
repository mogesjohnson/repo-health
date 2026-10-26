import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './config.js';
import { healthy, neglected } from './fixtures/repos.js';
import { renderJson, renderMarkdown } from './report.js';
import { filterRepos, run } from './run.js';
import { rank, scoreRepo } from './score.js';

const meta = { owner: 'me', generatedAt: '2026-10-25' };

describe('report', () => {
  const scores = rank([scoreRepo(neglected(), DEFAULT_CONFIG), scoreRepo(healthy(), DEFAULT_CONFIG)]);
  it('renders a ranked table and fix-first lists', () => {
    const md = renderMarkdown(scores, meta);
    expect(md).toMatch(/\| 1 \| me\/good \| \*\*100\*\*/);
    expect(md).toMatch(/### me\/bad \(\d+\)\n\n1\. Fix the failing checks/);
  });
  it('renders JSON', () => {
    expect(JSON.parse(renderJson(scores, meta)).repos[0].repo).toBe('me/good');
  });
});

describe('run', () => {
  const r = healthy().repo;
  it('skips archived repos, forks and private repos when asked', () => {
    const list = [r, { ...r, name: 'a', isArchived: true }, { ...r, name: 'f', isFork: true }, { ...r, name: 'p', visibility: 'private' }];
    expect(filterRepos(list, DEFAULT_CONFIG).map((x) => x.name)).toEqual(['good', 'p']);
    expect(filterRepos(list, DEFAULT_CONFIG, true).map((x) => x.name)).toEqual(['good']);
  });
  it('records a per-repo error and keeps going', async () => {
    const gh = async (args: string[]) => {
      if (args[0] === 'repo') return JSON.stringify([{ name: 'x', isArchived: false, isFork: false, visibility: 'PUBLIC', defaultBranchRef: { name: 'main' }, owner: { login: 'me' } }]);
      throw new Error('HTTP 500 boom');
    };
    const out = await run(gh, DEFAULT_CONFIG, { owner: 'me' });
    expect(out).toHaveLength(1);
    expect(out[0].error).toMatch(/boom/);
  });
});
