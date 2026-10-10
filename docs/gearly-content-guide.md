# Updating Gearly

Gearly is a rule-based guide, with no generative model, query logging, or paid API. Edit `assets/gearly/gearly-data.json` for chapter answers. Use JSON double quotes, preserve commas between entries, and give every intent and page a unique `id`. Preview and test changes before merging the PR.

## Published feeds and freshness

Gearly reads the same published feeds as the website for events, public leaderboard information, point values, Instagram posts, and gallery items. `liveSource` selects `events`, `leaderboard`, `points`, `instagram`, or `gallery`. Keep these intents' response text generic: do not hard-code “next event” dates, winners, totals, or latest post captions. A live result means the newest response available from a source when Gearly refreshes; it is not a guarantee of immediate source publication. Existing scheduled GitHub workflows, provider availability, browser caches, and network failures can delay updates. Results expose available timestamps and link back to the authoritative page. Instagram uses the repository's published feed; Gearly does not scrape Instagram or bypass its access controls.

Personal point totals stay in the existing Member Points dashboard. Do not add private attendance records, emails from the roster, or member searches to assistant data. Public officer email addresses are appropriate.

## Add or change an event

For events appearing in the calendar, update the chapter's existing calendar source; its sync workflow publishes `data/calendar-events.json`. Do not duplicate those events in Gearly. If you deliberately need a static reference event, append an object to `events` with `title`, `date` (`YYYY-MM-DD`), `time`, `type`, `company`, `location`, and `url`. Check every detail against the original announcement and remove expired reference entries. The runtime primarily uses the live calendar source.

## Update an officer

Update the Leadership page and its current-year board first. In `officers`, update `role`, `name`, public `email`, and `photo` to match that board. Also update the corresponding per-role intent's response and examples, and the role aliases in `entities.roles`. Officer answers are a checked-in snapshot, not automatically scraped from WordPress. The current seed is the repository's 2026–2027 executive board.

## Add a FAQ

Append to `faqs` an object containing `q`, `a`, `keywords` (an array), and `anchor` (the page URL). Use a short answer supported by an existing chapter page. To make it directly answerable, also add a matching intent; FAQs do not independently replace the intent matcher. Do not claim an unverified meeting schedule, fee, or program.

## Add an intent

Copy a nearby intent and change its unique `id`. Add several natural questions to `examples`, a few distinctive weighted `keywords`, and a short `response.text`. `response.cards` use `{ "title": "Join ASME", "url": "https://org.osu.edu/asme/join/" }`; chips are plain question strings. Use `negations` for words that should suppress an answer. Use `liveSource` for changing content. `related`, `requires`, and `actions` are optional arrays; the current guide should not promise slot filling beyond the implemented date and officer follow-ups.

Actions are user initiated. `navigate` and `openLink` require a safe URL. `scroll`, `highlight`, and `openFaq` require a selector, with optional `page` URL for another page. `tour` uses a `steps` array with selectors and plain text. Prefer existing stable IDs. Missing targets fall back gracefully. Keep source-specific answers separate from static explanations.

## Sprite library

All 22 supplied PNGs are retained with descriptive names in `assets/gearly/sprites/`. Each has a 240px WebP companion for the launcher/panel. `assets/gearly/sprites.json` maps the original filename to a name, description, alt text, original dimensions, suggested state, source file, and optimized web file. Images were inspected together to distinguish poses. `meta.sprites` chooses the optimized idle, thinking, happy, and confused assets. Paths are relative to `assets/gearly/`. Only displayed states are downloaded by the browser; the complete source library is for reuse and review.

## Validate and preview

Run `npm run test:gearly` (or `node tests/gearly/run-tests.mjs`) and the repository's usual `npm test` and `npm run check`. The assistant suite loads the engine offline, checks varied questions and ten dialogue scripts, prints per-intent accuracy and confusions, and fails below 90% or on any dialogue failure. Add new questions to `tests/gearly/utterances.json` when editing answers. Known confusions are visible, even above the pass threshold; fix them when practical. Open a page with `?gearly_debug=1` to inspect candidates and extracted entities in the assistant's debug output. Failed JSON loading disables the launcher.

## Review and deployment

This implementation is delivered as one reviewable PR, following the user's request, rather than the reference document's proposed milestone PR series. A PR does not change the deployed CampusPress footer. Preview the branch assets with a temporary integration URL or local page before merging. GitHub Pages serves merged assets; WordPress still needs the updated footer integration pasted into its existing custom footer/snippet area if the existing installed version does not automatically load the new integration. Follow the repository's deployment instructions, bump the cache version, and verify the actual WordPress page after deployment. For rollback, remove the Gearly loader lines or revert the PR and footer snippet. Test keyboard operation, small screens, both themes, and source failures before production use.

## Walkthrough and local preferences

The closed guide is one 52px square head sprite. Open Gearly to replay the tour using the small tour icon in its header or a “Show me around” prompt. A first-visit invitation is a compact sprite row; opening chat dismisses it so the two surfaces do not compete.

The ten-step overview visits eight verified chapter pages. Start, Next, and Back initiate navigation, and a destination cue explains the next stop. The offer itself never navigates. Each step uses a relevant existing pose with decorative empty alt text. Arrow and close controls keep 44px touch targets and accessible names; Escape ends the tour.

Cross-page progress uses versioned session storage, expires after 30 minutes, and resumes only on the exact verified destination. Skip, Escape, and completion clear pending navigation. Reloading an already displayed step does not retain that step. Unavailable storage keeps the tour on the current page and offers a useful destination link. Missing targets wait briefly and then skip without an unbounded redirect loop.

Completion and opt-out preferences use browser local storage; no tour telemetry is sent. Clear chat resets the conversation, while replay starts a fresh walkthrough. Browser storage denial does not disable the guide.

Edit `tour.offer.label` for the short invitation text. A tour step contains `selector`, `title`, `text`, `page`, and `sprite`. The `page` must exactly match a verified `pages[].url`; preview navigation maps it to that entry's `sourceFile`. The `sprite` must name an existing allowlisted sprite file, preferably WebP. Keep copy observational because highlighted page elements are blocked while the tour is modal. `tour.maxSteps` caps the sequence; bump `tour.version` for an updated first-visit experience.

## Disable, suggestions, and approved content search

Set `meta.enabled` to `false` to disable Gearly without removing the loader. Each page entry's `suggestions` array supplies quick prompts; its `sourceFile` identifies the checked-in page used for approved content indexing and local preview routing. Keep prompts answerable by the published data.

The static search index is built locally from an explicit list of approved public chapter HTML files. Run `npm run build:gearly` (or `node scripts/build-gearly-index.mjs`) after changing public page copy, then include `assets/gearly/gearly-index.json` in the PR. `npm run check` verifies the generated index is current using the builder's `--check` mode. The search module loads that generated index only when needed. It does not crawl private pages, dashboard records, or arbitrary URLs at runtime. Dynamic event and leaderboard data continue to come from their existing adapters rather than the static index.

## Independent accuracy measurement

`tests/gearly/utterances.json` is the frozen original 189-case regression corpus with ten dialogue scripts. `tests/gearly/holdout.json` adds 101 independently written questions: paraphrases, outside-domain questions, requests the guide cannot perform, mixed requests, ambiguous topics, and entity/date checks. Keep their intended answers stable; do not copy held-out questions wholesale into intent examples. General chapter vocabulary belongs in synonyms or carefully reviewed content.

`node tests/gearly/run-tests.mjs` reports both sets separately, including wrong confident answers. `node tests/gearly/run-tests.mjs --baseline <git-ref>` evaluates a prior engine against the same current content and frozen questions, allowing an explicit comparison without rewriting results. Baseline mode reports metrics without enforcing the improved engine's gate. The current engine must pass the original 90% regression threshold, all dialogue scripts, and the independent 80% holdout threshold. Remaining confusions are printed even if the suite passes.

Baseline comparisons need matching content: `--baseline` uses the prior engine with the current JSON, isolating engine changes. With identical current content, the previous engine (`ff0f0a4`) scores 175/189 (92.6%) on the frozen corpus and 33/101 (32.7%) on the independent holdout. The updated engine scores 186/189 (98.4%) and 85/101 (84.2%), with zero wrong confident answers on both sets. These are measured test-set results, not a guarantee for arbitrary visitor questions. The runner also requires zero wrong confident answers on either set.
