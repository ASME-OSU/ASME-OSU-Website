# CSS cascade cleanup — November 1, 2026

Baseline: `3736a68500a01259a390e68cca09824efa599038`. This cleanup targets proven source-order redundancy. It does not redesign the pages, change integration behavior, or remove styles merely because they are absent from a default screenshot.

## Deletions

| Source | Superseded declarations | Empty selector rules | Empty media/supports groups |
|---|---:|---:|---:|
| ASME Custom CSS.css | 272 | 85 | 5 |
| celebration.css | 76 | 10 | 1 |
| join-three-step.css | 33 | 8 | 0 |
| assets/gearly/gearly-tour.css | 12 | 5 | 1 |
| Total | 393 | 108 | 7 |

`Header.css`, `styles/design-system.css`, and `assets/gearly/gearly.css` had no deletions justified by this audit. The independent inline styles in Header Bootstrap and the sprite preview were also reviewed; no redundant declarations were found there. Join's generated critical CSS and the production minified stylesheet are regenerated from their sources.

Every removed declaration is listed in `css-cascade-removals-2026-11-01.csv`, including the baseline source line and later winning declaration. Those line numbers refer to the baseline revision, not the cleaned files.

## Safety rule

A declaration can be removed only if every selector in its comma-separated group has an exact later selector/property match of sufficient importance. The later rule's media/supports conditions must apply whenever the earlier rule's conditions apply. The later value must pass the parser's property grammar check (or use CSS custom-property substitution). Unsupported newer syntax and vendor-selector groups cannot be used to erase portable fallback declarations.

The audit deliberately does not infer relationships between different selector specificities or shorthand/longhand properties. It preserves custom properties, vendor-prefixed declarations, layers, keyframes, and unknown conditional at-rules. Generated shared-design-system content remains controlled by its source file. Native WordPress header styles remain available as the custom-header fallback.

Run `npm run audit:css` for a read-only report. `node scripts/audit-css-cascade.mjs --write --report /path/to/report.json` applies only these conservative rules. Rebuild styles and Join's critical style block afterward. Future cleanup still requires rendered comparisons; the helper is not a general-purpose CSS optimizer.

## Payload change

The main production stylesheet changes from 637,280 to 618,582 bytes: 18,698 bytes smaller (2.93%) before HTTP compression. Locally gzipped size changes from 75,349 to 73,963 bytes (1.84%). These are file-size measurements, not a page-load-time benchmark. Avoid adding source and generated file savings together as if both were downloaded by the browser.

## Verification

The PR records the completed browser matrix and test results. The regression fixtures use complete rendered WordPress DOM captures, frozen live data, eagerly decoded images, deterministic theme/motion conditions, and paused animations held at a completed finite-animation state. Third-party calendar contents are replaced with an empty iframe; their internal styling is outside this repository.

Comparisons check every element's geometry and the full computed-style fingerprints of elements matched by removed selectors, including before/after pseudo-elements. Tests include light/dark themes, responsive breakpoint boundaries, portrait layout, reduced motion, open modal/menu/FAQ/dashboard states, welcome cards, sharing panels, tour, and the original-header fallback. A deliberate test-only font-size change is used to verify that the comparison harness can detect a regression. Representative screenshot pairs receive raw decoded pixel comparisons.

The browser matrix runs in the in-app browser at emulated viewport sizes, not on a physical-device or cross-engine browser farm. Canvas animation output and external calendar contents are not pixel-certified by these fixtures. Existing behavioral tests continue to cover integration behavior. Do not claim that a finite comparison matrix proves all possible browser behavior.

## Publishing

Merge the reviewed PR to publish stylesheet assets. WordPress's Join page also stores an inline critical style block; back up its saved HTML and replace only `<style id="asme-join-page-styles">…</style>` with the regenerated block. Preserve the newsletter action, fields, GroupMe destination, scripts, content, and formatting settings. Refresh the changed shared stylesheet/tour CSS cache versions and verify canonical public pages after save notices and saved-source readback.
