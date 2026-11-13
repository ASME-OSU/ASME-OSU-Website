# Gearly conversation and content checks — November 13, 2026

## Visitor behavior

Gearly answers two or three independently confident questions in one numbered reply, such as “How do I join and are there dues?” It preserves brand names containing “and”, removes duplicate topics, and leaves uncertain clauses, personal member lookups, leaderboard queries, and tour requests in their existing clarification flow. It does not pretend to answer unsupported parts. Combined cards retain their own approved intent, public source, filters, and officer role so selecting a result after another topic or a page reload uses the correct context. Member names and leaderboard cards are not introduced into persisted compound history.

After an event query, visitors can refine the current company/date/type/time filters with “only workshops”, “and just socials”, “what about next month?”, or “anything after 5 PM?” The active filters are shown in the answer. “All types”, “any company”, and “any time” remove only those filters. An ambiguous time such as “5” or “5:30” asks AM/PM and accepts either a button or a typed reply. This clarification expires after three minutes and clears on cancellation, a new compound question, or another substantive topic. Times use Eastern Time, including DST. Before/after filters compare event start times strictly and exclude all-day events whose start clock is unknown.

Uncertain matches name specific candidate topics and include relevant page cards; an actionable Browse topics choice provides another way out. Existing team handoff and “None of these” remain available. Source notes use Eastern timestamps for event/points data, retain concise dates for media, distinguish a public sheet read from its unknown update time, and flag unavailable refresh timestamps and older snapshots.

## Fresh evaluation and stress checks

`tests/gearly/fresh-2026-11-13.json` contains 43 newly authored cases: 12 single questions, 8 compound questions, 8 compound safety boundaries, 9 event refinements, and 6 unsafe/unrelated refinements. It was authored before implementing these changes, then used during implementation; it is now a regression set, not an independent accuracy estimate. One initial mismatch was the standalone `tysm` matcher route; canonicalization now matches the already-friendly chat behavior.

The improvement suite adds UI cases for cancellation during asynchronous compound answers, mixed-source selection in both topic orders, member-name privacy, filtered followups, filter removal, natural time clarification, compound student competition guidance, and officer-role context after a reload. Existing tests also cover rapid requests, source outages, malformed input, denied storage, and tour cleanup. No newsletter forms were submitted and no points records changed.

The matcher’s original corpus remains unchanged: 187/189 frozen, 31/31 V2, 101/101 historical holdout, with zero wrong confident answers or dialogue failures in those sets. The two frozen mismatches concern multi-topic clarification ordering. The UI combines eligible questions above that matcher; these benchmark numbers describe matching rather than all UI behavior.

## Automatic content checks

Source validation now checks all registered tour/section/action/source selectors, generated index targets, and chapter-owned destinations/fragments. The published-site auditor checks ten pages, 64 unique targets, three public content feeds, and availability/schema of three public points-export tabs. It reads no member names or totals. A scheduled/manual GitHub workflow runs every six hours, retains a report for 14 days, fails on missing targets/unavailable sources/schema failures, and reports stale feeds as warnings. See `gearly-content-health.md` for commands and limits.

The first live audit reached all 16 pages/sources with no errors and one calendar-freshness warning. Template-provisioned shared navigation is explicitly identified; a markup check does not prove animation or browser layout.
