import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('../.github/workflows/auto-merge.yml', import.meta.url), 'utf8');
const script = workflow.split('          script: |')[1].split('\n').map(line => line.replace(/^            /, '')).join('\n');
const run = new (Object.getPrototypeOf(async function () {}).constructor)('github', 'context', 'core', script);
async function scenario({ head = 'tested', state = 'clean', checks = [{ status: 'completed', conclusion: 'success' }], status = { total_count: 0, state: 'pending' }, draft = false, label = true } = {}) {
  const merges = [];
  const github = {
    paginate: async () => checks,
    rest: {
      pulls: {
        get: async () => ({ data: { number: 1, state: 'open', draft, mergeable_state: state,
          head: { sha: head, repo: { full_name: 'owner/repo' } }, base: { ref: 'main' }, labels: label ? [{ name: 'automerge' }] : [] } }),
        merge: async args => merges.push(args)
      },
      checks: { listForRef: () => {} },
      repos: { getCombinedStatusForRef: async () => ({ data: status }) }
    }
  };
  await run(github, { repo: { owner: 'owner', repo: 'repo' }, payload: { workflow_run: { head_sha: 'tested', pull_requests: [{ number: 1 }] } } }, { info: () => {} });
  return merges;
}
assert.equal((await scenario())[0].sha, 'tested');
for (const options of [
  { head: 'newer-unverified' }, { state: 'unknown' }, { state: 'dirty' }, { draft: true }, { label: false },
  { checks: [] }, { checks: [{ status: 'in_progress', conclusion: null }] },
  { checks: [{ status: 'completed', conclusion: 'failure' }] },
  { checks: [{ status: 'completed', conclusion: 'cancelled' }] },
  { status: { total_count: 1, state: 'pending' } }, { status: { total_count: 1, state: 'failure' } }
]) assert.equal((await scenario(options)).length, 0, JSON.stringify(options));
assert.equal((await scenario({ checks: [{ status: 'completed', conclusion: 'success' }, { status: 'completed', conclusion: 'skipped' }], status: { total_count: 1, state: 'success' } })).length, 1);
console.log('Auto-merge regression passed: stale head, pending/failed checks, deployment statuses, draft and conflicts block merge.');
