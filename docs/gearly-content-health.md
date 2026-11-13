# Gearly content health checks

`npm run check` validates source contracts before publication. The shared Gearly contract now covers registered tour targets, page section targets, every generated search-index section, intent extraction selectors, action selectors and nested guide steps, and chapter-owned card/action destinations and fragments. The generated index must already match the source pages. A missing selector or registered chapter destination fails validation.

Run the published-site check with:

```sh
node scripts/check-gearly-live.mjs --output /tmp/gearly-live-health.json
```

The **Check published Gearly content** GitHub Actions workflow runs on demand and every six hours. It checks the ten registered WordPress pages, their target selectors, the calendar/Instagram/photo feeds, and availability/schema of the approved public points-export tabs. It retains a JSON report for 14 days and puts failures and freshness warnings in the workflow summary. Missing targets, unavailable sources, and malformed schemas fail the job; old or unknown refresh times produce warnings. It does not open issues or send messages.

Requests use approved HTTPS hosts and path prefixes, omit credentials, check redirects against the same allowlist, stop after three redirects, and bound each response to two megabytes and twelve seconds. The public-export probe requests only column A for point values and leaderboard availability. It does not download member names, attendance histories, or totals; the status probe reads the public system-status flag. Reports contain health metadata and diagnostics rather than source bodies.

The shared compact header is mounted from an inert HTML template. A target found there is counted separately as `templateTargets`: the audit confirms that its published markup is provisioned, but does not execute the runtime or prove browser rendering. It also does not validate animation, visual bounds, click behavior, all third-party links, authenticated tools, or newsletter submission. Browser checks remain necessary for those experiences.

The first live run on November 13 reached all 16 registered pages/sources. The calendar feed was available but older than its three-hour freshness window, which correctly produced a warning. A source being available does not establish that its data is current.
