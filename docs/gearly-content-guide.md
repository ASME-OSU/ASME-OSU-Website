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
