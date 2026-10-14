import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import '../assets/gearly/gearly-site.js';
const api = globalThis.GearlySite;
const Parser = new JSDOM().window.DOMParser;
const doc = html => new Parser().parseFromString(html, 'text/html');
const options = { origin: 'https://org.osu.edu', DOMParser: Parser };
const response = text => ({ ok: true, text: async () => text });

test('sponsors parser reads actual tiers and derives company aliases; edits add companies without code changes', async () => {
  const html = await fs.readFile(new URL('../Current Sponsors Page.html', import.meta.url), 'utf8');
  const result = api.parseSponsors(doc(html), { 'Pratt & Whitney': ['P&W'] });
  const pratt = result.companies.find(company => company.name.startsWith('Pratt'));
  assert.equal(pratt.tier, 'Brutus');
  assert.equal(pratt.id, 'pratt-whitney');
  assert.ok(pratt.aliases.includes('P&W'));
  assert.ok(pratt.aliases.includes('pratt and whitney'));
  const hrst = result.companies.find(company => company.name === 'HRST, Inc.');
  assert.equal(hrst.tier, 'Gray');
  assert.equal(hrst.id, 'hrst');
  assert.ok(hrst.aliases.includes('HRST'));
  assert.ok(result.tiers.some(tier => tier.name === 'Company Partners'));
  const changed = doc(html);
  const card = changed.querySelector('article.sponsor-card').cloneNode(true);
  card.querySelector('h3').textContent = 'Example Robotics, LLC';
  changed.querySelector('.sponsors-tier-cards').append(card);
  assert.ok(api.parseSponsors(changed).companies.some(company => company.aliases.includes('example robotics')));
  const partner = doc('<section><h2>Company Partners</h2><article class="partner-card"><h3>Example Aerospace Corp.</h3></article></section>');
  assert.equal(api.parseSponsors(partner).companies[0].id, 'example-aerospace');
  assert.equal(api.parseSponsors(partner).companies[0].tier, 'Company Partners');
});

test('FAQ parser follows real details markup and reflects source edits', async () => {
  const html = await fs.readFile(new URL('../Join Page.html', import.meta.url), 'utf8');
  const result = api.parseFAQs(doc(html));
  assert.equal(result.length, 6);
  assert.match(result[0].question, /major/);
  assert.match(result[0].answer, /related engineering majors/);
  const changed = doc(html);
  changed.querySelector('[data-gearly="join-faq"] details p').textContent = 'Students from every program are welcome.';
  assert.equal(api.parseFAQs(changed)[0].answer, 'Students from every program are welcome.');
});

test('extract returns only overlapping existing sentences from the requested section', () => {
  const html = '<section id="careers"><h2>Careers</h2><p>Resume workshops help students prepare for interviews. Career guides explain internship applications. Unrelated picnic plans are posted elsewhere.</p><script>Resume workshops fake injected text.</script></section><section id="other"><p>Resume workshops outside the requested section.</p></section>';
  const result = api.extract('resume workshops', doc(html), '#careers');
  assert.deepEqual(result.sentences, ['Resume workshops help students prepare for interviews.']);
  assert.equal(result.text, result.sentences.join(' '));
  assert.equal(api.extract('travel reimbursement policy', doc(html), '#careers').matched, false);
  assert.equal(api.extract('resume workshops', doc(html), '#missing').matched, false);
  const changed = html.replace('Resume workshops help students prepare for interviews.', 'Resume workshops now cover technical presentations.');
  assert.equal(api.extract('resume workshops', doc(changed), '#careers').text, 'Resume workshops now cover technical presentations.');
});

test('public discovery filters unsafe/private/excluded pages and includes a newly published page', async () => {
  api.clearCache();
  const rows = [
    { id: 1, link: 'https://org.osu.edu/asme/robotics/', title: { rendered: 'Robotics &amp; Design' }, excerpt: { rendered: '<p>Build new projects.</p>' } },
    { id: 2, link: 'https://org.osu.edu/asme/thank-you/', title: { rendered: 'Thanks' } },
    { id: 3, link: 'https://other.example/asme/private/', title: { rendered: 'Unsafe' } },
    { id: 4, link: 'https://org.osu.edu/asme/wp-admin/private/', title: { rendered: 'Admin' } },
    { id: 5, link: 'https://org.osu.edu/asme/draft/', status: 'draft', title: { rendered: 'Draft' } }
  ];
  let calls = 0;
  const config = { ...options, excludedSlugs: ['thank-you'], fetch: async (url, init) => {
    calls++; assert.equal(url, 'https://org.osu.edu/asme/wp-json/wp/v2/pages?per_page=100&_fields=id,link,title,excerpt');
    assert.equal(init.credentials, 'omit'); return response(JSON.stringify(rows));
  } };
  const result = await api.discoverPages(config);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Robotics & Design');
  assert.equal(result[0].id, 'robotics');
  assert.equal(result[0].snippet, 'Build new projects.');
  await api.discoverPages(config);
  assert.equal(calls, 1);
});

test('anonymous page fetch is cached, rejects unsafe URLs and bounds payload size', async () => {
  api.clearCache();
  let calls = 0;
  const config = { ...options, fetch: async (_, init) => { calls++; assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error'); return response('<main>Public source</main>'); } };
  assert.equal(await api.loadPage('https://org.osu.edu/asme/join/', config), '<main>Public source</main>');
  await api.loadPage('https://org.osu.edu/asme/join/', config);
  assert.equal(calls, 1);
  for (const url of ['http://org.osu.edu/asme/join/', 'https://user:pass@org.osu.edu/asme/join/', 'https://evil.example/asme/join/', 'https://org.osu.edu/asme/wp-json/wp/v2/users', 'https://org.osu.edu/asme/%77p-admin/private/', 'https://org.osu.edu/asme/join/?preview=true']) {
    await assert.rejects(api.loadPage(url, config));
  }
  api.clearCache();
  await assert.rejects(api.loadPage('https://org.osu.edu/asme/join/', { ...options, fetch: async () => ({ ok: true, headers: { get: () => '2097153' }, text: async () => { throw new Error('should not read'); } }) }), /size limit/);
  api.clearCache();
  await assert.rejects(api.loadPage('https://org.osu.edu/asme/join/', { ...options, fetch: async () => response('x'.repeat(2097153)) }), /size limit/);
});
