# Commit-pinned asset caching

CampusPress currently loads the chapter's shared stylesheet and scripts from GitHub Pages. A future release can use jsDelivr URLs that include the full Git commit SHA. Browsers can reuse those bytes for a year, and a new release changes the URL when the bytes change. GitHub Pages remains available for rollback and continues serving the live feeds.

## Measured cache headers

Measured with `curl -sI` on November 27, 2026 at 2:15 p.m. Central, against [main at `6443775`](https://github.com/ASME-OSU/ASME-OSU-Website/commit/6443775cbb83132f816b1ff34bdd2642001c55cf). The GitHub Pages entry URLs include the `?v=` values from the public HTML. The other Pages requests use bare URLs. Every jsDelivr URL uses the full commit SHA and the same path, with no query string. All 44 pairs returned HTTP 200.

| Host | Cache-Control for every row below |
| --- | --- |
| GitHub Pages | `max-age=600` |
| jsDelivr | `public, max-age=31536000, s-maxage=31536000, immutable` |

`Age` is in seconds. A dash means the response omitted the header. The ETags are recorded as returned, including jsDelivr's weak `W/` prefix. Use the release checker to compare bytes across providers.

### WordPress script and stylesheet entrypoints

| Path | Pages Age | Pages ETag | jsDelivr Age | jsDelivr ETag |
| --- | ---: | --- | ---: | --- |
| `ASME Custom CSS.min.css` | 0 | `"6b09e433-9face"` | 93 | `W/"9face-c5ae2b7936178308"` |
| `Header.css` | 0 | `"6b09e433-4feb"` | — | `W/"4feb-5c6183b1e7071799"` |
| `Header Integration.js` | 0 | `"6b09e433-5d81"` | — | `W/"5d81-b3c3d0b3eb93116c"` |
| `Footer Integration.js` | 0 | `"6b09e433-3885"` | — | `W/"3885-7122ff4e89285913"` |
| `Calendar Integration.js` | 0 | `"6b09e433-41c2"` | — | `W/"41c2-1dae6d0d936f5ac3"` |
| `Member Points Integration.js` | 0 | `"6b09e433-936d"` | — | `W/"936d-8c52ac20ea7b615d"` |
| `assets/gearly/gearly.css` | 0 | `"6b09e433-2e13"` | — | `W/"2e13-379491556da987e3"` |
| `assets/gearly/gearly-bootstrap.js` | 0 | `"6b09e433-12c1"` | — | `W/"12c1-c3f0ab8abcc193a9"` |
| `Gallery Integration.js` | 0 | `"6b09e433-70d6"` | — | `W/"70d6-c0be486880bc9a41"` |
| `Join Page Integration.js` | 0 | `"6b09e433-152f"` | — | `W/"152f-e45cf551fb829ced"` |
| `celebration.js` | 0 | `"6b09e433-9a9"` | — | `W/"9a9-2d75dc7db0f2bbfb"` |

### Responsive hero images referenced by the shared footer

| Path | Pages Age | Pages ETag | jsDelivr Age | jsDelivr ETag |
| --- | ---: | --- | ---: | --- |
| `assets/optimized/home/career-fair-640.webp` | 0 | `"6b09e433-540e"` | — | `W/"540e-9e2bb4753b558ee9"` |
| `assets/optimized/home/career-fair-960.webp` | 0 | `"6b09e433-95b8"` | — | `W/"95b8-f970aeeb5214383d"` |
| `assets/optimized/home/career-fair-1440.webp` | 0 | `"6b09e433-109dc"` | — | `W/"109dc-cc4d7cc4d478c034"` |
| `assets/optimized/home/career-fair-1920.webp` | 0 | `"6b09e433-1b29e"` | — | `W/"1b29e-792fa3d10e6b75c0"` |
| `assets/optimized/home/pickleball-group-640.webp` | 0 | `"6b09e433-6512"` | — | `W/"6512-f086a1c281640e4b"` |
| `assets/optimized/home/pickleball-group-960.webp` | 0 | `"6b09e433-b8e8"` | — | `W/"b8e8-49c4524fcc0a92af"` |
| `assets/optimized/home/pickleball-group-1440.webp` | 0 | `"6b09e433-14bc0"` | — | `W/"14bc0-0504592eb7862e63"` |
| `assets/optimized/home/spring-career-fair-480.webp` | 0 | `"6b09e433-e49e"` | — | `W/"e49e-a6a2c2e825504cf9"` |
| `assets/optimized/home/spring-career-fair-768.webp` | 0 | `"6b09e433-21b4a"` | — | `W/"21b4a-11fdbc749bf4dfff"` |
| `assets/optimized/home/spring-career-fair-1100.webp` | 0 | `"6b09e433-41336"` | — | `W/"41336-735246c2464df9d8"` |
| `assets/optimized/home/spring-career-fair-1440.webp` | 0 | `"6b09e433-705ce"` | — | `W/"705ce-dbda88f008fbd820"` |
| `assets/optimized/home/chapter-meeting-480.webp` | 0 | `"6b09e433-6e68"` | — | `W/"6e68-52f8df00f2c972f8"` |
| `assets/optimized/home/chapter-meeting-768.webp` | 0 | `"6b09e433-ce4c"` | — | `W/"ce4c-6bd8c58b364a9b75"` |
| `assets/optimized/home/chapter-social-640.webp` | 0 | `"6b09e433-aa8c"` | — | `W/"aa8c-992c6b58732af65a"` |
| `assets/optimized/home/chapter-social-960.webp` | 0 | `"6b09e433-137a0"` | — | `W/"137a0-662b9bd2a534f621"` |
| `assets/optimized/home/chapter-social-1380.webp` | 0 | `"6b09e433-21676"` | — | `W/"21676-0e072df5d3f38cbe"` |

### CSS and bundle dependencies and public data

| Path | Pages Age | Pages ETag | jsDelivr Age | jsDelivr ETag |
| --- | ---: | --- | ---: | --- |
| `assets/groupme-mark.svg` | 0 | `"6b09e433-4ec"` | — | `W/"4ec-24489ca891be9ec6"` |
| `assets/celebration/experience.js` | 0 | `"6b09e433-6d1ac"` | — | `W/"6d1ac-c7e08922d5e0bb51"` |
| `assets/celebration/chapter-logo.webp` | 0 | `"6b09e433-17ab8"` | — | `W/"17ab8-d33d4ebc7e0d49e6"` |
| `assets/gearly/gearly-data.json` | 0 | `"6b09e433-e097"` | — | `W/"e097-831e206a78cc822e"` |
| `assets/gearly/gearly.js` | 0 | `"6b09e433-160e2"` | — | `W/"160e2-174e417c4c281d1e"` |
| `assets/gearly/gearly-tour.css` | 0 | `"6b09e433-6212"` | — | `W/"6212-112d1b2c5958fa4b"` |
| `assets/gearly/gearly-index.json` | 0 | `"6b09e433-ccc1"` | — | `W/"ccc1-7b505fe5bccc1000"` |
| `assets/gearly/gearly-site.json` | 0 | `"6b09e433-5e71"` | — | `W/"5e71-db51ed360cbac6a3"` |
| `assets/gearly/gearly-officers.json` | 0 | `"6b09e433-2e66"` | — | `W/"2e66-0daf5429c1d2ba35"` |
| `assets/gearly/sprites/gearly-centered-idle.webp` | 0 | `"6b09e433-15ee"` | — | `W/"15ee-64f8d8b5f13ccd1b"` |
| `data/calendar-events.json` | 0 | `"6b09e433-463a"` | — | `W/"463a-315bbefc08cd98b6"` |
| `data/calendar-history.json` | 0 | `"6b09e433-512a"` | — | `W/"512a-eb9856a6228379eb"` |
| `data/instagram-feed.json` | 0 | `"6b09e433-16e5"` | — | `W/"16e5-893e56a815d58b8c"` |
| `data/google-photos-feed.json` | 0 | `"6b09e433-1a0d"` | — | `W/"1a0d-71584b593a209935"` |
| `data/google-photos-titles.json` | 0 | `"6b09e433-17c"` | — | `W/"17c-46075d5efba13bb1"` |
| `data/points-source.json` | 0 | `"6b09e433-76"` | — | `W/"76-15348deec0486239"` |
| `data/leaderboard-rank-snapshots.json` | 0 | `"6b09e433-19c3"` | — | `W/"19c3-0676e2bd15602b8b"` |

## Compatibility findings

| File or bundle | What happens if the URL moves |
| --- | --- |
| `ASME Custom CSS.min.css` | The stylesheet has no CDN-relative URLs. It still requests DM Sans and DM Serif Display from Google Fonts, the GroupMe mark from GitHub Pages, and embedded data URLs. |
| `Header.css`, `Header Integration.js` | The stylesheet has no URL dependencies. The script reads the current WordPress document, menu, logo, and path. Change both the Header Tag preloads and the Footer's stylesheet and script so each pair uses the same URL. |
| `Footer Integration.js` | The script modifies the WordPress DOM and uses absolute links for CampusPress, the footer logo, and social destinations. Its own URL does not influence them. The inline footer's hero `src` and `srcset` still use the GitHub Pages photo base unless that base changes separately. |
| `Calendar Integration.js` | The production script still reads `data/calendar-events.json` from GitHub Pages with an hourly query value and fetches the public ASME Social Hub archive from its own Pages project. Its localhost-only data path resolves against the preview document. |
| `Member Points Integration.js` | The script still fetches the live public source manifest and leaderboard history from GitHub Pages and uses the approved Google Sheets export via JSONP. Keep those endpoints on their existing hosts. |
| `Gallery Integration.js` | The script still fetches the Instagram and Google Photos feeds from GitHub Pages. Photo and thumbnail URLs come from those feeds. Media paths that need a base resolve against the WordPress document. |
| `Join Page Integration.js` | The newsletter request uses the Brevo form's action, with CORS and credentials omitted. Serving the classic script from jsDelivr leaves the request's page origin on CampusPress. |
| `celebration.js` | The loader derives `assets/celebration/experience.js` from its own script URL and forwards its query string. The experience loads the logo relative to its own URL. Both follow the commit when the entrypoint moves. The card renderer requests the logo with anonymous CORS to keep canvas export available. |
| `assets/gearly/gearly.css`, `assets/gearly/gearly-bootstrap.js` | The bootstrap derives its base from `document.currentScript.src` and passes `?v=` to dependent scripts and tour CSS when one is present. Its sprites, engine, search index, editorial data, and fallback snapshots follow the same commit path. Switch the bootstrap and stylesheet as a pair. The core may add its own version query when the entrypoint has none. Optional Fuse.js still comes from its existing CDN. |
| Gearly live data and site access | `gearly-data.json` supplies a GitHub Pages feed base, so the calendar, Instagram, gallery and related JSON stay live. Public points queries still use Google Sheets. Keep the Pages feed base and image hosts intact. Live page discovery, leadership and the tour validate the CampusPress **document** origin. Moving scripts to a CDN preserves that origin. |

Both hosts returned matching content types and `Access-Control-Allow-Origin: *` for every measured asset, including Gearly JSON and the celebration logo. The public homepage response had no Content Security Policy or Cross-Origin Embedder Policy header at the time of measurement. The byte check does not exercise CampusPress after a URL change. Confirm the public result in a browser when the switch is approved.

## Optional CampusPress switch

1. Use a published, merged commit on `main`. Run `git pull --ff-only` and then `npm run release:urls` in the repository. The command prints the exact URLs for `HEAD` and exits nonzero if jsDelivr does not return HTTP 200 with the same bytes Git stores for any listed path. Keep the previous release URLs and back up the current WordPress fields.
2. Under **Settings → Advanced Settings → Additional code**, edit the matching URL values in the table. Preserve the existing tags, attributes, and all other code. Update both occurrences of each header asset and both Gearly entrypoints together. Replace `<commit>` with the full verified SHA.

   - `P = https://asme-osu.github.io/ASME-OSU-Website/`
   - `J = https://cdn.jsdelivr.net/gh/ASME-OSU/ASME-OSU-Website@<commit>/`

   | Field and line | Current value | New value |
   | --- | --- | --- |
   | Header Tag (high priority), main stylesheet `href` | `P + ASME%20Custom%20CSS.min.css?v=20261121-tablet1` | `J + ASME%20Custom%20CSS.min.css` |
   | Header Tag, footer integration `src` | `P + Footer%20Integration.js?v=20261117-audit1` | `J + Footer%20Integration.js` |
   | Header Tag, header stylesheet preload `href` and Footer, header stylesheet `href` | `P + Header.css?v=20261114-headerload1` | `J + Header.css` |
   | Header Tag, header script preload `href` and Footer, header script `src` | `P + Header%20Integration.js?v=20261117-audit1` | `J + Header%20Integration.js` |
   | Footer, points loader `pointsScript.src` | `P + Member%20Points%20Integration.js?v=20261117-audit1` | `J + Member%20Points%20Integration.js` |
   | Footer, calendar loader `calendarScript.src` | `P + Calendar%20Integration.js?v=20261117-audit1` | `J + Calendar%20Integration.js` |
   | Footer, Gearly stylesheet `href` | `P + assets/gearly/gearly.css?v=20261120-fix1` | `J + assets/gearly/gearly.css` |
   | Footer, Gearly bootstrap `src` | `P + assets/gearly/gearly-bootstrap.js?v=20261120-fix1` | `J + assets/gearly/gearly-bootstrap.js` |

   The two prefixes are concatenated directly with each path. For example, at the measured commit the stylesheet URL is `https://cdn.jsdelivr.net/gh/ASME-OSU/ASME-OSU-Website@6443775cbb83132f816b1ff34bdd2642001c55cf/ASME%20Custom%20CSS.min.css`.

3. If moving the responsive footer photos in the same release, change only `photoBase` in the Footer box from `P + assets/optimized/home/` to `J + assets/optimized/home/`. Leave the filename and width lists in place. The first hero image already in the Home page HTML stays on its existing URL unless the page block is updated separately.
4. Join and Gallery scripts live in page HTML. A later migration of those entrypoints uses the matching page editor, following the [CampusPress publishing guide](campuspress-publishing.md). The three URL replacements are `P + Join%20Page%20Integration.js?v=20261117-audit1` → `J + Join%20Page%20Integration.js`, `P + celebration.js?v=20261101-sharing-carmen` → `J + celebration.js`, and `P + Gallery%20Integration.js?v=20260912-date-taken1` → `J + Gallery%20Integration.js`. Keep the calendar, gallery and points feed endpoints on GitHub Pages.
5. Use **Save Changes** for shared settings. Confirm the saved URLs, then check the public Home, Calendar, Member Points, Join and Gallery pages in a fresh browser tab. Verify the desktop and mobile header, Gearly launcher and tour, feed freshness, and the Join welcome-card asset requests if its loader moved. Verify that network requests resolve to the intended release SHA or live host. Record the installed SHA and mirror the changed lines in the repository in the release that switches them.

## Later releases and rollback

After a later asset change merges, check the new `main` commit and update the affected URLs to the newly verified SHA. Keep paired entrypoints together and retain the existing URL for files that stayed on the previous release. Each full-SHA jsDelivr URL is immutable and needs no purge.

If an asset fails, restore the changed lines from the saved WordPress fields. A previous verified jsDelivr SHA restores the exact earlier bytes. The original GitHub Pages URLs are the fallback if jsDelivr is unavailable. They serve the currently deployed Pages files, so a `?v=` change refreshes the browser cache without selecting historical bytes. Confirm the saved settings and the public page again.
