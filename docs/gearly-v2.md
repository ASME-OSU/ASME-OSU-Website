# Gearly v2 development

Four stacked PRs are planned: images/public member lookup; section routing/team handoff/live leadership; scoring and measurement; remaining live content. They stay unmerged and are not deployed to WordPress.

## Baseline

Recorded before changes at origin/main ebd18a7: frozen corpus 186/189 (98.4%), independent holdout 85/101 (84.2%), zero wrong confident answers and zero dialogue failures in both suites.

## PR 1

Images remain within approved local gallery asset paths; query-aware photo results show up to three closest matches or clearly labeled latest photos. Calendar history is separate from the homepage/calendar feed. Empty/missing history skips calendar labeling; manual labels and feed labels still work. The first successful scheduled calendar refresh will populate the initially empty history file. Live collection during development failed DNS resolution before any writes.

Public member lookup reads only the LIVE-gated public A–O leaderboard, with local matching and exact cached-row choices. Names and member lookup messages are omitted from session history; no member query is sent in the GViz query. Existing points-page integration is unchanged. A legacy frozen phrase retains the member-points intent ID while the chat performs the new lookup.

After PR1: frozen 186/189 (98.4%), holdout 85/101 (84.2%), zero wrong confident answers, zero dialogue failures.

## PR 2

Generated sections now cover existing anchors on the ten approved source pages. Unanchored headings are reported by the builder; About and Sponsors currently have no eligible anchors, so they remain routable as pages. The section safety net only applies after low-confidence intent scoring. Registered sections use the existing guide and persist only approved section identifiers across navigation.

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

No PR has been merged and WordPress has not been edited for v2. Calendar history remains empty until the first successful scheduled history sync; photo labels fall back safely meanwhile. Unanchored headings reported by the index builder require chapter edits to the corresponding WordPress markup.

A final browser check caught and fixed a superseded animated member-choice reply clearing a newer candidate set. A regression test now covers that race. The preview fixture remains confined to the development server and test fixture; production embeds never load it.
