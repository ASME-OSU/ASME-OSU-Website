# Rebuilding a page's styles (Phase 2)

Each page's styling is spread across the legacy layer, page-only rules in `styles/design-system.css` and its siblings, and page selectors buried inside shared rules (dark-mode lists, shared buttons). Phase 2 moves one page at a time into `styles/pages/<page>.css` without changing how it looks.

## Steps

```bash
node tests/visual/collect-classes.mjs                  # refresh class lists (after content changes)
npm run visual:baseline                                # before touching anything
node scripts/css-page-rules.mjs about                  # what styles the page today
node scripts/css-compile-page.mjs about                # dry run: stats + preview in tests/visual/.output/
node scripts/css-compile-page.mjs about --write --tokens
npm run build:styles
npm run visual:compare                                 # must be 106/106, pixels and computed styles
```

If the comparison fails, restore the stylesheet files from git, fix the cause, and compile again. The compiler reads the page's current rules, so it must run against the unmodified layers.

## How the compiler works

`scripts/css-compile-page.mjs` lets Chrome resolve the cascade instead of re-deriving it:

1. It renders the page at 375, 768, 1280 and 1920px in light and dark mode. For every element in the page content, including `::before`/`::after`, `:hover` and `:focus-visible`, it asks the DevTools protocol for the matched rules in cascade order.
2. A matched selector is **owned** when the classes and ids it requires appear on this page and on no other rendered page. Where an owned declaration wins, its value is re-emitted.
3. Each element gets an exact selector: its classes with `:not(.variant)` for any element carrying the same classes plus more. Elements that share a selector but are styled differently are separated by `:empty`, then by their nearest classed ancestor, then by position.
4. Values are written mobile-first for the four breakpoints in `styles/tokens.css` (768, 980, 1800) and light/dark. Each declaration gets only as much specificity and `!important` as the remaining shared rules competing with it require.
5. With `--tokens`, legacy variables become their token names, and literal light/dark color pairs that equal a token's pair become that token.
6. With `--write`, owned selectors are deleted from the legacy layer and `styles/*.css`; rules left empty disappear, and mixed rules keep their other selectors. `styles/pages/*.css` is built after every other layer.

## Pitfalls the compiler handles (found on About)

- **Shorthands with `var()`.** Chrome expands `border: 1px solid var(--x)` only into the longhands it can resolve and silently drops the color ones. Such shorthands are kept whole.
- **Overridden shorthands.** A declaration is dropped when later, higher-priority declarations set every longhand it sets, whether one shorthand or several longhands together. Otherwise it could resurface from a media block written later in the file. Surviving declarations keep their original cascade order.
- **csso is not used.** Its restructuring turned `border: 1px solid var(--x)` plus a later `border-top` into `currentcolor` borders. Because the compiler's selectors are exact, identical blocks are merged with a simple pass instead.
- **WordPress `<p>` wrappers.** Empty and non-empty `<p>` elements under the same parent need different styles, hence the `:empty` split.

Found on Calendar:

- **Classes that change by width or state.** The calendar script toggles `is-active` on the view buttons and picks the default view by screen width (list view at 700px and below). An element is tracked separately for each selector it carries, and entries sharing a selector are merged when they agree wherever both have a value.
- **Missing source data in DevTools.** For many rules Chrome's protocol returns no source range. It then lists only longhands it has expanded itself, so `background: var(--asme-card)` arrives as empty placeholders and the value is lost. Rules from our stylesheet without source data are matched by `@media` and selector list against the compiler's own parse of the built CSS, and their declarations are used instead. The compiler reports how many it read this way, and any it could not find or found more than once.
- **`> *` is not `*`.** Declarations from the page's universal rule are written once as `.page *` only when the original selector is exactly the wrapper followed by `*`. A rule for direct children (`.page > *`) at 1800px and up had been widened to every element.
- **Strictest requirement wins.** Elements sharing a selector can face different competitors: an `<article>` card meets `body article { padding: 0 !important }` while link cards do not. A shorthand written back from longhands likewise faces every competitor any of its longhands faced. Both now keep the strictest `!important`/specificity requirement.

Found on the sponsor pages:

- **Pages that share styles are compiled as a group.** Sponsor ASME and Current Sponsors share many rules (`.asme-sponsor-page …, .asme-sponsors-page …`). With `--group=sponsor-asme,current-sponsors`, a selector is owned when every page it can match is in the group. Each page is compiled with `--emit`, which writes only its page file (the two can run in parallel), then `--strip` removes the group's selectors from the layers once.
- **A missing value is a difference.** Entries sharing a selector used to be merged when they agreed wherever both had a value. But if one element has no owned value for a property, the shared selector would still impose the other's value on it (a logo link picked up another tier's grid placement). Every element in the page content is now registered with the views it appears in, and entries are compatible only if they have the same value, or both have none, everywhere both appear.
- **Shorthand competitors count against longhands.** A shared `border-radius: var(--asme-radius-card) !important` is filed under `border-radius`; a page's `border-bottom-left-radius` winner must still out-rank it.
- **Hover and focus on any element.** States were probed only on links, buttons and form fields, so hover effects on cards were never recorded while their rules were still removed. Every element with owned styles is now probed.
- **Conditions the compiler cannot reproduce are carried verbatim.** The test views cover widths and light/dark only, and run with reduced motion. Rules under any other condition (`prefers-reduced-motion`, `orientation`, `print`, `hover`) are never re-derived. Their owned selectors are copied unchanged, with their `@media` chain, to the end of the page file, and their values never feed the derived rules. This matters because a `prefers-reduced-motion: reduce` rule would otherwise have been written unconditionally.

- **Carried rules compete as later rules.** Carried rules sit at the end of the page file, so a derived declaration that used to beat one (a dark-mode tier card over a portrait-tablet rule at 768×900) must now strictly out-rank it rather than tie.
- **`::placeholder` is invisible to DevTools.** It lives in the input's internal shadow DOM, so `CSS.getMatchedStylesForNode` reports only `::before`/`::after`. Page-owned selectors for any other pseudo-element (`::placeholder`, `::selection`, scrollbar parts) are carried verbatim. The style check also captures only `::before`/`::after`; the placeholder color difference on Sponsor ASME was caught by the screenshots.
- **Selectors are checked against their own elements.** The browser check now also warns when a generated selector fails to match every element it was built for. A context step had produced `.header .header > h2`, which matched nothing.

The first About and Calendar compiles (commits `ec5aa62`, `0864760`) lacked the last two fixes. They dropped the pillar and info-item hover lifts, their transitions, the Subscribe button's focus outline, and About's portrait-tablet hero rules (901–1100px, portrait). The screenshots run without hover and with reduced motion, so they could not show this. All pages were then recompiled from the Phase 1 stylesheet with the fixed compiler.

Found on Gallery:

- **Overlays outside the page content.** The footer script appends the photo lightbox to `<body>` and gives it its open-state classes only on click. The compiler examines only the page content and never clicks, so it carries verbatim any owned selector that needs a class never found inside the page content (the lightbox, body-level state classes such as `asme-lightbox-open-body`). Gallery's carried section is large (127 `!important`) for this reason: it holds the lightbox's rules unchanged.
- **Script layouts follow image load order.** The gallery script plans justified rows from each photo's aspect ratio, read from the loaded image or, before it loads, from its `width`/`height` attributes. One photo's file is 303×227 while its attributes say 768×576; that 0.1% difference decides between `span 4` and `span 5`. The harness now fires one `resize` after everything has loaded so scripts lay out again from final inputs. That fixed most cases, but `gallery--768` still varies between runs with the same stylesheet, matching on some runs and not others. Visitors can see either layout too. Treat a difference limited to two gallery photos' column spans there as noise.

Debugging: `DEBUG_KEY=<part of a selector> DEBUG_PROP=<regex>` prints the winners the compiler records for matching elements, and `DEBUG_RAW=<selector text>` prints the raw DevTools entries for matching rules.

## Limits

- Values are exact at the four sampled widths. Between them, a page now follows the four standard breakpoints instead of the legacy layer's 43. For example, a rule that switched at 900px now switches at 980px. Check widths between samples when reviewing a rebuilt page.
- States the suite does not render (error and loading messages, focus inside forms other than the forced ones) keep their legacy rules if those rules' names exist elsewhere, or move with the page if they are page-only names. Review such states by hand.
- Remaining `!important` in a page file beats a shared rule that has not been rebuilt yet (global heading fonts, dark-mode paragraph colors). It goes away when that shared rule is rebuilt.

## Progress

| Page | `!important` before → after (derived + carried) | Verified |
| --- | --- | --- |
| About | 467 → 13 + 11 | 106/106 pixels + computed styles |
| Calendar | 317 → 15 + 10 | 106/106 pixels + computed styles |
| Privacy | 0 → 0 (4 rules) | 106/106 pixels + computed styles |
| Sponsor ASME + Current Sponsors (group) | 1,866 → 185 + 85 | 106/106 pixels + computed styles |
| Gallery | 779 → 18 + 127 | 105/106; `gallery--768` varies run to run (see below) |

All pages were recompiled together from the Phase 1 stylesheet with the final compiler on November 19, 2026. Whole stylesheet compared with Phase 1: 635 → 610 KB minified (77.2 → 74.3 KB gzipped), 9,056 → 6,631 `!important`. "Carried" rules are copied verbatim (motion preference, orientation, `::placeholder`) and keep their original `!important`. The sponsor pages' derived rules still need `!important` in about 8% of declarations to beat site-wide button and form-field rules. That falls once those shared rules are rebuilt.

Privacy was already clean in the stylesheet. Its styling is a scoped `<style id="asme-privacy-styles">` block inside `Privacy Policy Page.html` (63 rules, 3 `!important`, its own `--pp-*` colors), published with the page through CampusPress. Only the tablet table-of-contents rules lived in `styles/*.css`; they moved to `styles/pages/privacy.css`. Moving the inline block into the stylesheet would also mean republishing the page (see `docs/privacy-page-publishing.md`), so it stays where it is. The 6 shared rules still reaching Privacy are the site-wide ones every page shares.

