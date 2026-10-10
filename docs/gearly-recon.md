# Gearly public data reconnaissance

Verified against repository integrations and workflow configuration on 2026-10-10. The attached GEARLY_CODEX_PLAN.md is background, not authority for deployments or extra features.

## Existing sources

| Feature | Public source | Refresh cadence |
| --- | --- | --- |
| Events | `data/calendar-events.json`, existing Google Calendar generator | Hourly at minute 23 UTC; generatedAt changes with content, checkedAt records source checks |
| Instagram | `data/instagram-feed.json`, public @asmeohiostate profile snapshot | Every 6 hours at minute 17 UTC |
| Gallery | `data/google-photos-feed.json`, public shared album | Daily at 09:37 UTC |
| Leaderboard | Existing sanitized Website Export sheet `System_Status` + `Leaderboard_Public` | Requested when opened, cached for 60 seconds |
| Point values | Same export, `Point_Values_Public` | Requested when opened, cached for 60 seconds |

Scheduled GitHub Actions can run late or fail, and Instagram's public profile can be unavailable. These are refreshable snapshots rather than streaming real-time feeds. Browser no-store requests cannot accelerate the upstream workflow. Gearly reports feed timestamps and stale notices (events after 3 hours, Instagram after 18 hours, photos after 3 days). Missing timestamps also count as stale. Leaderboard/points expose no source modification timestamp, so updatedAt remains null rather than inventing one.

The leaderboard reads only rank, public display name, public period, and verified total from columns A–D. It checks `system_status === LIVE` first and never uses the private member spreadsheet or identity lookup. Errors after a status check discard leaderboard fallback totals. Public point values mirror the existing page and remain available independently of the status gate.

## WordPress access

The root agent confirmed HTTP 200 for the public homepage and `https://org.osu.edu/asme/wp-json/wp/v2/pages?per_page=100&_fields=id,link,title,excerpt`. The REST response is an array of `{id, link, title: {rendered}, excerpt: {rendered}}` objects. The subsite `/asme/` prefix is required. Excerpts are HTML and must be converted to text before display. Existing homepage markup loads GitHub Pages `Header Integration.js` and `Footer Integration.js`, with member points and calendar loaders in the footer. This supports the same external-script installation pattern for Gearly; deployment to WordPress remains separate from merging the repository PR.

## Adapter contract

`window.GearlyLive.configure({baseURL})` sets the feed root (default existing GitHub Pages deployment). `load(kind, options)` supports events, leaderboard, points, instagram, gallery and resolves `{text, cards: [{title, text, url}], updatedAt, sourceLabel}`; `stale: true` is added when applicable. Events are upcoming, chronological, and formatted explicitly in America/New_York.

Requests omit credentials, bypass browser cache, time out after eight seconds, and reject oversized or malformed data. Google GViz's JSON wrapper is parsed as JSON without eval or executing remote JSONP. Links must use HTTPS and an explicit public-source hostname allowlist; invalid links use chapter destination fallbacks. Outputs are plain strings and the UI must use textContent. Concurrent requests are deduplicated, with a 60-second in-memory cache and no localStorage. Failed snapshot refreshes may return an explicit stale prior snapshot; failed leaderboard checks return an empty state.

Validation: `node --test tests/gearly-live.test.mjs` covers chronological events/time zone, expired records, URL safety, request options, cache behavior, strict leaderboard status gate, public-field projection, malformed feed states, unsupported kinds, stale timestamps, JSONP code rejection, and local configuration. Live source/network checks belong to integration verification because sandbox DNS is unavailable.

Events accept `options.dateRange = {from, to, label}`, `eventType`, and `company`. Bounds compare Eastern calendar dates, including events whose UTC date differs. Company matching uses case-insensitive public title/description text. Event types use conservative explicit vocabulary (social, workshop, company, volunteering, competition, meeting), avoiding classification of academic-calendar entries as company sessions. Filtered results have independent 60-second cache keys, and no matches return an explicit calendar fallback. The seven adapter tests include different ranges in one session and an Eastern midnight boundary. The root agent verified the GViz public System_Status endpoint returned HTTP 200 with `Access-Control-Allow-Origin: https://org.osu.edu` for an Origin header matching the WordPress site. This verifies CORS response headers, not a deployed-browser end-to-end check. The adapter uses `headers=1` consistently with the existing member-points integration. Unavailable requests produce an honest empty state.

Company event classification also recognizes configured verified company registry names and aliases using normalized whole-word phrases. This covers named sponsor events such as Pratt & Whitney without guessing from arbitrary capitalized titles. Company IDs map to the registry aliases. Canceled/cancelled-status events and `cancelled: true` events are excluded. Gallery fallback destination is the verified `/asme/pictures/` route. Nine adapter tests pass, including named company classification, alias filters, unrelated social exclusion, cancellation, and gallery fallback.
