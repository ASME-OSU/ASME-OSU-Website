# Working on the ASME OSU website

Instructions for AI coding tools (Codex, Claude Code and others) and for people.
The live site is https://org.osu.edu/asme/ (WordPress on CampusPress). This
repository holds its stylesheet, scripts and page HTML. See `README.md` for the
full map of files.

## How changes reach the live site

| What changed | How it goes live |
| --- | --- |
| CSS (`styles/**`), scripts (`*.js`), `assets/**`, `data/**` | Merge to `main`; GitHub Pages serves them within about 10 minutes. Then bump the `?v=` value in WordPress (below). |
| Page HTML (`* Page.html`) | Not automatic. Paste into the page's editor in WordPress ([publishing guide](docs/campuspress-publishing.md)). |
| `Footer.html`, `Gearly Embed.html`, `Header Bootstrap.html`, `Header Embed.html` | Not automatic. They mirror code in WordPress **Settings → Advanced Settings** (Header Tag and Footer boxes). Change only the lines you changed; the WordPress copy differs slightly from the file, so never replace the whole box. |

WordPress loads `ASME%20Custom%20CSS.min.css?v=…` (Header Tag box) and Gearly's
`gearly.css` / `gearly-bootstrap.js` with their own `?v=` (Footer box). After a
change goes live on GitHub Pages, set a new date-label value (for example
`20261121-buttons1`) so returning visitors get it, and keep `README.md`,
`Footer.html` and `Gearly Embed.html` in step with what WordPress has.

Never merge, push to `main` or change WordPress without the maintainer's go-ahead
for that change. Never type passwords; when a sign-in page appears, ask the
maintainer to sign in.

## Changing styles

The stylesheet is built from layers by `npm run build:styles`:
`styles/tokens.css` + `styles/foundation.css` → legacy block in
`ASME Custom CSS.css` → `styles/design-system.css` and siblings →
`styles/pages/*.css` (one file per page, plus `footer.css`).

- **To change how one page looks, edit `styles/pages/<page>.css` by hand**, then
  run `npm run build:styles`. For colors, type and spacing used site-wide, edit
  `styles/tokens.css`.
- **Never edit `ASME Custom CSS.min.css`**, or the generated blocks of
  `ASME Custom CSS.css` (between the `ASME … START/END` markers). CI rebuilds them
  and fails if they differ from the sources.
- **Do not run the page compiler** (`scripts/css-compile-page.mjs`,
  `scripts/css-rebuild.mjs`) for ordinary changes. It regenerates a page file
  from scratch and discards hand edits. `css-rebuild.mjs` refuses to overwrite a
  page file that was edited after it was compiled (`styles/pages/.compiled.json`
  records the compiled version); pass `--force` only if you intend to lose those
  edits. Full rebuilds take about an hour: ask the maintainer first.
- Script-driven states need their own care. The compiler only ever saw one
  state, so rules for slides (`.active`, `is-active`), Join steps
  (`is-current`), the leaderboard and its loading skeleton, calendar cards and
  gallery photos must cover every state, not only the one on screen.
- Keep animations and transitions working with motion on, and honour
  `prefers-reduced-motion` (no animation for visitors who ask for less motion).
- Text only for screen readers uses the site-wide `.asme-sr-only` class.

### Checking a style change

The screenshot suite (`docs/visual-regression.md`) is local only; its folders are
git-ignored. Before editing CSS:

```bash
npm run visual:capture && npm run visual:baseline   # record the live site, take references (~10–15 min)
```

After editing and `npm run build:styles`:

```bash
npm run visual:compare                 # every page, light and dark; report in tests/visual/.output/report.html
node tests/visual/run.mjs --only=join  # or just one page
node tests/visual/motion-check.mjs     # animations/transitions with motion on (save a reference first with --save)
npm run test:browser                   # sign-up, slides, calendar retry and other flows screenshots cannot see
```

Screenshots run with reduced motion and a frozen clock, so they never show
motion, hover or later states. Check those with `motion-check.mjs`, the browser
tests, or the live site.

## Before every pull request

```bash
npm run check        # syntax, generated embeds, build freshness, guardrails
npm test             # behavior tests
npm run test:browser # browser flows (needs: npx playwright install chromium)
```

CI runs all of these on every pull request. If you changed CSS or Gearly files,
the pull request gets a reminder to bump the WordPress `?v=` values after merging.

## Things that look wrong but are intended

- Home hero photos rotate every 5 s and zoom 3.5% over 8 s; the highlight card
  rotates every 6.5 s. Both pause on hover or focus and stay still for reduced
  motion.
- `styles/live/*.json` lists rules the compiler deliberately left in the shared
  layers for script-driven widgets. Do not delete them.
- Feed workflows (calendar, Instagram, Google Photos, leaderboard) commit to
  `main` on their own schedule.

## Explaining work to the maintainer

The maintainer runs the chapter website and is not a full-time programmer.
Explain what changed and what visitors will notice in plain words, say what was
and was not checked, and ask before anything slow (full rebuilds) or anything
that publishes.
