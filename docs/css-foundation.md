# Stylesheet foundation (Phase 1)

Phase 1 of the stylesheet cleanup prepares for rebuilding pages one at a time. It removes dead rules, separates the few truly site-wide rules from the page rules, and adds design tokens. It does not change how any page looks: every page renders the same pixels and the same computed styles as before (see Verification).

## Layers

`ASME Custom CSS.css` is now built in three layers by `npm run build:styles`:

1. **Foundation**, between `/* ASME FOUNDATION START */` and `/* ASME FOUNDATION END */`. Generated from `styles/tokens.css` and `styles/foundation.css`. Do not edit it inside the built file.
2. **Legacy**, the hand-edited rules between the foundation block and the design-system marker. Phase 2 removes these page by page.
3. **Shared**, generated from `styles/design-system.css` and the other `styles/*.css` files listed in `scripts/build-styles.mjs`.

## Inventory

`scripts/css-inventory.mjs` reports what the legacy layer contains:

```bash
node scripts/css-inventory.mjs                 # by selector text
node tests/visual/collect-classes.mjs          # record classes on each rendered page
node scripts/css-inventory.mjs --reach         # by the pages each rule can match
node scripts/css-inventory.mjs --reach --list --scope=page:join
```

`--reach` treats a rule as able to match a page only if every class and id it requires appears in that page's rendered DOM. Pages are rendered at phone and desktop widths and in every interaction state of the visual suite. Names inside `:not()`, `:is()`, `:where()` and `:has()` are ignored, which can only widen a rule's reach. Results:

| Reach | Meaning |
| --- | --- |
| `page:<name>` | Matches exactly one page; rebuilt with that page in Phase 2 |
| `several-pages`, `every-page` | Shared components (footer, original theme header) and site-wide base |
| `unrendered` | Names exist in this repo or the recorded site but in no rendered state (error and loading messages, theme states) |
| `unused` | Names appear nowhere: not on any rendered page, in this repo's HTML/JS, or in the recorded WordPress HTML, CSS and JS |

## What Phase 1 changed

- **Removed unused rules** with `--reach --remove-unused --write`. Rules naming WordPress theme states (sidebars, archives, search, pagination, the toggled theme menu, `page-id-` classes) are kept even when unused, because the theme can produce them on pages the suite does not cover. Every removed rule is listed in `docs/css-unused-removals-<date>.csv`.
- **Moved site-wide rules** to `styles/foundation.css` with `--reach --extract-foundation --write`. A rule moves only if it reaches every page and each of its selectors uses nothing but base elements, theme containers (`#page`, `.site-content`, `.entry-content`…) and the scroll-reveal classes. Keyframes stay where they are because moving them could change which same-named animation wins.
- **Added `styles/tokens.css`**: role-named colors with dark-mode values, type, spacing, radius, elevation, layout and motion tokens, plus the four breakpoints rebuilt rules use. Nothing uses the tokens yet. Rebuilt pages in Phase 2 will.

Results (November 19, 2026):

| | Before | After |
| --- | --- | --- |
| Minified stylesheet | 664 KB | 635 KB |
| Gzipped | 80.3 KB | 77.2 KB |
| `!important` in the source | 9,454 | 9,056 |
| Legacy rules | 3,018 | 2,772 |

215 unused rules were removed (19 theme-state rules kept) and 31 site-wide rules moved to the foundation.

## Lessons for Phase 2

- **`@import` must stay first.** The DM Sans / DM Serif Display fonts load through an `@import` at the top of the legacy layer. Browsers ignore an `@import` that follows any other rule, so placing the foundation above it silently switched every heading to Georgia. `build-styles.mjs` now hoists `@import`/`@charset` to the top and fails the build if one ever follows another rule.
- **Some rules win only by order.** `.page article.page` resets an article background that an earlier light-mode legacy rule sets to the page gray. Moved ahead of that rule, it lost, with no visible change (same color as the page behind it). Only the computed-style check caught it. Such rules are listed in `KEEP_IN_LEGACY` in `scripts/css-inventory.mjs`. When a page is rebuilt, its rules and the legacy rules they fight must go together.

## Verification

The visual suite (`docs/visual-regression.md`) now also compares computed styles: every element's and `::before`/`::after`'s final values, grouped and hashed, in all 106 screenshots. A Phase 1 change is accepted only when all screenshots match and no element's computed style differs. Two exclusions keep this deterministic:

- `--asme-delay`, which the scroll-reveal script sets per element from when it enters view.
- Values the browser reports from layout (width, height, margins, offsets). These vary with load timing, and screenshots already check layout.

Newly defined custom properties (the tokens) are ignored until something uses them; changed or removed ones are reported.

Phase 2 (rebuilding pages one at a time) is described in [css-page-rebuild.md](css-page-rebuild.md).
