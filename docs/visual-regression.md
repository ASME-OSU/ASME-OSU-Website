# Visual regression suite

Use this before and after any stylesheet change. It screenshots every public page and compares the result with screenshots taken before the change. The stylesheet cleanup depends on it: each page is rebuilt only when its screenshots still match.

## What it covers

- 12 pages: Home, About, Join, Calendar, Gallery, Leadership, Sponsor ASME, Current Sponsors, Member Resources, Member Points, Privacy, Blog.
- 4 widths (375, 768, 1280, 1920) in light and dark mode: 96 screenshots.
- 5 interaction states in light and dark: mobile menu open, search open, Join FAQ expanded, gallery lightbox, and the original-header fallback (header component blocked). 10 screenshots.

Pages and states are listed in `tests/visual/config.mjs`.

## How it works

1. **Capture** (`npm run visual:capture`) loads the live site once and records every response (page HTML, WordPress theme files, photos, data feeds) into `tests/visual/.snapshot/`.
2. **Replay** serves that recording offline. Requests for this repository's own published files (`asme-osu.github.io/ASME-OSU-Website/…` and the jsDelivr copy) are answered from the working tree instead, so local CSS and JS edits show up. JSON data stays frozen: calendar events, Instagram and Google Photos feeds, the points sheet, and the Social Hub campaign archive. Only code changes can move a pixel.
3. Each screenshot runs with a frozen clock (the capture time), seeded `Math.random`, reduced motion, software rendering in sRGB, and a blank frame in place of the Google Calendar embed. The visitor starts as one who chose "Maybe later" on Gearly's tour invitation, which otherwise appears on a 4-second timer.

The snapshot, baselines and output are git-ignored. They are local to your machine, so capture and compare on the same computer.

## Workflow

```bash
npm run visual:capture      # once, or when you want fresh live content
npm run visual:baseline     # before editing CSS
# …edit CSS, run npm run build:styles…
npm run visual:compare      # after editing
```

Open `tests/visual/.output/report.html` to see baseline, current and changed pixels side by side for every screenshot that differs. Limit a run with `--only`, for example `node tests/visual/run.mjs --only=join,calendar--375`.

After `visual:capture --fresh`, rewrite baselines from unchanged code before comparing; otherwise content changes on the live site will show up as differences.

## How screenshots are compared

- **Outside photos:** any pixel that changes by more than 2 (out of 255) in any color channel fails.
- **Photos** (`<img>` and CSS background photos): the position and size of every photo must match exactly. Inside a photo, the average color change must stay under 12. Chromium rescales large photos with slightly different filters from run to run, which produces up to about 9 on text-heavy flyers. A missing or swapped photo scores over 100, and a 3px shift of the crop about 15. A 1–2px shift of the image inside an unchanged frame (`object-position`) can go unnoticed. A 3px band at photo edges is skipped because rounded-corner anti-aliasing varies.

Adjust with `--photo-mean=N` or allow a few changed pixels with `--max-pixels=N`.

- **Computed styles:** every element's and `::before`/`::after`'s final style values must also match. This catches cascade changes with no visible effect, such as a background that now matches its parent or a hidden element's color. Values the browser derives from layout (width, height, margins, offsets) and the scroll-reveal script's `--asme-delay` are skipped. Newly added custom properties are ignored until something uses them. Use `--pixels-only` for an intended redesign where only the look matters. Details are in `tests/visual/styles.mjs` and [css-foundation.md](css-foundation.md).

## Checking the harness

`--inject-css="…"` appends CSS to the main stylesheet for one run without editing it. The suite was verified to:

- produce 106/106 matches on repeated runs with no changes;
- catch a subtle heading color shift (About), a 1px border-radius change on JavaScript-rendered calendar cards, a 1px gap in the points leaderboard, a photo crop change, a removed Gearly launcher, and footer padding;
- flag dark-mode-only and widescreen-only changes only in the matching screenshots.

The injected rule must win the cascade to have any effect. Many current rules use `html body #page … !important`, so test selectors need `html body #page#page .entry-content …` and `!important`.

## Known limits

- The live server answers bursts of requests with HTTP 429. Capture uses two workers, retries with back-off, never records an error response, and refuses to compare when a page was not recorded successfully. Run capture again to fill gaps.
- Page HTML comes from the recording, so it reflects the live WordPress content. Edits to the HTML files in this repo (copy/paste blocks) do not appear until they are published and recaptured. Inline `<style>` blocks inside pages (the Join page's critical styles) are part of that HTML.
- Third-party embeds (Google Calendar iframe) are blank. Their internal styling is outside this repository.
- Chromium only, at emulated sizes. This is not a cross-browser or physical-device test.

To watch a long run, `sh tests/visual/watch.sh <log file>` in a second terminal shows how many screenshots each stage has written, what is running, and the end of the log.

Run the suite at other widths with `VISUAL_WIDTHS`, for example to check sizes between the four standard ones:

```bash
VISUAL_WIDTHS=480,640,900,1100,1440,1700 node tests/visual/run.mjs --update --only=--480--,--640--,--900--,--1100--,--1440--,--1700--
```

Take the reference with the stylesheet you trust, then run without `--update` after the change.

## Motion

Screenshots run with reduced motion, so they cannot see animations or transitions. `node tests/visual/motion-check.mjs` renders every page at 375 and 1280px, light and dark, with motion on and compares each element's animation and transition settings with a reference. Save the reference from the stylesheet you trust (`--save`), change the CSS, then run it without `--save`.
