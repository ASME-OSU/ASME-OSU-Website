# Gearly v2 development

Four stacked PRs delivered images/public member lookup; section routing/team handoff/live leadership; scoring and measurement; remaining live content. They and the subsequent live-question fixes are now merged and deployed to WordPress.

## Baseline

Recorded before changes at origin/main ebd18a7: frozen corpus 186/189 (98.4%), independent holdout 85/101 (84.2%), zero wrong confident answers and zero dialogue failures in both suites.

## PR 1

Images remain within approved local gallery asset paths; query-aware photo results show up to three closest matches or clearly labeled latest photos. Calendar history is separate from the homepage/calendar feed. Empty/missing history skips calendar labeling; manual labels and feed labels still work. The scheduled calendar sync fills history; the October 14 snapshot contains 28 events back to August 1. Labeling falls back safely whenever history is missing or empty.

Public member lookup reads only the LIVE-gated public A–O leaderboard, with local matching and exact cached-row choices. Names and member lookup messages are omitted from session history; no member query is sent in the GViz query. Existing points-page integration is unchanged. A legacy frozen phrase retains the member-points intent ID while the chat performs the new lookup.

After PR1: frozen 186/189 (98.4%), holdout 85/101 (84.2%), zero wrong confident answers, zero dialogue failures.

## PR 2

Generated sections now cover existing anchors on the ten approved source pages. Unanchored section headings are reported by the builder. The follow-up adds anchors to About, Sponsor ASME, Home, Join and the current Leadership heading; Current Sponsors remains routable as a whole page. The section safety net only applies after low-confidence intent scoring. Registered sections use the existing guide and persist only approved section identifiers across navigation.

Every first uncertain answer includes a team email card. It opens a draft in the visitor's mail client; it sends nothing. Prefilled questions are capped at 300 characters with emails and phone numbers removed. Clarification includes “None of these,” retaining the original question in memory only.

Leadership answers parse the live same-origin page with a ten-minute memory cache and fall back to a generated snapshot. Current is determined by the current-year block. Historical answers show names and roles without past emails. Legacy officer names remain only in examples to preserve the frozen corpus; answers and name lookups use parsed source data.

## PR 3 measurement

Fresh tuning and v2 corpora were authored without copying the holdout. Vocabulary improvements use those new paraphrases. The IDF signal is controlled by `USE_IDF` in `gearly.js`; switching it off restores the lexical scorer. Its signal is only applied to existing supported evidence and cannot turn unknown-domain text into an answer by itself.

| Measurement | Frozen | Holdout | Wrong confident | Dialogue failures |
| --- | --- | --- | --- | --- |
| Original baseline | 186/189 (98.4%) | 85/101 (84.2%) | 0 | 0 |
| New vocabulary, weighting off | 186/189 (98.4%) | 87/101 (86.1%) | 0 | 0 |
| New vocabulary, weighting on | 187/189 (98.9%) | 87/101 (86.1%) | 0 | 0 |

The gate passed, so weighting is enabled. V2 is 30/30 with no wrong confident answers or dialogue failures. Event/photo/section followups retain titles and URLs only, never member names or image payloads. A sponsor drift checker warns without failing builds.

## PR 4 live content and final validation

Dynamic intents read conservative excerpts from the live public page, with generic editorial fallbacks when a fetch, selector, or overlap check fails. Join FAQs and sponsors are parsed from their actual markup. Company entities in data are generated from Sponsors at build time for the offline matcher, then refreshed from the live page. Optional aliases cover names that cannot be inferred by punctuation/legal-suffix rules.

Published pages are discovered anonymously from the public WordPress pages endpoint. Existing page entries enrich that list; approved local index records remain the offline fallback. Highly ranked discovered pages are fetched lazily and searched locally. Visitor questions are not sent in search URLs. Tour targets are checked against each source page; the shared navigation target is checked against the composed Header template, matching how WordPress renders the site.

The sheet ID, asset base, contact email, and Instagram handle live in the meta block. Adapter source defaults were removed. Event vocabulary lives in data; sheet category headers take precedence over the tested fallback columns. Static flags prevent extraction for joining, dues, newsletter, and GroupMe. Tour preferences use session storage rather than local storage; missing targets skip immediately.

Final corpus: frozen 187/189 (98.9%), independent holdout 87/101 (86.1%), v2 30/30 (100%), zero wrong confident answers and zero dialogue failures in every suite. Original frozen/holdout files remain unchanged.

Manual review: desktop and 360px layouts, light and dark themes, public query-selected images, persistent input/header, first-miss email draft, and candidate chips. The local `?qa=member` preview uses a clearly labeled fabricated public-sheet fixture to test identical names across periods without relying on real member data. Unit tests also verify reduced-motion behavior, denied storage, unsafe sources, rollover, malformed source fallbacks, generated snapshot staleness, selector/constant drift, and privacy.

The four v2 PRs and live-question fixes are merged, and WordPress uses loader 20261014-v2-6. Scheduled sync fills calendar history (28 events back to August 1 in the October 14 snapshot); photo labeling falls back safely whenever history is missing or empty. New section anchors require chapter edits to the corresponding WordPress markup.

A final browser check caught and fixed a superseded animated member-choice reply clearing a newer candidate set. A regression test now covers that race. The preview fixture remains confined to the development server and test fixture; production embeds never load it.


## Known limits

- Academic-date exclusion is a hand-maintained regex list (`eventRules.nonChapterTitlePatterns`); a new kind of non-chapter calendar entry appears in event answers until a pattern is added. Initial Fee Due Date remains excluded even though deadline vocabulary exists.
- A “no match” on a member name only means the published leaderboard has no match for that name; it does not mean the person is not in the chapter.
- Photo answers are only as fresh as the last Google Photos sync and have no descriptions beyond feed labels and calendar-derived titles.
- Pages without `data-gearly` or `id` anchors are routable only as whole pages.


## Section-anchor follow-up

The follow-up prepares loader `20261014-v2-7` and adds 14 section anchors without changing existing text, IDs, classes or page order. About sections that exceed the mobile viewport, the sponsor-benefits block and the Join hero use heading anchors; the current board uses its compact year-heading wrapper. Section retrieval still runs after low-confidence scoring and never replaces a confident answer.

| Page | Sections before | Sections after |
| --- | --- | --- |
| Home | 3 | 8 |
| Join | 7 | 8 |
| About | 0 | 6 |
| Sponsor ASME | 2 | 3 |
| Leadership | 1 | 2 |

Current Sponsors remains at zero sections; no new anchor was requested there. Re-paste Home, Join, About, Sponsor ASME and Leadership in WordPress and replace the shared Gearly embed to activate the complete follow-up. WordPress is unchanged by this PR.

The current feed produced 37 event-type warnings at baseline, rather than the 14 estimated in the follow-up request. The checker now applies the adapter's academic-title exclusions and recognizes published company aliases. Social vocabulary includes skating, Friendsgiving and Sweets with SWE; academic-support vocabulary covers MATLAB, Scheduling/BuckeyeLink and Study Tables. A specific ice-skating filter prevents earlier socials from hiding the requested skating event behind the three-result limit. Deadline vocabulary never bypasses the academic-title exclusions. General, company and workshop results are unchanged on the current feed.

Validation: 217 total tests and 127 Gearly tests pass. Frozen 187/189; holdout 87/101; v2 31/31; no wrong confident answers or dialogue failures. Calendar type warnings: 37 → 0. Browser review exercised one new anchor on each of the five pages at 360px and 1440px in light and dark mode, plus the skating question against the actual public calendar snapshot.
