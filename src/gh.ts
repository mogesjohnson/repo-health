// The only door to GitHub. Every call is a GET (`gh api` defaults to GET without fields)
// or `gh repo list`. Nothing here can write.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type GhRunner = (args: string[]) => Promise<string>;

export const ghCli: GhRunner = async (args) => {
  if (args[0] === 'api' && args.some((a) => /^(-X|--method|-f|-F|--field|--raw-field|--input)$/.test(a))) {
    throw new Error('repo-health is read-only: refusing a gh api call with a method or fields');
  }
  const { stdout } = await run('gh', args, { maxBuffer: 64 * 1024 * 1024 });
  return stdout;
};

/** GET one API path and parse JSON. Returns null on 404 (and 409 for an empty repo). */
export async function getJson<T>(gh: GhRunner, path: string): Promise<T | null> {
  try {
    return JSON.parse(await gh(['api', '-H', 'Accept: application/vnd.github+json', path])) as T;
  } catch (e) {
    const msg = String((e as { stderr?: string }).stderr ?? (e as Error).message);
    if (/HTTP 40[49]/.test(msg)) return null;
    throw e;
  }
}
