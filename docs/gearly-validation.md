# Gearly validation and review scope

This PR implements the requested rule-based website assistant, reuse of public changing data, descriptive sprite upload, and isolated review. The attached plan was used as reference; its full milestone roadmap is not claimed complete.

## Verified

- Repository syntax and generated-asset checks pass. All 109 behavioral tests pass, including 21 Gearly tests.
- Conversation corpus includes 189 cases and ten dialogue scripts. 175/189 cases pass (92.6%); all ten dialogue scripts pass. the runner prints unresolved confusions and fails below the threshold or on dialogue failure.
- Public WordPress subsite REST pages endpoint returns HTTP 200. Response fields are documented in `gearly-recon.md`.
- The existing sanitized Google Sheets export returns the expected `setting/public_value` and `rank/display_name/period_label/points` columns. Its response allows requests from the WordPress origin.
- Local browser preview renders public leaderboard totals, calendar events, and Instagram captions with source labels and stale warnings. Sprite states load, Escape closes the panel, and input focus returns on reopen.
- Desktop and small-screen dark-theme preview checked. The in-app browser clamps the requested 360px viewport to an observed 400px CSS viewport; layout remains inside its bounds.
- Source failures, malformed data, unsafe links, public status gating, Eastern event filtering, independent filtered caches, session limits, and text rendering have offline behavioral coverage.
- All 22 provided originals are retained and labeled. The runtime uses small WebP counterparts rather than downloading the entire PNG library.

## Review limitations and deployment

WordPress is unchanged by this PR. Merge and GitHub Pages deployment must precede installation of `Gearly Embed.html` in the shared CampusPress Footer code. Page hook edits also require pasting the affected page HTML if those actions are wanted. Remove the marked footer block to disable Gearly.

Officer and static FAQ content is checked-in and requires maintenance. Calendar, Instagram, and gallery are scheduled snapshots; their timestamps and stale warnings distinguish them from instant updates. Leaderboard and point values are read from the public export on request with a short memory cache.

The full reference roadmap's automatic nudges, query/feedback logging, autonomous cross-page action persistence, and compound answer merging are not included. Compound questions may require a choice or separate questions. FAQ data requires an intent to become directly answerable. Production WordPress installation, Safari/Firefox, explicit light-theme visual comparison, true 360px browser rendering, and Lighthouse were not tested. No claim is made that all reference-plan acceptance criteria are satisfied.
