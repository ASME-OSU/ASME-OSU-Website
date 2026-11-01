# November 1, 2026 repository cleanup

The audit was implemented on top of `ff0980b` so the annual points-source rollover and Jessica Wilson's leadership link are preserved. The companion CSV inventories every tracked file plus new implementation files at review time, with size, checksum, retention reason, and reference examples. It is a review snapshot, not a build input.

## Changes

- Points totals no longer wait for optional rank history. History times out, ready dashboards show instructions instead of skeletons, and clearing search clears the selected dashboard.
- Sponsor headings/body colors are paired with desktop and phone card backgrounds. Sponsor dialogs contain Tab focus, make the background inert, and restore their trigger on close.
- Calendar failures show an unavailable state, retry and calendar links. Cached feeds expire after 24 hours; fallback notices show the saved Eastern time.
- Gallery rotation respects focus/hover and explicit pause. Long generated feature titles separate event names from caption introductions.
- Mobile sponsor ribbons become horizontal badges. Resource section headings use readable 17px sans-serif labels. Phone hero/Join/calendar spacing is tighter.
- `celebration.js` remains the stable WordPress URL but is now a small loader. It loads the full experience on GroupMe focus/hover/click or a pending return journey. The newsletter form works before this load. The large embedded PNG was replaced with an external lossless WebP. Cross-origin image loading is explicit so the downloadable card remains usable.
- Gearly's wave loads only after pointer/keyboard interaction and respects reduced-motion, Save Data, and slow connections. Tour offers wait until the visitor has scrolled and are suppressed when navigation is open. Known common paraphrases were added to intent examples without lowering confidence thresholds. The existing holdout is now a regression corpus for those phrases; its improved score is not evidence of independent unseen accuracy.
- All four feed publishers share a non-cancelling publication group, use a shared bounded rebase/push helper, and request Pages builds only after changed data. Runtime/tooling in CI uses Node 24. The annual approved-source handoff is retained.
- Dependency updates resolve all advisories reported by npm at review time. The collector's externally downloaded image processing remains covered by the patched sharp dependency.

## File cleanup and compatibility

The largest redundant files were full-resolution PNG copies of the same Gearly poses already distributed as WebP. Current manifest and tour references now use WebP. Cached copies of the older tour can still request PNG paths, so deleting all PNG URLs immediately would break those visitors. Their high-resolution copies were instead reduced to compatibility-sized, losslessly encoded PNGs at the same URLs. The original full-resolution files are recoverable from Git history and were also archived outside the repository during this cleanup. The shared logo PNG was similarly optimized while retaining its public URL.

This reduces the distributed `assets` directory from about 37 MB to about 7.2 MB. The large celebration experience and wave are no longer downloaded by an idle first-time visitor. These are file sizes/request-path improvements, not a measured Core Web Vitals claim.

Preserved intentionally:

- `Footer Integration.js`: upgrades the older WordPress footer; not dead code.
- Header bootstrap/embed and source: fallback and generated deployment paths.
- Generated sponsor/navigation copies: self-contained WordPress delivery paths, validated against their source.
- Historical gallery images: static fallback HTML and public URLs still use them.
- Rank/calendar histories: publishing and comparison data, not disposable caches.
- Tests, fixtures, source artwork metadata, and maintainer preview tools: not downloaded by normal page visits.
- Historical Gearly notes: operational/context records. An unreferenced document is not browser overhead.

A small number of byte-for-byte redundant CSS declarations were removed. The remaining long legacy stylesheet includes WordPress formatting defenses and breakpoint-specific cascade rules; speculative deletion was avoided. The shared design-system source continues to own the final component rules, and the minified file is generated from it. Larger CSS extraction should remain incremental with WordPress visual comparisons.

## Publishing

GitHub Pages serves CSS/JS/media automatically after merge and deployment. WordPress contains independent HTML copies. Republish the complete generated `Footer.html` wherever the current shared footer is stored, preserving unrelated settings. Republish `Sponsor ASME Page.html` (page 660) and `Current Sponsors Page.html` after backing up saved content. The latter has only whitespace added between the tier words, needed for its compact mobile badge. No other page HTML changes are required for these fixes; the existing Join entrypoint URL remains valid.

Follow `docs/campuspress-publishing.md`: verify post IDs, exact saved-field readback, save notices, and canonical public pages. WordPress publication requires an authenticated OSU browser session. GitHub merge alone does not update those embedded copies.

Source tests cover the new failure, focus, empty-state, lazy-loading, publication-race, and asset-reference paths. Reviewers should additionally check mobile and desktop sponsor cards and a real downloadable welcome card before changing its canvas/image path again.
