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

## Limits

- Values are exact at the four sampled widths. Between them, a page now follows the four standard breakpoints instead of the legacy layer's 43. For example, a rule that switched at 900px now switches at 980px. Check widths between samples when reviewing a rebuilt page.
- States the suite does not render (error and loading messages, focus inside forms other than the forced ones) keep their legacy rules if those rules' names exist elsewhere, or move with the page if they are page-only names. Review such states by hand.
- Remaining `!important` in a page file beats a shared rule that has not been rebuilt yet (global heading fonts, dark-mode paragraph colors). It goes away when that shared rule is rebuilt.

## Progress

| Page | `!important` before → after | Legacy rules reaching content before → after | Verified |
| --- | --- | --- | --- |
| About | 467 → 13 | 19 → 6 | 106/106 pixels + computed styles, Nov 19 2026 |
