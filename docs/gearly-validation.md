# Gearly validation and review scope

This draft PR implements the requested rule-based website assistant, reuse of public changing data, descriptive sprite upload, and isolated review. Both attached plans were used as references; their full roadmaps are not claimed complete. The follow-up adds matching improvements, optional sprite-led tours across verified pages, a compact launcher, page-specific prompts, Clear chat, a feature flag, and approved public page search.

## Verified

- Build, syntax, generated-asset checks, and all 137 behavioral tests pass.
- The original 189 questions remain unchanged. Matching improves from 175/189 (92.6%) to 186/189 (98.4%); all ten dialogue scripts pass.
- A separate 101-question holdout improves from 33/101 (32.7%) to 85/101 (84.2%). These comparisons use both engines with identical current content. Wrong confident answers fall from 17 to zero on the holdout and from one to zero on the frozen corpus. Zero is a test result, not a universal guarantee.
- Three frozen cases still clarify compound questions with a different first candidate. Sixteen holdout cases still fall back or ask for clarification. The runner prints these cases and gates both accuracy thresholds, dialogues, and wrong confident answers.
- Verified company aliases include RTX / Pratt & Whitney, HRST, and PPG. Company and Eastern date filters have behavioral coverage; cancelled events are excluded. Unknown company names do not silently become known ones.
- Public WordPress REST pages and the sanitized Google Sheets export were checked. Local browser preview renders public leaderboard totals, calendar events, and Instagram captions with source labels and stale warnings.
- The ten-page search index builds from explicitly approved repository HTML, loads lazily, and returns safe chapter links. Its tests cover actual resume-book page text, unrelated queries, unsafe routes, loading failure, cache reuse, and retry.
- Browser checks cover first-visit invitation, dismissal persistence, tour replay, Next/Back/Skip, Escape, restored focus, spotlight alignment after scrolling, light desktop, and dark small-screen layouts. The follow-up preview confirmed a true 360px CSS viewport with its tooltip inside the viewport.
- Tour tests cover missing/hidden targets, bounded steps, storage denial, keyboard focus trapping, background isolation and restoration. UI tests cover page prompts, feature flag, clearing history, and pending responses after Clear chat.
- Source failures, malformed data, unsafe links, public status gating, independent filtered caches, session limits, and safe text rendering have offline behavioral coverage.
- All 22 supplied originals are retained and descriptively labeled. The runtime uses smaller WebP counterparts.

## Deployment and limitations

WordPress is unchanged. Merge and GitHub Pages deployment must precede installation of `Gearly Embed.html` in the shared CampusPress Footer code. Page hook edits require pasting affected page HTML. Remove the marked footer block or set `meta.enabled` to false to disable Gearly. The PR remains draft and unmerged.

Officer and static FAQ content requires maintenance. Calendar, Instagram, and gallery use scheduled snapshots; timestamps and stale warnings distinguish them from instant updates. Public leaderboard and point values are fetched on request with a short memory cache.

Tours visit eight verified pages through explicit Start/Next/Back actions and resume from expiring session state on the intended destination. Closing or completing the tour clears pending state. Storage denial keeps the tour local with a destination link; missing targets are skipped after a bounded wait. Reloading an already displayed step does not retain that step. Compound requests may require separate questions. Negated requests conservatively fall back rather than implementing exclusion filters. The approved public search index returns page cards, not generated factual answers.

The reference roadmaps' automatic nudges, query/feedback logging, autonomous cross-page action persistence, and compound answer merging are not included. Production CampusPress installation, Safari/Firefox, and Lighthouse remain unverified. No claim is made that every reference-plan acceptance criterion is satisfied.

## Compact tour follow-up

The local browser completed all ten steps across Home, Join, Calendar, Resources, Points, Gallery, Leadership, and Sponsorship. Back returned from Join to the prior Home highlight. Each destination resumed its intended step. Completion restored focus to the 52px launcher, with no separate persistent tour button. Sprites loaded and the next destination was visible. Updated unit tests cover invalid/expired destinations, cross-page resume, cancellation, denied storage, safe sprites, resumed-page focus restoration, and section-specific next cues. Astra's source review and further UX recommendations are in `gearly-ux-recommendations.md`; it is not a production or screen-reader certification.

The follow-up dark preview confirmed a true 360px CSS viewport with the tooltip inside its bounds. The compact launcher measured 52×52px. Light desktop and dark phone screenshots were saved. The temporary browser viewport was restored after verification.
