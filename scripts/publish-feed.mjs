import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

// All public-feed workflows share one concurrency group. Rebase retries also
// account for an officer publishing an unrelated change during collection.
const [message, ...paths] = process.argv.slice(2);
if (!message || !paths.length) throw new Error('Usage: node scripts/publish-feed.mjs "commit message" path [...]');
const branch = process.env.GITHUB_REF_NAME || 'main';
function git(args, allowFailure = false) {
  const result = spawnSync('git', args, { stdio: 'inherit', env: {...process.env, GIT_COMMITTER_NAME: 'ASME Website Bot', GIT_COMMITTER_EMAIL: 'asme-website-bot@users.noreply.github.com'} });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) throw new Error(`git ${args[0]} failed (${result.status})`);
  return result.status === 0;
}
function output(changed) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
}
git(['add', '--', ...paths]);
if (git(['diff', '--cached', '--quiet'], true)) {
  console.log('Public feed is already current.');
  output(false);
} else {
  git(['-c', 'user.name=ASME Website Bot', '-c', 'user.email=asme-website-bot@users.noreply.github.com', 'commit', '-m', message]);
  let pushed = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    git(['pull', '--rebase', 'origin', branch]);
    if (git(['push', 'origin', `HEAD:${branch}`], true)) { pushed = true; break; }
  }
  if (!pushed) throw new Error('Could not publish the feed after three attempts.');
  output(true);
}
