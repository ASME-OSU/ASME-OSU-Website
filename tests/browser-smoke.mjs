import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';
import axe from 'axe-core';
import { chromium } from 'playwright';

const live = process.argv.includes('--live');
const campusPressOrigin = 'https://org.osu.edu';
const origin = live ? campusPressOrigin : 'https://asme.test';
const pagesOrigin = 'https://asme-osu.github.io';
const publishedPath = '/ASME-OSU-Website/';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const fragments = new Map([
  ['', 'Home Page.html'],
  ['aboutus/', 'About Us Page.html'],
  ['calendar/', 'Calendar Page.html'],
  ['current-sponsors/', 'Current Sponsors Page.html'],
  ['sponsor-asme/', 'Sponsor ASME Page.html'],
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
  ['/_fixture/sponsor.js', ['application/javascript', read('Sponsor Integration.js')]],
  ['/ASME-OSU-Website/Join Page Integration.js', ['application/javascript', read('Join Page Integration.js')]]
]);

let browser;
before(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});
after(async () => { await browser?.close(); });

function fixture(path, mutate) {
  let markup = read(fragments.get(path));
  if (path === 'sponsor-asme/') {
    // CI checks the generated embed. Run its source here so browser tests exercise edits to it.
    const sponsorEmbed = /<!-- ASME SPONSOR INTEGRATION START -->[\s\S]*?<!-- ASME SPONSOR INTEGRATION END -->/;
    assert.match(markup, sponsorEmbed);
    markup = markup.replace(sponsorEmbed, '<script defer src="/_fixture/sponsor.js"></script>');
  }
  markup = mutate(markup);
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

async function visit(t, path, {
  width = 390, colorScheme = 'light', reducedMotion = 'reduce', mutate = markup => markup,
  routeRequest, clock = false, pageOrigin = origin, sessionStorage
} = {}) {
  const pageUrl = pageOrigin + '/asme/' + path;
  const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme, reducedMotion });
  t.after(() => page.close());
  if (!live) {
    // Context routing also intercepts the initial navigation of a new tab.
    await page.context().route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.href === pageUrl) return route.fulfill({ contentType: 'text/html', body: fixture(path, mutate) });
      const asset = localAssets.get(decodeURIComponent(url.pathname));
      if (asset) return route.fulfill({ contentType: asset[0], body: asset[1] });
      if (routeRequest && await routeRequest(route, url)) return;
      return route.abort();
    });
  }
  if (sessionStorage) {
    await page.addInitScript(entries => {
      for (const [key, value] of Object.entries(entries)) window.sessionStorage.setItem(key, value);
    }, sessionStorage);
  }
  if (clock) {
    await page.clock.install({ time: new Date('2026-11-17T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-17T12:01:00Z'));
  }
  const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
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

async function checkSponsorDraft(form, fieldPrefix, { company, contact, email, tier, message }) {
  const fields = { company, contact, email, tier, message };
  for (const [name, value] of Object.entries(fields)) {
    const field = form.locator(fieldPrefix + name);
    assert.equal(await field.isVisible(), true, name + ' field is visible');
    if (name === 'tier') await field.selectOption(value);
    else await field.fill(value);
    assert.equal(await field.inputValue(), value);
  }

  const draft = form.locator('.sponsor-form-submit');
  assert.match(await draft.innerText(), /Open email draft/);
  const href = await draft.getAttribute('href');
  assert.match(href, /^mailto:asme@osu\.edu\?subject=[^&]+&body=/);
  const params = new URL(href).searchParams;
  const subject = params.get('subject');
  const body = params.get('body');
  assert.ok(subject.includes(company) && subject.includes(tier), 'draft subject includes the company and tier');
  for (const detail of [company, contact, email, tier, message]) {
    assert.ok(body.includes(detail), 'draft body includes ' + detail);
  }
}

test('Sponsor tier modal preselects the tier, builds a draft, and traps and restores focus', { skip: live, timeout: 30_000 }, async t => {
  const page = await visit(t, 'sponsor-asme/');
  const html = page.locator('html');
  const modal = page.locator('#sponsor-modal');
  const opener = page.locator('.sponsor-tier-cta[data-sponsor-tier="Scarlet ($500)"]');
  const otherOpener = page.locator('.sponsor-tier-cta[data-sponsor-tier="Gray ($250)"]');
  const close = modal.locator('button[data-sponsor-modal-close]');
  const form = modal.locator('[data-sponsor-form]');
  const company = form.locator('#sif-modal-company');
  const draft = form.locator('.sponsor-form-submit');

  assert.equal(await modal.isHidden(), true);
  await opener.click();
  assert.equal(await modal.isVisible(), true);
  assert.equal(await html.evaluate(node => node.classList.contains('sponsor-modal-open')), true);
  assert.equal(await form.locator('#sif-modal-tier').inputValue(), await opener.getAttribute('data-sponsor-tier'));
  assert.equal(await company.evaluate(field => document.activeElement === field), true);
  await checkSponsorDraft(form, '#sif-modal-', {
    company: 'Modal Engineering & Design', contact: 'Renée Park', email: 'renee+modal@example.test',
    tier: 'Buckeye ($1,000)', message: 'Test rigs & prototypes?\nWe would like to visit.'
  });

  await draft.focus();
  await page.keyboard.press('Tab');
  assert.equal(await close.evaluate(button => document.activeElement === button), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await draft.evaluate(link => document.activeElement === link), true);

  await close.click();
  assert.equal(await modal.evaluate(dialog => dialog.hidden), true);
  assert.equal(await html.evaluate(node => node.classList.contains('sponsor-modal-open')), false);
  assert.equal(await opener.evaluate(button => document.activeElement === button), true);

  await otherOpener.click();
  assert.equal(await form.locator('#sif-modal-tier').inputValue(), await otherOpener.getAttribute('data-sponsor-tier'));
  await page.keyboard.press('Escape');
  assert.equal(await modal.evaluate(dialog => dialog.hidden), true);
  assert.equal(await html.evaluate(node => node.classList.contains('sponsor-modal-open')), false);
  assert.equal(await otherOpener.evaluate(button => document.activeElement === button), true);
});

test('Inline sponsor form builds its own email draft from all five fields', { skip: live, timeout: 30_000 }, async t => {
  const page = await visit(t, 'sponsor-asme/');
  const form = page.locator('[data-sponsor-form]').filter({ has: page.locator('#sif-company') });
  await checkSponsorDraft(form, '#sif-', {
    company: 'Inline Fabrication & Supply', contact: 'Ana López', email: 'ana+inline@example.test',
    tier: 'Brutus ($5,000)', message: 'Can we bring parts & samples?\nPlease send the details.'
  });
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
  // The photo fading out keeps its cover framing; it once lost it and showed
  // the top of the photo (the sky) for the 1.2 s fade.
  const leaving = await page.evaluate(() => {
    const img = document.querySelectorAll('.ah-hero-slide')[1].querySelector('img');
    const s = getComputedStyle(img);
    return `${s.position} ${s.objectFit}`;
  });
  assert.equal(leaving, 'absolute cover');
  await page.locator('.ah-spotlight-dot').nth(0).click({ force: true });
  await page.clock.runFor(14000);
  assert.equal(await currentPhoto.getAttribute('aria-label'), 'Show slide 3');
  assert.equal(await currentSpotlight.getAttribute('aria-label'), firstSpotlight);
});

function isNewsletterPost(route, url) {
  return url.hostname.endsWith('.sibforms.com') && route.request().method() === 'POST';
}

async function mockNewsletter(route, success) {
  await route.fulfill({ json: { success }, headers: { 'access-control-allow-origin': '*' } });
}

async function fillNewsletter(page) {
  await page.locator('#FIRSTNAME').fill('Browser');
  await page.locator('#LASTNAME').fill('Test');
  await page.locator('#OSU_NUMBER').fill('browser.1');
  await page.locator('#GRADUATION_YEAR').fill('2028');
  await page.locator('#EMAIL').fill('browser.test@buckeyemail.osu.edu');
}

test('newsletter preserves rejected input and advances focus only on confirmed signup', { skip: live, timeout: 30_000 }, async t => {
  let requests = 0;
  const page = await visit(t, 'join/', {
    async routeRequest(route, url) {
      if (!isNewsletterPost(route, url)) return false;
      requests += 1;
      await mockNewsletter(route, requests > 1);
      return true;
    }
  });
  const email = page.locator('#EMAIL');
  await fillNewsletter(page);
  await page.locator('.join-submit-button').click();
  const status = page.locator('#asmeNewsletterStatus');
  await status.filter({ hasText: 'could not be confirmed' }).waitFor();
  assert.equal(await email.inputValue(), 'browser.test@buckeyemail.osu.edu');
  await page.locator('.join-submit-button').click();
  await status.filter({ hasText: 'successfully added' }).waitFor();
  assert.equal(requests, 2);
  assert.equal(await page.locator('#joinGroupMeButton').evaluate(link => document.activeElement === link), true);
});

test('Join marks the newsletter complete and unlocks the welcome card after GroupMe', { skip: live, timeout: 30_000 }, async t => {
  const celebrationScripts = ['celebration.js', 'assets/celebration/experience.js'];
  let newsletterRequests = 0;
  let groupMeRequests = 0;
  const page = await visit(t, 'join/', {
    async routeRequest(route, url) {
      if (isNewsletterPost(route, url)) {
        newsletterRequests += 1;
        await mockNewsletter(route, true);
        return true;
      }
      if (url.hostname === 'groupme.com') {
        groupMeRequests += 1;
        await route.fulfill({ contentType: 'text/html', body: '<title>Mock GroupMe</title>' });
        return true;
      }
      const file = url.pathname.slice(publishedPath.length);
      if (url.origin === pagesOrigin && url.pathname.startsWith(publishedPath) && celebrationScripts.includes(file)) {
        await route.fulfill({ contentType: 'application/javascript', body: read(file) });
        return true;
      }
      return false;
    }
  });
  const newsletter = page.locator('#joinNewsletterStep');
  const groupMe = page.locator('#joinGroupMeStep');
  const welcome = page.locator('#asme-groupme-return .asme-return-confirm');
  assert.equal(await welcome.innerText(), 'Join GroupMe first');
  assert.equal(await welcome.isDisabled(), true);

  await fillNewsletter(page);
  await page.locator('.join-submit-button').click();
  await page.locator('#asmeNewsletterStatus').filter({ hasText: 'successfully added' }).waitFor();
  assert.equal(newsletterRequests, 1);
  assert.equal(await newsletter.evaluate(step => step.classList.contains('is-complete')), true);
  assert.equal(await groupMe.evaluate(step => step.classList.contains('is-ready')), true);
  assert.equal(await groupMe.evaluate(step => step.classList.contains('is-visited')), false);
  assert.equal(await welcome.isDisabled(), true);

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('#joinGroupMeButton').click()
  ]);
  await popup.waitForLoadState('domcontentloaded');
  assert.equal(await popup.title(), 'Mock GroupMe');
  assert.equal(groupMeRequests, 1);
  await popup.close();
  assert.equal(await groupMe.evaluate(step => step.classList.contains('is-visited')), true, 'GroupMe step is marked visited');
  await page.locator('#asme-groupme-return .asme-return-confirm:enabled').waitFor();
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

test('Gearly resumes a saved tour on page load and waits for interaction on a fresh visit', { skip: live, timeout: 30_000 }, async t => {
  const data = JSON.parse(read('assets/gearly/gearly-data.json'));
  const index = data.tour.steps.findIndex(step => step.page === campusPressOrigin + '/asme/join/');
  assert.ok(index > 0 && index < data.tour.steps.length - 1, 'Join is a tour stop with Back and Next');
  const step = data.tour.steps[index];
  const contentTypes = new Map([
    ['js', 'application/javascript'], ['json', 'application/json'],
    ['css', 'text/css'], ['webp', 'image/webp']
  ]);
  const prefix = publishedPath + 'assets/gearly/';
  const options = {
    // The production tour validates the CampusPress origin. All requests are intercepted.
    pageOrigin: campusPressOrigin,
    mutate: markup => read('Gearly Embed.html') + markup,
    async routeRequest(route, url) {
      if (url.origin !== pagesOrigin || !url.pathname.startsWith(prefix)) return false;
      const file = url.pathname.slice(prefix.length);
      const contentType = contentTypes.get(file.split('.').at(-1));
      if (!contentType || !/^(?:sprites\/)?[\w.-]+$/.test(file)) return false;
      const asset = new URL('../assets/gearly/' + file, import.meta.url);
      if (!fs.existsSync(asset)) return false;
      await route.fulfill({ contentType, body: fs.readFileSync(asset), headers: { 'access-control-allow-origin': '*' } });
      return true;
    }
  };
  const resumed = await visit(t, 'join/', {
    ...options,
    sessionStorage: {
      ['asme-gearly-tour-' + data.tour.version + '-session']: JSON.stringify({
        index, direction: 1, to: step.page, expires: Date.now() + 60_000
      })
    }
  });
  const card = resumed.getByRole('dialog', { name: step.title });
  await card.waitFor({ timeout: 5_000 });
  assert.equal(await card.getByRole('button', { name: 'Back', exact: true }).isVisible(), true);
  assert.equal(await card.getByRole('button', { name: 'Next', exact: true }).isVisible(), true);
  assert.equal(await resumed.locator('.gearly-tour-ring').isVisible(), true);

  const fresh = await visit(t, 'join/', options);
  const launcher = fresh.getByRole('button', { name: 'Open Gearly, ASME website guide' });
  await launcher.waitFor();
  await fresh.waitForLoadState('load');
  assert.equal(await fresh.locator('script[src*="/gearly-tour.js"]').count(), 0, 'fresh visit has not requested the guide');
  assert.equal(await fresh.locator('.gearly-tour-tip').count(), 0);
  await launcher.click();
  await fresh.getByRole('dialog', { name: 'Gearly website guide' }).waitFor();
});
