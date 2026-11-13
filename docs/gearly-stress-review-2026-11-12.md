# Gearly stress review — November 12, 2026

## Fixes

- A pending member-name lookup now accepts cancellation and explicit topic changes. Bare member names still reach the lookup, including names that also match officer content. Names remain excluded from saved history.
- Date-only followups reuse context only for event intents. Unrelated questions containing dates no longer inherit a confident answer from the previous topic. Pronoun event followups share the existing off-topic and negation guard.
- Fourth and fifth result selection works for the five cards the interface can display. Subsequent selections retain the original list; requests beyond the available count explain the limit.
- Leading polite wording preserves exact topic matches. Friendly standalone greeting variants are recognized by both the matcher and chat.

## Stress coverage

The new offline conversation suite exercises 132 topic phrasing variants; cancellation and topic changes; out-of-order live responses; cancellation and clearing during asynchronous work; five-card selection; unavailable sources; corrupt or denied session storage; member-name privacy; and malformed, long, Unicode, and HTML-like input.

Tour tests add 40 repeated restart/close cycles, 15 pending-navigation cancellation cycles, and rotation/keyboard containment during loading. They check that no duplicate dialog, leftover inert page, scroll spacer, or pending resumption remains after cleanup.

These tests deliberately use controlled source responses for race and outage cases. They do not submit real newsletter forms or change points records.

## Validation

Run `npm test`, `npm run check`, and `node tests/gearly/run-tests.mjs`. Browser verification additionally covers cancellation, switching away from a name prompt, polite questions, and the published asset version.

The existing corpus is a regression set, not a fresh independent evaluation. Its two remaining frozen-corpus mismatches are the ordering of topics in multi-topic clarification, rather than confident wrong answers. Multi-part questions still ask the visitor to choose a topic.
