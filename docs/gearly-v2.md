# Gearly v2 development

Four stacked PRs are planned: images/public member lookup; section routing/team handoff/live leadership; scoring and measurement; remaining live content. They stay unmerged and are not deployed to WordPress.

## Baseline

Recorded before changes at origin/main ebd18a7: frozen corpus 186/189 (98.4%), independent holdout 85/101 (84.2%), zero wrong confident answers and zero dialogue failures in both suites.

## PR 1

Images remain within approved local gallery asset paths; query-aware photo results show up to three closest matches or clearly labeled latest photos. Calendar history is separate from the homepage/calendar feed. Empty/missing history skips calendar labeling; manual labels and feed labels still work. The first successful scheduled calendar refresh will populate the initially empty history file. Live collection during development failed DNS resolution before any writes.

Public member lookup reads only the LIVE-gated public A–O leaderboard, with local matching and exact cached-row choices. Names and member lookup messages are omitted from session history; no member query is sent in the GViz query. Existing points-page integration is unchanged. A legacy frozen phrase retains the member-points intent ID while the chat performs the new lookup.

After PR1: frozen 186/189 (98.4%), holdout 85/101 (84.2%), zero wrong confident answers, zero dialogue failures.
