import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkContract } from '../scripts/check-gearly-contract.mjs';

function fixture() {
  return {
    data: {
      meta: { sheetID: 'public-fixture-sheet', contactEmail: 'team@example.org', instagramHandle: 'fixturechapter' },
      pages: [{ id: 'home', url: 'https://org.osu.edu/asme/', sourceFile: 'Home Page.html' }],
      tour: { steps: [{ page: 'home', selector: '#home' }, { page: 'home', selector: '#asme-site-header, #site-navigation' }] },
      intents: [{ id: 'dues', static: true }],
      eventTypes: { social: ['social', 'picnic'], technical: ['workshop'] }
    },
    files: {
      'Home Page.html': '<section id="home"></section>',
      'Header.html': '<header id="asme-site-header"></header>',
      'Member Points Integration.js': "var EXPORT_ID = 'public-fixture-sheet';",
      'Join Page.html': '<a href="mailto:team@example.org">Team</a><p>Joining is free.</p>',
      'Leadership Page.html': '<h1>Leadership</h1>',
      'Footer.html': '<a href="https://www.instagram.com/fixturechapter/">Instagram</a>',
      'data/calendar-events.json': JSON.stringify({ events: [{ title: 'Chapter picnic' }, { title: 'Resume workshop' }] })
    }
  };
}
const check = value => checkContract(value.data, file => {
  if (!(file in value.files)) throw Object.assign(new Error(`Missing ${file}`), { code: 'ENOENT' });
  return value.files[file];
});

test('contracts validate registered page selectors and rendered shared header composition', async () => {
  const value = fixture();
  assert.deepEqual(await check(value), { errors: [], warnings: [] });
  value.files['Header.html'] = '<header id="different-header"></header>';
  assert.match((await check(value)).errors.join('\n'), /selector.*asme-site-header.*missing/);
  value.data.tour.steps[0].selector = '#missing';
  assert.match((await check(value)).errors.join('\n'), /selector #missing/);
  value.data.tour.steps[0].page = 'unregistered';
  assert.match((await check(value)).errors.join('\n'), /not registered/);
});

test('contracts fail seeded public constant drift, and warn without failing on static dues and unknown event types', async () => {
  const value = fixture();
  value.data.meta.sheetID = 'wrong';
  value.data.meta.contactEmail = 'missing@example.org';
  value.data.meta.instagramHandle = 'missing';
  const errors = (await check(value)).errors.join('\n');
  assert.match(errors, /sheetID/);
  assert.match(errors, /contactEmail/);
  assert.match(errors, /instagramHandle/);
  const warnings = fixture();
  warnings.files['Join Page.html'] += '<p>Optional trip costs $25.</p>';
  warnings.files['data/calendar-events.json'] = JSON.stringify({ events: [{ title: 'Novel astronomy evening' }] });
  const result = await check(warnings);
  assert.equal(result.errors.length, 0);
  assert.match(result.warnings.join('\n'), /dues is static/);
  assert.match(result.warnings.join('\n'), /Novel astronomy evening/);
});

test('site snapshot builder uses shared source parsers and check mode catches changed sources', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gearly-site-build-'));
  try {
    await fs.mkdir(path.join(directory, 'scripts'));
    await fs.mkdir(path.join(directory, 'assets/gearly'), { recursive: true });
    await fs.writeFile(path.join(directory, 'package.json'), '{"type":"module"}');
    await fs.symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), path.join(directory, 'node_modules'));
    await fs.copyFile(new URL('../scripts/build-gearly-site.mjs', import.meta.url), path.join(directory, 'scripts/build-gearly-site.mjs'));
    await fs.copyFile(new URL('../assets/gearly/gearly-site.js', import.meta.url), path.join(directory, 'assets/gearly/gearly-site.js'));
    await fs.writeFile(path.join(directory, 'Current Sponsors Page.html'), '<section><h2>Supporters</h2><article class="sponsor-card"><h3>Example Engines, LLC</h3></article></section>');
    await fs.writeFile(path.join(directory, 'Sponsor ASME Page.html'), '<section data-gearly="sponsor-tiers"></section>');
    await fs.writeFile(path.join(directory, 'Join Page.html'), '<section data-gearly="join-faq"><details class="join-faq-item"><summary>Can I join?</summary><p>Students are welcome.</p></details></section>');
    await fs.writeFile(path.join(directory, 'assets/gearly/gearly-data.json'), JSON.stringify({ companyAliases: { 'Example Engines, LLC': ['EE'] } }));
    const run = (...args) => spawnSync(process.execPath, [path.join(directory, 'scripts/build-gearly-site.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(run().status, 0);
    assert.equal(run('--check').status, 0);
    const snapshot = JSON.parse(await fs.readFile(path.join(directory, 'assets/gearly/gearly-site.json'), 'utf8'));
    assert.ok(snapshot.companies[0].aliases.includes('EE'));
    assert.equal(snapshot.faqs[0].answer, 'Students are welcome.');
    const generatedDataPath = path.join(directory, 'assets/gearly/gearly-data.json');
    const generatedData = JSON.parse(await fs.readFile(generatedDataPath, 'utf8'));
    assert.equal(generatedData.entities.companies[0].id, 'example-engines');
    assert.ok(generatedData.entities.companies[0].aliases.includes('EE'));
    generatedData.entities.companies = [];
    await fs.writeFile(generatedDataPath, JSON.stringify(generatedData));
    assert.match(run('--check').stderr, /company entities are stale/);
    assert.equal(run().status, 0);
    await fs.writeFile(path.join(directory, 'Join Page.html'), '<section data-gearly="join-faq"><details class="join-faq-item"><summary>Can I join?</summary><p>Everyone is welcome.</p></details></section>');
    const stale = run('--check');
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /snapshot is stale/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});


test('calendar contracts skip excluded academic titles, tolerate malformed patterns and still warn about unknown chapter activities', async () => {
  const value = fixture();
  value.data.eventRules = {nonChapterTitlePatterns:['[', '\\bfinal exams?\\b', 42]};
  value.files['data/calendar-events.json'] = JSON.stringify({events:[{title:'Final Exams'},{title:'Unknown chapter outing'}]});
  const result = await check(value);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, ['Calendar event has no configured event type: Unknown chapter outing']);
});

test('current calendar feed has no event type warnings after academic filtering and source-based classification', async () => {
  const data = JSON.parse(await fs.readFile('assets/gearly/gearly-data.json','utf8'));
  const result = await checkContract(data, file => fs.readFile(file,'utf8'));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings.filter(w => w.startsWith('Calendar event')), []);
});
