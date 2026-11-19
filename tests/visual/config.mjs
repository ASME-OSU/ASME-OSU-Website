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

export const WIDTHS = [375, 768, 1280, 1920];
export const SCHEMES = ['light', 'dark'];

const settle = page => page.waitForTimeout(700);

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
    // The bootstrap restores the theme header when the component cannot load.
    name: 'header-fallback', page: 'home', width: 1280, viewportOnly: true, blockHeader: true,
    async run(page) { await page.waitForTimeout(4200); }
  }
];
