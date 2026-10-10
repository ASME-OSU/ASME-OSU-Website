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


## Welcome screen and reply feedback — October 10, 2026

- Version 1.3.0 adds the waving welcome banner, page context, Events/Join/Career/Tour shortcuts, and a compact scarlet corner launcher with a status dot.
- The thinking-chin and laptop sprites mark pending and typing states. Local answers have a 280 ms minimum thinking cue and a text reveal capped at one second; live requests retain the pending cue until they finish. Reduced-motion users receive the complete response immediately. This presentation does not change the local matching engine or imply a generative service.
- Clearing the chat cancels pending feedback and restores the welcome screen. A new question completes any prior reveal without allowing an older request to overwrite the current answer. Completed answers become accessible once rather than announcing every character; links remain hidden while their answer is typing.
- The welcome screen remains available across page loads until a visitor actually asks a question. Existing conversations are restored as before.
- Browser checks cover light and dark chat surfaces, mobile width 360 px, welcome shortcuts, page context, reply states, and keyboard controls. Explicit light theme overrides a system dark preference; all surfaces, input text, links, and muted text share theme variables.
- The shared WordPress loader uses cache version `20261010-4`. Individual page HTML does not change.


## Natural-language section guidance — October 10, 2026

Version 1.4.0 recognizes requests such as “can you pull up the ranking chart please,” “where am I on the leaderboard,” “show upcoming events,” and “go to career resources.” Explicit, confidently matched section requests open a registered section; ordinary information questions retain their public live-source answer in chat and offer clickable mascot destination cards. Filtered event requests stay in chat so date/company/type filters are preserved. Personal-standing requests open the public name search without inferring the visitor's identity or rank.

Cross-page guidance stores an approved intent/action reference for at most three minutes, maps canonical pages to local preview routes, and resumes the exact section on arrival. Arbitrary selectors, forged destinations, expired requests, and unregistered actions are rejected. Denied storage still opens the approved page. Missing sections produce an explanatory card after a bounded wait. Section guidance is nonmodal: page controls remain available, Explore focuses an available control or heading, and Escape removes the outline.

The centered smiling-head launcher uses a soft tile instead of the scarlet portrait crop. Welcome shortcuts and destination cards contain topic-specific poses with hover/focus feedback. The tour uses instant deliberate scrolling, a stationary guide card, no geometric easing on its ring, one scheduled update per animation frame, and ResizeObserver updates for changing content. Section highlights use a native outline that follows layout directly. A mobile browser scroll check measured zero pixels of ring/target drift and no change to the guide card’s vertical position. Gearly also successfully read the sanitized public leaderboard in the browser; destination cards appeared above the public totals.

Validation includes the full repository suite, cross-page section resumption and forgery regressions, frame coalescing and stable card positioning, natural-language positive/negative examples, and frozen accuracy suites. The frozen and independent holdout scores remain 186/189 (98.4%) and 85/101 (84.2%), with no confidently wrong answers. A matcher exclusion now checks the original wording as well as typo-corrected wording, preventing “bank” from being corrected to “rank” and bypassing an exclusion.

The preview strips page integration scripts, so its Member Points chart and name search remain loading placeholders. Browser checks validate section navigation and presentation; they do not claim the production dashboard's data loaded in that preview. Production's existing public data integrations are unchanged. The shared loader and content JSON use cache version `20261010-5`; individual page HTML is unchanged.
