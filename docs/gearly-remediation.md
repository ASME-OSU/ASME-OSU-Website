# Gearly student remediation — PR 47

The changes address the student-use issues in the October 15, 2026 30-prompt test. Meeting requests use chapter events; Instagram shows only the newest post; media freshness labels use short dates.

## Direct answers and sources

`gearly-student.js` resolves a small set of explicit student actions before generic page search, FAQ similarity, or officer-roster matching. It normalizes résumé/resume and GroupMe spacing/common joining typos, and keeps unrelated, private, negated, officer, and sponsor queries out of these overrides.

The existing site snapshot builder now extracts student resources, invitation and subscription links, résumé-book audience, and office location from Join, Member Resources, and Footer sources. FAQ answers remain sourced from Join. The build fails if these sources become incomplete and check mode detects changes. Resource URLs and policies are not maintained as a second disconnected list.

- Joining: related majors and first-year students are welcome; newsletter and GroupMe links are direct. FAQ yes/no wording is adapted to avoid saying “No” to “Can I join?”
- Fees: free newsletter/GroupMe signup and separate national membership, without claiming every chapter activity is free or guaranteeing current national promotions. Member Resources no longer says “Join ASME National first.”
- Careers: Career Packet, ECS, Handshake, and the résumé-book form/audience are selected by the requested action. Attire requests go to the Career Packet rather than a company-event list; unpublished event-specific dress guidance is identified as unknown.
- Office, volunteering, photos, calendar subscription, scholarships, and projects use their specific published resources.
- GPA, attendance, office hours, and unverified SAE comparison details are explicitly limited to what the sources establish. Newsletter and missing-points questions receive appropriate chapter-contact guidance. Membership does not promise an internship.

## Event questions and follow-ups

The calendar adapter accepts date/company/type filters, specific event names, and stable selected-event IDs. It excludes academic notices and cancelled/ended events, preserves ongoing events and all-day boundaries, and distinguishes fresh empty results from stale or unavailable sources.

The next event is primary only when it is unambiguous. Follow-ups request that event by ID. New dates clear a previous selection; numbered selections preserve the exact occurrence even when titles repeat, including across reload. A detail question without an event referent asks which event.

RSVP, food, location, laptop, prior-knowledge, and age questions return bounded public description evidence when available and explicitly state missing fields. Event titles alone never establish policies. Unknown logistics remain unknown.

## Search and navigation

Search-index generation removes interface/loading/test chrome without removing legitimate section headings. Snippets end at word boundaries. Generic fallback merging preserves the better-ranked index result rather than reversing order through repeated prepends.

Public answer text, cards, and links survive same-site navigation. Image data, member lookup names/results, and public leaderboard card names remain excluded from persisted cards. Only safe bounded public fields are restored.

## Validation

- All 30 original questions are replayed against the real integrated modules in `tests/gearly-student-acceptance.test.mjs` using a fixed October 15, 2026 clock and a saved repository calendar fixture. Its refresh timestamp is controlled; event facts are not rewritten. Point values use a public-data fixture, not a private member record.
- Every question asserts the correct answer/destination or an explicit, specific unknown. The captured answers are in `gearly-student-acceptance.json`; these are deterministic regression results, not proof of current live logistics or a statistical accuracy score.
- Additional checks cover event-registration phrasing, office/officer and sponsorship/career separation, unrelated academic points, missing referents, date changes, recurring-event selection, safe card restoration, and existing member-data privacy behavior.
- Existing engine, live-adapter, UI, source-contract, generated-index, and conversation-corpus gates remain in place. Known frozen/holdout abstentions remain reported rather than rewritten as passes.
- Browser preview checks cover joining, next-event and RSVP/food follow-ups, résumé-book submission, reload persistence, and mobile GroupMe typo handling.

## Release

For manual CampusPress edits, follow the [page publishing and save-recovery guide](campuspress-publishing.md). Page edits require the Publish-panel **Update** control and a verified **Page updated** result; shared Footer settings use **Save Changes**.

This branch changes source and preview behavior, not the live CampusPress site. After review and GitHub Pages release, replace the Gearly block in the shared CampusPress footer with `Gearly Embed.html` (asset version `20261015-remediation`), preserving unrelated customizations. Publish the updated Member Resources page wording as well. The site's snapshot and search index are generated with the release.
