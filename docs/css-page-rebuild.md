# Rebuilding a page's styles (Phase 2)

Each page's styling is spread across the legacy layer, page-only rules in `styles/design-system.css` and its siblings, and page selectors buried inside shared rules (dark-mode lists, shared buttons). Phase 2 moves one page at a time into `styles/pages/<page>.css` without changing how it looks.

## Steps

Phase 2 is finished: day-to-day style changes are edits to `styles/pages/<page>.css` followed by `npm run build:styles`. Never recompile a page you have edited by hand; the compiler regenerates its file from scratch. The compiler is only for moving more rules out of the legacy layer, or for redoing the migration.

```bash
node scripts/css-rebuild.mjs gallery --verify    # one page (its group too), then its screenshots and browser tests
node scripts/css-rebuild.mjs --verify            # every page, then the full check
JOBS=2 node scripts/css-rebuild.mjs …            # pages built at once (default: half the cores, at most 4)
sh tests/visual/watch.sh /tmp/rebuild.log        # live progress, if the run's output goes to that log
```

`scripts/css-rebuild.mjs` compiles every page against the same input, the Phase 1 stylesheet (commit `5cb11bb`) with no page files, so pages do not depend on each other. They build in parallel, and one page can be redone alone in about 10 to 15 minutes instead of rerunning the whole chain. Each compile writes only its page file (`--emit`) and the list of rules its live widgets use (`styles/live/<page>.json`). Then every page's owned rules are removed from the shared layers with `--strip`, which renders nothing and takes seconds, and the stylesheet is built once. On an 8-core Mac, 4 compiles at once overloaded the machine (each ran 2 to 3 times slower), so use `JOBS=2` there.

`styles/pages/.compiled.json` records a fingerprint of each page file as the compiler wrote it. `css-rebuild.mjs` refuses to recompile a page whose file no longer matches (someone edited it by hand, as intended for ordinary style changes), so those edits are not silently lost; `--force` overrides. Home is hand-edited (hero zoom and slide framing) and is therefore protected.

The first versions compiled pages one after another, each from the layers the previous page left. Fixing one page meant rerunning the whole chain (over an hour).

## How the compiler works

`scripts/css-compile-page.mjs` lets Chrome resolve the cascade instead of re-deriving it:

1. It renders the page at 375, 768, 1280 and 1920px in light and dark mode. For every element in the page content, including `::before`/`::after`, `:hover` and `:focus-visible`, it asks the DevTools protocol for the matched rules in cascade order.
2. A matched selector is **owned** when the classes and ids it requires appear on this page and on no other rendered page. Where an owned declaration wins, its value is re-emitted.
3. Each element gets an exact selector: its classes with `:not(.variant)` for any element carrying the same classes plus more. Elements that share a selector but are styled differently are separated by `:empty`, then by their nearest classed ancestor, then by position.
4. Values are written mobile-first for ten sampled widths (375, 480, 640, 768, 900, 1100, 1280, 1440, 1700 and 1920px) and light/dark. Each sampled width's value applies from that width up to the next. Each declaration gets only as much specificity and `!important` as the remaining shared rules competing with it require.
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

Leadership's main styling is `styles/leadership.css` (the November 2026 redesign, 42 rules scoped to `.asme-leadership`), loaded by a `<link>` in `Leadership Page.html`. It is not part of the bundle and was left as is. The redesign kept some earlier class names (`.leader-card`, `.lb-grid`, the year tabs), so 25 legacy rules still styled the page underneath it. Those moved to `styles/pages/leadership.css`; despite the similar name, that is the compiled page file, not the redesign file. The page wrapper in `PAGE_SCOPES` changed from `.leadership-board` to `.asme-leadership`.

Found on Gallery:

- **Overlays outside the page content.** The footer script appends the photo lightbox to `<body>` and gives it its open-state classes only on click. The compiler examines only the page content and never clicks, so it carries verbatim any owned selector that needs a class never found inside the page content (the lightbox, body-level state classes such as `asme-lightbox-open-body`). Gallery's carried section is large (127 `!important`) for this reason: it holds the lightbox's rules unchanged.
- **Script layouts follow image load order.** The gallery script plans justified rows from each photo's aspect ratio, read from the loaded image or, before it loads, from its `width`/`height` attributes. One photo's file is 303×227 while its attributes say 768×576; that 0.1% difference decides between `span 4` and `span 5`. The harness now fires one `resize` after everything has loaded so scripts lay out again from final inputs. That fixed most cases, but `gallery--768` still varies between runs with the same stylesheet, matching on some runs and not others. Visitors can see either layout too. Treat a difference limited to two gallery photos' column spans there as noise.

Found on Join:

- **State combinations the suite never renders.** After a sign-up, the script moves the steps along with `is-current`/`is-complete`. A rule such as `.join-step--groupme.is-current` combines classes that each appear on the page, but never together in any rendered state. The compiler now tests every page-owned selector against each view and carries verbatim any that never match.
- **State-dependent selectors are never derived.** `.join-form-status[hidden] { display: none !important }` won in every rendered view, because the status message is hidden until a form is submitted. It was written as an unconditional `display: none`, so the confirmation and error messages never appeared. The screenshots could not show it; `npm run test:browser` (the newsletter flow) did. Selectors using attributes that change at runtime (`[hidden]`, `[open]`, `[disabled]`, `[aria-*]`, `[data-*]`) or pseudo-classes such as `:empty`, `:has()`, `:checked` and `:invalid` are now carried verbatim and compete as later rules. All pages were recompiled with this fix, and `test:browser` is part of every page's verification.

Found on the member pages:

- **Duplicate rules map one to one.** When DevTools gives no source data, the compiler looks the rule up in the built stylesheet. The same selector and media can occur several times with different declarations (the leaderboard rows have several). Identical selectors match the same elements with the same specificity, and DevTools lists them in source order, so the n-th match for an element is the n-th occurrence in the source. Merging all occurrences, as before, mixed values between them.
- **Each page needs a wrapper class no other page has.** Both member pages carry `.asme-members-page`. Member Points' rules were keyed on it and so also hit Member Resources. `PAGE_SCOPES` now lists `.asme-points-page-v2` first for Member Points.
- **In a group, carry only what matches no group page.** A selector that never matched on Member Resources was copied verbatim into its page file, while Member Points derived the same rule. Every page file lands in one bundle, so the carried copy overrode the derived one on Member Points. Each compile in a group now also tests the owned selectors against the other group pages, and carries a selector only if it matches nowhere in the group.

- **Declaration order within a rule.** A rule with `border: 1px solid #ebc6cc !important` followed by `border-left: 4px solid var(--asme-scarlet) !important` gave both the same priority, so the earlier 1px pink left border could be emitted after the red one. Each declaration now carries its position in the rule as a tiebreaker.
- **Universal rules on a shared wrapper.** `.asme-members-page *::before` was not recognized as a page-wide universal rule (the page's own wrapper is `.asme-member-resources-page`), so it was written once per element: one rule with about 770 selectors, around 80 KB per member page file. Any wrapper class of a page in the group now counts.

## Widths: each page's own switch points

Besides ten fixed widths (375, 480, 640, 768, 900, 1100, 1280, 1440, 1700, 1920), the compiler samples each page at its own original switch points: every `min-width`/`max-width` used by a rule naming the page's classes (`max-width: X` switches at X + 1). With the fixed widths alone, a page that switched at 769, 901 or 981px used the narrower layout up to the next sample, and portrait iPads (about 769–1099px) differed from the original on most pages (Join's step bar overlapped). Pages now use 12–18 widths. A check at 375, 600, 769, 834, 950, 1024, 1100, 1150, 1280 and 1920px matched the original on every page.

Compile one page at a time (`scripts/css-rebuild.mjs` default). With three at once on an 8-core Mac, each page ran 2–7 times slower and some views rendered wrongly (Home came out at ten times its size); Home alone took 14 minutes and was exact.

## Live widgets: rules left in place

Parts that scripts change while the page is used (slides and tabs with `is-active`, Join's `is-current` steps, gallery filters), and lists built from live data (the points leaderboard and its loading skeleton, calendar cards, gallery photos), are never derived. The compiler sees one state and one data set, so derived rules break the other states. The first rebuild did exactly that: Home's second highlight slide (the Career Guide) had no rule for its active state and showed an empty card, and leaderboard rows 6 to 10 were pinned by position (`div:nth-child(6)`), so the loading skeleton's first rows collapsed.

A class counts as live when a site script adds, toggles or removes it (read from the repository's `*.js` files, except steady ones such as the scroll-reveal `is-visible`), or when it belongs to a live data list (`LIVE_DATA` in the compiler). Before deriving anything, a first pass finds every owned rule that reaches an element inside a live widget, in any view (`styles/live/<page>.json`). Those rules, and every rule naming a live class, stay exactly where they are in the shared layers. They are not moved to the page file, because there, as the last rules, they overrode site-wide rules they used to lose to (the calendar cards' corner radius). The main pass treats them as competitors, so derived rules for the rest of the page still outrank them as before.

The visual suite has two states for this: `home--spotlight-2` (the second highlight slide) and `member-points--leaderboard-loading` (the skeleton).

## Motion: compiled with motion on

The screenshot suite renders with reduced motion so pictures are stable. The compiler first did the same, so the site's `prefers-reduced-motion` rules (`transition: none`, `animation: none`) won in every view it saw. The normal transitions were never derived and disappeared for everyone else: about 1,400 elements lost their hover and fade transitions (0.15–0.25 s color, background and lift changes), and the gallery lightbox lost its fade-in. Screenshots cannot show motion, so nothing failed.

The compiler now renders with motion on (`MOTION` in the compiler; the harness reports every scroll-reveal section as already in view). Reduced-motion rules are carried over verbatim and still apply for visitors who ask for less motion. `node tests/visual/motion-check.mjs` compares every element's animation and transition settings with motion on against a saved reference (`--save` with the trusted stylesheet first); it is part of the final check.

The hero photo zoom (`ah-ken-burns`) was not lost in the rebuild: the November 17 accessibility change set `animation: none` on the hero slides, along with removing the slide rotation. Both were restored on request on November 20; the zoom is a hand-written rule at the end of `styles/pages/home.css`.

## Shared components: footer and header

The footer and the original theme header appear on every page, so page ownership does not apply. Only the footer is rebuilt; the theme header stays in the legacy layer (see below). They are compiled as components: `node scripts/css-compile-page.mjs footer --write --tokens` (or `header`). A component is rooted at its own element (`.asme-footer-inner`; `.site-header` for the WordPress theme header, which is hidden while the custom header from `Header.css` is loaded and shown if that fails). It is rendered on Home. A selector is owned when every class it needs occurs inside the component and at least one occurs nowhere else on any page. The output goes to `styles/pages/footer.css` and `styles/pages/header.css`. The custom header itself stays in `Header.css`, which is not part of this bundle.

Found while compiling them:

- **Components sit outside `#page`,** so they gain specificity by repeating their root class (`.asme-footer-inner.asme-footer-inner …`) instead of the `#page`/`html body` prefixes pages use. Repeated classes cannot outrank an id (the theme's `#site-navigation` rules). Against normal competitors the compiler then uses `!important`, and it warns if even that would not win.
- **Shorthand winners face longhand competitors.** The theme header's `background: linear-gradient(…, var(…)) !important` is kept whole; the theme's own `.site-header { background-color: … }` is filed under the longhand and was not counted. Competitors are now related in both directions, but only those the winner actually beat (lower priority) count. Counting all of them made Member Points' base `background: var(--m-card) !important` beat the later active-link `background-image` it must lose to.
- **When no class separates siblings, use positions (components only).** The footer's Connect links share classes, but only some have owned styles, so those selectors are pinned to exact positions. On pages, pinned selectors became specific enough to beat state rules, so pages only warn.

**The theme header stays in the legacy layer.** Its menu marks the current page with `current-menu-item`, which sits on a different item on every page. Compiled on Home, the header's rules fit Home's menu and not the others. Treating page-varying classes as state, so they are kept out of keys and carried, fixed the keys but left non-current items without their normal styles. This header is only a fallback, shown if the custom header in `Header.css` fails to load, and it has about 55 rules, so it was left as it was. The `header` entry in `COMPONENTS` and the page-varying-class logic remain for future use.

**Base values beneath state rules are off.** One attempt recorded, for an element whose winning rule is carried (a state rule), the value that wins without it, as a base style beneath the state. That restored the non-current menu items, but it broke rendered states elsewhere: a base could outrank state rules that apply on other pages or after interaction, such as Member Points' active jump link. Screenshots fell from 102/106 to 72/106. It is disabled by default (`BASE_BENEATH_STATE=1` turns it back on for experiments), and carried winners record nothing, as before.

Debugging: `DEBUG_KEY=<part of a selector> DEBUG_PROP=<regex>` prints the winners the compiler records for matching elements, and `DEBUG_RAW=<selector text>` prints the raw DevTools entries for matching rules.

## Limits

- Values are exact at the ten sampled widths. Between two samples, a page follows the lower one, so a legacy rule that switched at 560px or 980px now switches at 640px or 1100px. The first version sampled only four widths (375, 768, 1280, 1920). At 480, 640, 900 and 1100px, pages then stretched their phone or tablet layout (single-column cards and full-width buttons on About at 640px, Home's cards stacked at 900px). An in-between check against the Phase 1 stylesheet showed this, and the compiler moved to ten widths so iPads and small laptops keep their layouts. The rebuild verification includes that check (`VISUAL_WIDTHS=480,640,900,1100,1440,1700`).
- States the suite does not render (error and loading messages, focus inside forms other than the forced ones) keep their legacy rules if those rules' names exist elsewhere, or move with the page if they are page-only names. Review such states by hand.
- Remaining `!important` in a page file beats a shared rule that has not been rebuilt yet (global heading fonts, dark-mode paragraph colors). It goes away when that shared rule is rebuilt.

## Progress

| Page | `!important` before → after (derived + carried) | Verified |
| --- | --- | --- |
| About | 467 → 13 + 15 | screenshots + computed styles + browser tests |
| Calendar | 317 → 19 + 21 | screenshots + computed styles + browser tests |
| Privacy | 0 → 0 (4 rules) | screenshots + computed styles + browser tests |
| Sponsor ASME + Current Sponsors (group) | 1,866 → 186 + 233 | screenshots + browser tests; Current Sponsors 768px note below |
| Gallery | 779 → 18 + 149 | screenshots + browser tests; `gallery--768` varies run to run |
| Leadership | 67 → 5 + 61 | screenshots + computed styles + browser tests |
| Join | 825 → 109 + 57 | screenshots + computed styles + browser tests (newsletter flow); see Join note below |
| Member Resources + Member Points (group) | 983 → 45 + 123 | screenshots + computed styles + browser tests |
| Home | 1,359 → 63 + 70 | screenshots (incl. menu, search, header fallback) + computed styles + browser tests (slideshow, carousels) |
| Footer (component) | ~396 → 11 + 28 | all 106 screenshots (it is on every page) + browser tests |

All eleven pages and the footer were recompiled together from the Phase 1 stylesheet with the final compiler on November 20, 2026. Result with ten sampled widths: 102/106 screenshots match in pixels and computed styles, 141/144 at the in-between widths (480–1700px, compared with Phase 1), and all 9 browser tests pass. The Join page's GroupMe button was checked directly in its normal, hover and focus states, in light and dark, and is identical. Whole stylesheet compared with Phase 1: 9,056 → 3,031 `!important`, 77.2 → 75.1 KB gzipped (651 KB minified). The ten-width version is about 4 KB larger gzipped than the four-width one (71.0 KB): more width ranges, in exchange for tablets and small laptops keeping their layouts. The legacy layer is down to 546 rules: the theme header fallback, the Blog page, states the suite never renders, and theme-state rules. The carried sections hold rules copied verbatim, with their original `!important`. The differences: `gallery--768` and `gallery--900--dark` (the timing-dependent justified row, 1px), and `current-sponsors--768`/`--900` (light and dark), where four empty, zero-height WordPress `<p>` elements in the logo cards occupy a different grid cell (pixel-identical).

Join's derived `!important` rose from 48 to 109 with ten widths. Its WordPress content carries an inline `<style>` block of about 400 `!important` declarations with breakpoints from 520 to 1279px; at the added widths more of those apply and have to be matched. `tests/css-foundation.test.mjs` gives Join a 16% budget (other pages 10%) until that block moves out of the page HTML.

Privacy was already clean in the stylesheet. Its styling is a scoped `<style id="asme-privacy-styles">` block inside `Privacy Policy Page.html` (63 rules, 3 `!important`, its own `--pp-*` colors), published with the page through CampusPress. Only the tablet table-of-contents rules lived in `styles/*.css`; they moved to `styles/pages/privacy.css`. Moving the inline block into the stylesheet would also mean republishing the page (see `docs/privacy-page-publishing.md`), so it stays where it is. The 6 shared rules still reaching Privacy are the site-wide ones every page shares.

