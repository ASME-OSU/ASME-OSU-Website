import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';
import axe from 'axe-core';
import { chromium } from 'playwright';

const live = process.argv.includes('--live');
const origin = live ? 'https://org.osu.edu' : 'https://asme.test';
const home = origin + '/asme/';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const fragments = new Map([
  ['', 'Home Page.html'],
  ['aboutus/', 'About Us Page.html'],
  ['calendar/', 'Calendar Page.html'],
  ['current-sponsors/', 'Current Sponsors Page.html'],
  ['join/', 'Join Page.html']
]);
// Serve committed page fragments inside the wrappers their selectors expect on CampusPress.
// Mock all other requests so tests never depend on a public service.
const interactions = read('Footer.html').match(/<!-- V11 interactions script -->\s*<script>([\s\S]*?)<\/script>/)[1];
const localAssets = new Map([
  ['/_fixture/site.css', ['text/css', read('ASME Custom CSS.min.css')]],
  ['/_fixture/interactions.js', ['application/javascript', interactions]],
  ['/_fixture/footer.js', ['application/javascript', read('Footer Integration.js')]],
  ['/_fixture/calendar.js', ['application/javascript', read('Calendar Integration.js')]],
  ['/ASME-OSU-Website/Join Page Integration.js', ['application/javascript', read('Join Page Integration.js')]]
]);

let browser;
before(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});
after(async () => { await browser?.close(); });

function fixture(path, mutate) {
  const markup = mutate(read(fragments.get(path)));
  return `<!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>ASME browser smoke test fixture</title>
      <link rel="stylesheet" href="/_fixture/site.css">
      <style>.screen-reader-text:not(:focus) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }</style>
      <script defer src="/_fixture/interactions.js"></script>
      <script defer src="/_fixture/footer.js"></script>
      <script defer src="/_fixture/calendar.js"></script>
    </head>
    <body class="page">
      <a class="skip-link screen-reader-text" href="#content">Skip to content</a>
      ${read('tests/fixtures/wordpress-header.html')}
      <div class="site" id="page"><div id="content">
        <main class="site-main" id="main"><article class="type-page">
          <div class="entry-content">${markup}</div>
        </article></main>
      </div></div>
    </body>
    </html>`;
}

async function visit(t, path, { width = 390, colorScheme = 'light', reducedMotion = 'reduce', mutate = markup => markup, routeRequest, clock = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme, reducedMotion });
  t.after(() => page.close());
  if (!live) {
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.href === home + path) return route.fulfill({ contentType: 'text/html', body: fixture(path, mutate) });
      const asset = localAssets.get(decodeURIComponent(url.pathname));
      if (asset) return route.fulfill({ contentType: asset[0], body: asset[1] });
      if (routeRequest && await routeRequest(route, url)) return;
      return route.abort();
    });
  }
  if (clock) {
    await page.clock.install({ time: new Date('2026-11-17T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-17T12:01:00Z'));
  }
  const response = await page.goto(home + path, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  assert.equal(response.status(), 200);
  return page;
}

async function axeRule(page, rule, selector) {
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async ({ rule, selector }) => {
    const run = await window.axe.run(selector, { runOnly: [rule], iframes: false });
    return {
      passes: run.passes.flatMap(pass => pass.nodes.map(node => node.target)).length,
      violations: run.violations.flatMap(violation => violation.nodes.map(node => node.target))
    };
  }, { rule, selector });
  assert.deepEqual(result.violations, [], rule + ' violations in ' + selector);
  assert.ok(result.passes, rule + ' evaluated ' + selector);
}

test('Skip to content moves focus past the header and keeps the next Tab in main', { timeout: 30_000 }, async t => {
  const page = await visit(t, 'calendar/');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.skip-link').evaluate(link => document.activeElement === link), true);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#main').evaluate(main => document.activeElement === main), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#main').evaluate(main => main.contains(document.activeElement)), true);
});

test('sponsors keep named links when CampusPress inserts a duplicate empty logo anchor', { timeout: 30_000 }, async t => {
  const duplicate = '<p><a href="https://engineering.osu.edu/" class="sponsor-logo-link" data-test-empty-link></a></p>';
  const page = await visit(t, 'current-sponsors/', {
    mutate(markup) {
      const collegeHeading = '<h3><a href="https://engineering.osu.edu/"';
      assert.ok(markup.includes(collegeHeading), 'fixture can insert a duplicate next to its sponsor title');
      return markup.replace(collegeHeading, duplicate + collegeHeading);
    }
  });
  assert.equal(await page.locator('[data-test-empty-link]').count(), 0);
  await axeRule(page, 'link-name', '.asme-sponsors-page');
});

for (const example of [
  { name: 'light Join form label', path: 'join/', scheme: 'light', selector: '.join-form-heading .join-eyebrow' },
  { name: 'dark About steps', path: 'aboutus/', scheme: 'dark', selector: '.about-semester-step > span' }
]) {
  test(example.name + ' passes text contrast', { timeout: 30_000 }, async t => {
    const page = await visit(t, example.path, { colorScheme: example.scheme });
    await axeRule(page, 'color-contrast', example.selector);
  });
}

test('the mobile homepage has tappable dots and rotates on its own', { timeout: 30_000 }, async t => {
  const page = await visit(t, '', { clock: true, reducedMotion: 'no-preference' });
  const dots = page.locator('.ah-hero-dot');
  assert.equal(await dots.count(), 5);
  const sizes = await dots.evaluateAll(elements => elements.map(element => {
    const { width, height } = element.getBoundingClientRect();
    return { width, height };
  }));
  assert.ok(sizes.every(({ width, height }) => width >= 24 && height >= 24), JSON.stringify(sizes));
  assert.equal(await page.locator('#ahDots > button').count(), 5);
  const currentPhoto = page.locator('.ah-hero-dot[aria-pressed="true"]');
  await page.clock.runFor(5500);
  assert.equal(await currentPhoto.getAttribute('aria-label'), 'Show slide 2');
  await dots.nth(2).click({ force: true });
  assert.equal(await currentPhoto.getAttribute('aria-label'), 'Show slide 3');
});

test('both desktop carousels rotate on their own and hold while pointed at', { timeout: 30_000 }, async t => {
  const page = await visit(t, '', { width: 1440, clock: true, reducedMotion: 'no-preference' });
  assert.equal(await page.locator('#ahDots > button').count(), 5);
  const currentPhoto = page.locator('.ah-hero-dot[aria-pressed="true"]');
  const currentSpotlight = page.locator('.ah-spotlight-dot[aria-selected="true"]');
  const firstSpotlight = await currentSpotlight.getAttribute('aria-label');
  await page.clock.runFor(7000);
  assert.equal(await currentPhoto.getAttribute('aria-label'), 'Show slide 2');
  assert.notEqual(await currentSpotlight.getAttribute('aria-label'), firstSpotlight);
  // Clicking a spotlight dot leaves the pointer over the hero: both pause.
  await page.locator('.ah-hero-dot').nth(2).click({ force: true });
  await page.locator('.ah-spotlight-dot').nth(0).click({ force: true });
  await page.clock.runFor(14000);
  assert.equal(await currentPhoto.getAttribute('aria-label'), 'Show slide 3');
  assert.equal(await currentSpotlight.getAttribute('aria-label'), firstSpotlight);
});

test('newsletter preserves rejected input and advances focus only on confirmed signup', { skip: live, timeout: 30_000 }, async t => {
  let requests = 0;
  const page = await visit(t, 'join/', {
    async routeRequest(route, url) {
      if (!url.hostname.endsWith('.sibforms.com') || route.request().method() !== 'POST') return false;
      requests += 1;
      const json = requests === 1 ? { success: false } : { success: true };
      await route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
      return true;
    }
  });
  const email = page.locator('#EMAIL');
  await page.locator('#FIRSTNAME').fill('Browser');
  await page.locator('#LASTNAME').fill('Test');
  await page.locator('#OSU_NUMBER').fill('browser.1');
  await page.locator('#GRADUATION_YEAR').fill('2028');
  await email.fill('browser.test@buckeyemail.osu.edu');
  await page.locator('.join-submit-button').click();
  const status = page.locator('#asmeNewsletterStatus');
  await status.filter({ hasText: 'could not be confirmed' }).waitFor();
  assert.equal(await email.inputValue(), 'browser.test@buckeyemail.osu.edu');
  await page.locator('.join-submit-button').click();
  await status.filter({ hasText: 'successfully added' }).waitFor();
  assert.equal(requests, 2);
  assert.equal(await page.locator('#joinGroupMeButton').evaluate(link => document.activeElement === link), true);
});

test('Join uses a full-width submit and Calendar includes Subscribe in its header', { timeout: 30_000 }, async t => {
  for (const width of [390, 1440]) {
    const join = await visit(t, 'join/', { width });
    assert.equal(await join.locator('#OSU_NUMBER').evaluate(input => input.required), true);
    assert.equal(await join.getByText('How we use your newsletter information', { exact: true }).count(), 0);
    const sizes = await join.locator('.join-submit-button').evaluate(button => ({
      button: button.getBoundingClientRect().width,
      form: button.closest('form').getBoundingClientRect().width
    }));
    assert.ok(Math.abs(sizes.form - sizes.button) < 2, JSON.stringify(sizes));
    const calendar = await visit(t, 'calendar/', { width });
    assert.equal(await calendar.locator('.acp-header .acp-subscribe-btn').isVisible(), true);
  }
});

test('Calendar feed outage offers a fallback and retry restores the upcoming list', { skip: live, timeout: 30_000 }, async t => {
  let requests = 0;
  const page = await visit(t, 'calendar/', {
    async routeRequest(route, url) {
      if (!url.pathname.endsWith('/data/calendar-events.json')) return false;
      requests += 1;
      if (requests === 1) await route.abort();
      else await route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { events: [{ title: 'Mock chapter event', start: '2090-11-19T21:00:00.000Z' }] }
      });
      return true;
    }
  });
  const grid = page.locator('#asmeCalendarUpcoming');
  const retry = grid.getByRole('button', { name: 'Retry event previews' });
  await retry.waitFor();
  assert.match(await grid.getByRole('link', { name: 'Open Google Calendar' }).getAttribute('href'), /^https:\/\/calendar\.google\.com\//);
  await retry.click();
  await grid.getByRole('heading', { name: 'Mock chapter event' }).waitFor();
  assert.equal(requests, 2);
  assert.equal(await grid.getAttribute('aria-busy'), 'false');
});
