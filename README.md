# Ohio State ASME Website

This repository is the source of truth for the custom HTML and CSS used on the Ohio State ASME WordPress site:

https://org.osu.edu/asme/

The live site runs on WordPress with GeneratePress. CSS is loaded from this GitHub repository. Page HTML files are still copy/paste blocks that must be pasted into the matching WordPress page editor.

## Live CSS

WordPress should load the main stylesheet from jsDelivr:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/ASME-OSU/ASME-OSU-Website@main/ASME%20Custom%20CSS.css?v=20260610">
```

The `v=` value is only a cache-buster. Increment it when the live site keeps showing stale CSS.

After pushing CSS changes, purge jsDelivr:

```bash
curl -sS --connect-timeout 10 "https://purge.jsdelivr.net/gh/ASME-OSU/ASME-OSU-Website@main/ASME%20Custom%20CSS.css"
```

Then hard refresh the site.

## Files

| File | WordPress location | Purpose |
| --- | --- | --- |
| `ASME Custom CSS.css` | Header stylesheet link from GitHub/jsDelivr | Site-wide styling, responsive fixes, dark mode, navigation, footer, and page-specific polish. |
| `Home Page.html` | Home page custom HTML block | Home hero, stats, quick links, and event preview content. |
| `About Us Page.html` | About page custom HTML block | About ASME OSU content, mission, and pillars. |
| `Join Page.html` | Join page custom HTML block | Join/signup content and FAQ. |
| `Sponsor ASME Page.html` | Sponsor ASME page custom HTML block | Corporate sponsorship information and calls to action. |
| `Member Resources Page.html` | Member Resources page custom HTML block | Member resource hub, SVG resource cards, jump links, career links, forms, and chapter resources. |
| `Member Points Page.html` | Member Points page custom HTML block | Live Google Sheets-backed point values, system status, privacy-safe leaderboard, and member explanation. |
| `Footer.html` | GeneratePress footer element/snippet | Custom footer markup and client-side scripts, if used on the WordPress site. |
| `Member Points Integration.js` | Loaded by `Footer.html` from jsDelivr | Reads only the sanitized Website Export Google Sheet and renders point values/status/leaderboard on the Member Points page. |
| `Leadership Page.html` | Leadership page custom HTML block | Officer/leadership layout, if maintained in WordPress. |
| `Gallery Page.html` | Gallery page custom HTML block | Gallery layout, if maintained in WordPress. |
| `Gallery Integration.js` | Loaded by the Gallery page from GitHub Pages | Renders the latest Instagram feed, labels archive photos, and powers gallery filters. |
| `data/instagram-feed.json` | Public GitHub Pages data file | Cached Instagram media used by the Gallery page, with static fallback content when Instagram is unavailable. |
| `Current Sponsors Page.html` | Sponsors page custom HTML block | Sponsor listing layout, if maintained in WordPress. |

## Update Workflow

1. Edit the file in this repo.
2. Commit the change.
3. Push to `main`.
4. If CSS changed, purge jsDelivr.
5. If HTML changed, paste the updated HTML file into the matching WordPress page editor.
6. Hard refresh the browser.

Example:

```bash
git add "ASME Custom CSS.css" "Member Resources Page.html"
git commit -m "Update member resources page"
git push origin main
curl -sS --connect-timeout 10 "https://purge.jsdelivr.net/gh/ASME-OSU/ASME-OSU-Website@main/ASME%20Custom%20CSS.css"
```

## Mobile Gutters

Custom pages should use one consistent mobile page gutter: `16px` on each side.

The final CSS block labeled `MOBILE GUTTER STANDARD` enforces this with:

```css
width: calc(100vw - 32px);
max-width: calc(100vw - 32px);
```

Use the existing page wrapper classes, such as `asme-home`, `asme-about-page`, `asme-join-page`, `asme-member-resources-page`, and `asme-members-page`, instead of adding one-off width rules. If a page looks edge-to-edge on mobile, fix it in the shared gutter rule rather than adding a separate page-specific patch.

## Automatic Instagram Gallery

The Gallery page reads `data/instagram-feed.json` through `Gallery Integration.js`. The static Instagram cards in `Gallery Page.html` remain as a resilient fallback, so the Gallery never becomes empty when the API or network is unavailable.

The `Update Instagram gallery` GitHub Actions workflow refreshes the feed every six hours. To enable scheduled refreshes, add a repository Actions secret named `INSTAGRAM_ACCESS_TOKEN` containing an Instagram API access token for the `@asmeohiostate` professional account. The token is used only by GitHub Actions and must never be placed in page HTML, JavaScript, or the public JSON file.

The workflow commits only when post data changes. A new commit automatically updates the GitHub Pages feed consumed by WordPress.

## WordPress Auto-Formatting (`wpautop`)

WordPress can automatically insert `<p>` and `<br>` elements when custom page HTML is saved in the Classic Editor. This is a recurring source of layout bugs on this site. The repository HTML may look correct locally while the live WordPress DOM contains additional elements.

This is especially disruptive inside CSS grid and flex components. A direct `<br>` can become an unintended grid row, making a card taller or pushing its real content toward the top. Empty paragraphs can also create unexplained gaps between cards or sections.

Typical symptoms include:

- content that is vertically off-center only on the live site;
- unexplained space below cards or sections;
- grid rows that are taller than their configured minimum height;
- a local preview that does not match WordPress.

When diagnosing one of these issues, inspect the live DOM—not only the HTML file—and check for direct `BR` or empty `P` children. Also compare their computed `display`, height, grid row, and margins.

Use narrowly scoped defensive rules such as:

```css
/* WordPress may insert paragraphs between grid children. */
.component-grid > p {
  display: none !important;
}

/* A direct break inside a grid card becomes a phantom grid row. */
.component-card > br {
  display: none !important;
}
```

Do not use a broad rule such as `.component-card p { display: none; }`; legitimate descriptions are also paragraphs. Scope cleanup selectors to a specific page and direct-child relationship. If an empty paragraph has no measurable height, leave it alone rather than risking real content.

For the Current Sponsors page, the relevant protection is near the end of `ASME Custom CSS.css` and hides direct WordPress-inserted breaks inside `.sponsor-card-primary`. After any sponsor-card markup change, verify both the local preview and the live WordPress DOM before adjusting card heights or padding.

## Member Pages

The member pages are sensitive to GeneratePress heading defaults. For compact section labels, use classed paragraph tags such as:

```html
<p class="asme-resource-group-title">Getting Started</p>
```

Avoid `h2`, `h3`, and `h4` for small component labels unless the CSS override is scoped with `body #page`. GeneratePress applies heading margins that can push the count badges out of line.

For Member Resources:

- Keep resource card icons as inline SVG inside `.asme-resource-svg-icon`; do not depend on Flaticon, emoji, or an external icon CDN.
- Keep the resource jump links in `.asme-jump-nav`.
- Use `.asme-member-grid--2col` for two-card groups so the cards do not stretch awkwardly across a three-column grid.

For Member Points:

- Keep the leaderboard title as `.asme-leaderboard-title` on a paragraph tag.
- Keep the dark footer transition rule near the bottom of `ASME Custom CSS.css`; it prevents the WordPress footer shell from showing a light band between the page and footer in dark mode.
- The page reads only the sanitized Website Export Sheet: `Leaderboard_Public!A:G`, `Point_Values_Public!A:F`, and `System_Status!A:B`. The private master workbook, roster, form responses, emails, and name.number values must never be linked from the website.
- The export must be status-gated so it contains headers/blank rows while `System_Status` is `TESTING` or `PAUSED`. The page also hides names unless status is `LIVE`.
- Before launch, make only the sanitized Website Export Sheet viewable by link, paste the updated `Member Points Page.html` into WordPress, paste the updated `Footer.html` into the GeneratePress footer element, push the JS/CSS files, purge jsDelivr, and hard refresh.

If a Claude/Codex handoff includes a full CSS dump, do not paste it over the live stylesheet. Cherry-pick the specific rules needed, then run the CSS checks and verify the affected page.

## Notes

- CSS updates go live from GitHub/jsDelivr after push and cache purge.
- HTML updates do not automatically deploy to WordPress.
- The Member Resources page uses inline SVG icons. If the live site shows letter badges instead of icons, the WordPress HTML is stale and needs the latest `Member Resources Page.html` pasted into the editor.
- The Member Resources page includes links for ASME student membership, ASME OSU chapter signup, the ASME OSU Career Packet, ECS advising, co-ops/internships, Handshake, LinkedIn, events, and board contact.
