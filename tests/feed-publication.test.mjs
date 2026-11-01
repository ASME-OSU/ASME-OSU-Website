import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/publish-feed.mjs', import.meta.url));
function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
test('feed publication rebases unrelated remote changes and skips unchanged snapshots', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'asme-publish-test-'));
  try {
    const remote = path.join(temporary, 'remote.git');
    const author = path.join(temporary, 'author');
    const publisher = path.join(temporary, 'publisher');
    git(temporary, 'init', '--bare', '--initial-branch=main', remote);
    git(temporary, 'clone', remote, author);
    git(author, 'config', 'user.name', 'Test Officer');
    git(author, 'config', 'user.email', 'test@example.invalid');
    fs.writeFileSync(path.join(author, 'feed.json'), '{}\n');
    fs.writeFileSync(path.join(author, 'page.html'), 'Original\n');
    git(author, 'add', '.'); git(author, 'commit', '-m', 'Initial'); git(author, 'push');
    git(temporary, 'clone', remote, publisher);
    // An officer publishes while the collector still has the earlier checkout.
    fs.writeFileSync(path.join(author, 'page.html'), 'Officer update\n');
    git(author, 'commit', '-am', 'Officer page update'); git(author, 'push');
    fs.writeFileSync(path.join(publisher, 'feed.json'), '{"current":true}\n');
    const output = path.join(temporary, 'output');
    const publish = () => spawnSync(process.execPath, [script, 'Update test feed', 'feed.json'], {
      cwd: publisher, env: { ...process.env, GITHUB_REF_NAME: 'main', GITHUB_OUTPUT: output }, encoding: 'utf8'
    });
    let result = publish();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(publisher, 'page.html'), 'utf8'), 'Officer update\n');
    assert.equal(git(temporary, '--git-dir', remote, 'show', 'main:feed.json'), '{"current":true}');
    assert.equal(fs.readFileSync(output, 'utf8'), 'changed=true\n');
    const published = git(publisher, 'rev-parse', 'HEAD');
    result = publish();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(git(publisher, 'rev-parse', 'HEAD'), published);
    assert.equal(fs.readFileSync(output, 'utf8'), 'changed=true\nchanged=false\n');
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
