// Pages, viewports and interaction states covered by the visual regression suite.
// Widths match the planned breakpoints: phone, tablet, laptop, widescreen.

export const ORIGIN = 'https://org.osu.edu';

export const PAGES = [
  { name: 'home', path: '/asme/' },
  { name: 'about', path: '/asme/aboutus/' },
  { name: 'join', path: '/asme/join/' },
  { name: 'calendar', path: '/asme/calendar/' },
  { name: 'gallery', path: '/asme/pictures/' },
  { name: 'leadership', path: '/asme/leadership/' },
  { name: 'sponsor-asme', path: '/asme/sponsor-asme/' },
  { name: 'current-sponsors', path: '/asme/current-sponsors/' },
  { name: 'member-resources', path: '/asme/member-resources/' },
  { name: 'member-points', path: '/asme/member-points-page/' },
  { name: 'privacy', path: '/asme/privacy-policy/' },
  { name: 'blog', path: '/asme/blog/' }
];

// VISUAL_WIDTHS=480,900 runs the suite at other widths (in-between checks).
export const WIDTHS = process.env.VISUAL_WIDTHS ? process.env.VISUAL_WIDTHS.split(',').map(Number) : [375, 768, 1280, 1920];
export const SCHEMES = ['light', 'dark'];

const settle = page => page.waitForTimeout(700);
// Full-page screenshots include the fixed header at the current scroll offset.
const scrollToTop = page => page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

// Click a disclosure toggle until it reports aria-expanded="true"; the header
// script may not have wired the button yet on the first click.
async function expand(page, selector) {
  const toggle = page.locator(selector).first();
  await toggle.waitFor({ state: 'visible', timeout: 10_000 });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await toggle.getAttribute('aria-expanded') === 'true') break;
    await toggle.click();
    await page.waitForTimeout(400);
  }
  if (await toggle.getAttribute('aria-expanded') !== 'true') throw new Error(`${selector} did not open`);
  await settle(page);
}

// States that only appear after interaction. Each runs in light and dark.
// Header overlays close on resize, and full-page screenshots resize the window,
// so overlay states are captured at viewport size.
export const STATES = [
  {
    name: 'menu-open', page: 'home', width: 375, viewportOnly: true,
    run: page => expand(page, '.asme-hd-menu-toggle')
  },
  {
    name: 'search-open', page: 'home', width: 1280, viewportOnly: true,
    run: page => expand(page, '.asme-hd-search-toggle')
  },
  {
    name: 'faq-open', page: 'join', width: 768,
    async run(page) {
      await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
      await settle(page);
    }
  },
  {
    name: 'lightbox', page: 'gallery', width: 1280, viewportOnly: true,
    async run(page) {
      const trigger = page.locator('.asme-gallery-page .gallery-item a, .asme-gallery-page a[href$=".jpg"], .asme-gallery-page a[href$=".webp"]').first();
      await trigger.click();
      await page.locator('.asme-lightbox.active, .asme-lightbox.is-open').first().waitFor({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(900);
    }
  },
  {
    // The hero's highlight card after switching to its second slide (the
    // Career Guide); the script moves is-active between the two slides.
    name: 'spotlight-2', page: 'home', width: 1280, viewportOnly: true,
    async run(page) {
      await page.locator('.ah-spotlight-dot').nth(1).click();
      await page.waitForTimeout(900);
    }
  },
  {
    // The leaderboard's loading skeleton, as the page shows it before the
    // points data arrives (markup from Member Points Integration.js).
    name: 'leaderboard-loading', page: 'member-points', width: 1280,
    async run(page) {
      await page.evaluate(() => {
        const bar = '<span class="asme-points-skeleton-bar"></span>';
        const cell = name => `<span class="asme-leaderboard-${name}">${bar}</span>`;
        const row = `<div class="asme-leaderboard-row asme-points-skeleton-row" aria-hidden="true">${['rank', 'avatar', 'member', 'meta', 'score'].map(cell).join('')}</div>`;
        document.querySelector('#asmeLeaderboardRows').innerHTML = '<span class="asme-points-loading-label">Loading leaderboard…</span>' + row.repeat(10);
      });
      await settle(page);
    }
  },
  {
    // The bootstrap restores the theme header when the component cannot load.
    name: 'header-fallback', page: 'home', width: 1280, viewportOnly: true, blockHeader: true,
    async run(page) { await page.waitForTimeout(4200); }
  },
  {
    name: 'sponsor-modal-open', page: 'sponsor-asme', width: 1280, viewportOnly: true,
    async run(page) {
      await page.locator('.sponsor-tier-cta').first().click();
      await page.locator('#sponsor-modal').waitFor({ state: 'visible' });
    }
  },
  {
    name: 'faq-open-mobile', page: 'join', width: 375,
    async run(page) {
      const faq = page.locator('.join-faq-section details').first();
      await faq.locator('summary').click();
      await page.locator('.join-faq-section details:first-of-type[open]').first().waitFor({ state: 'visible' });
      await scrollToTop(page);
    }
  },
  {
    name: 'calendar-alternate-view', page: 'calendar', width: 1280,
    async run(page) {
      await page.locator('[data-calendar-mode="AGENDA"]').click();
      await page.locator('[data-calendar-mode="AGENDA"][aria-pressed="true"]').waitFor();
      await page.locator('#asmeCalendarFrame[src*="mode=AGENDA"]').waitFor();
    }
  },
  {
    name: 'gallery-filter-selected', page: 'gallery', width: 1280,
    async run(page) {
      await page.locator('[data-gallery-filter="industry"]').click();
      await page.locator('[data-gallery-filter="industry"][aria-pressed="true"]').waitFor();
      await page.locator('.gallery-item[data-gallery-category="industry"]:not(.is-filtered-out)').first().waitFor();
      await page.locator('.gallery-item.is-filtered-out').first().waitFor({ state: 'attached' });
      await scrollToTop(page);
    }
  },
  {
    name: 'leaderboard-row-selected', page: 'member-points', width: 1280,
    async run(page) {
      await page.locator('#asmeLeaderboardRows .asme-leaderboard-row[role="button"]').first().click();
      await page.locator('#asmeMemberDashboardPanel:not([hidden])').waitFor({ state: 'visible' });
    }
  },
  {
    name: 'gearly-panel-open', page: 'home', width: 1280, viewportOnly: true,
    async run(page) {
      await page.getByRole('button', { name: 'Open Gearly, ASME website guide' }).click();
      await page.getByRole('dialog', { name: 'Gearly website guide' }).waitFor({ state: 'visible' });
    }
  }
];
