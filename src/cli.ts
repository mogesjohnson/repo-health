#!/usr/bin/env node
// repo-health [owner] [--repos a,b] [--public-only] [--json] [--out path] [--config path]
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { loadConfig } from './config.js';
import { ghCli } from './gh.js';
import { renderJson, renderMarkdown } from './report.js';
import { run } from './run.js';

const USAGE = 'usage: repo-health [owner] [--repos a,b] [--public-only] [--json] [--out path] [--config path]';

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv, allowPositionals: true,
    options: {
      repos: { type: 'string' }, 'public-only': { type: 'boolean' }, json: { type: 'boolean' },
      out: { type: 'string' }, config: { type: 'string' }, help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) { console.log(USAGE); return 0; }
  const owner = positionals[0] ?? 'mogesjohnson';
  const config = loadConfig(values.config);
  const repos = values.repos?.split(',').map((s) => s.trim()).filter(Boolean);
  const scores = await run(ghCli, config, { owner, repos, publicOnly: values['public-only'], log: (m) => console.error(m) });
  const meta = { owner, generatedAt: new Date().toISOString().slice(0, 10) };
  if (values.json) {
    const json = renderJson(scores, meta);
    if (values.out) writeFileSync(values.out, json); else process.stdout.write(json);
    return 0;
  }
  const out = values.out ?? 'HEALTH.md';
  writeFileSync(out, renderMarkdown(scores, meta));
  console.error(`wrote ${out} (${scores.length} repos)`);
  return 0;
}

main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error(`repo-health: ${(e as Error).message}`); process.exitCode = 2; });
