// Renders scores as HEALTH.md or JSON.
import { CATEGORIES, type Category } from './config.js';
import type { RepoScore } from './score.js';

export const LABELS: Record<Category, string> = {
  staleDocs: 'Docs', openPrs: 'PRs', checks: 'Checks', tests: 'Tests', ruleDrift: 'Rules', staleBranches: 'Branches',
};

export function renderMarkdown(scores: RepoScore[], meta: { owner: string; generatedAt: string }): string {
  const ok = scores.filter((s) => !s.error);
  const failed = scores.filter((s) => s.error);
  const out = [`# Repo health: ${meta.owner}`, '', `Generated ${meta.generatedAt} by repo-health. Scores are 0-100; higher is healthier.`, ''];
  out.push(`| Rank | Repo | Score | ${CATEGORIES.map((k) => LABELS[k]).join(' | ')} |`);
  out.push(`| --- | --- | --- | ${CATEGORIES.map(() => '---').join(' | ')} |`);
  ok.forEach((s, i) => out.push(`| ${i + 1} | ${s.repo} | **${s.score}** | ${CATEGORIES.map((k) => s.categories[k]).join(' | ')} |`));
  out.push('', '## Fix first', '');
  for (const s of ok) {
    out.push(`### ${s.repo} (${s.score})`, '');
    if (!s.fixFirst.length) out.push('Nothing to fix.');
    s.fixFirst.forEach((f, i) => out.push(`${i + 1}. ${f}`));
    out.push('');
  }
  if (failed.length) {
    out.push('## Errors', '');
    for (const s of failed) out.push(`- ${s.repo}: ${s.error}`);
    out.push('');
  }
  return out.join('\n');
}

export function renderJson(scores: RepoScore[], meta: { owner: string; generatedAt: string }): string {
  return JSON.stringify({ ...meta, repos: scores }, null, 2) + '\n';
}
