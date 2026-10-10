# Gearly UI and UX recommendations

Reviewed October 10, 2026 against the working branch `feat/gearly-compact-cross-page-tour`. This review is based on the actual JavaScript, CSS, tour content, shared design tokens, and sprite manifest; the happy-head WebP was also inspected visually. It is a source and asset review, not a claim of browser, screen-reader, or production verification. Runtime work is proceeding separately, so the recommendations below distinguish the requested implementation from follow-up ideas.

## Design direction

Gearly should occupy one small square in the lower-right corner until someone asks for help. The tour should show the real destination page, explain one useful thing at a time, and use a relevant existing sprite as a small companion. Controls should make the next action clear while leaving the website itself visually dominant.

The highest-impact improvements are reducing the unsolicited invitation, explaining page changes before they happen, and matching instructions to what the modal actually lets people do.

## Requested changes in progress

The inspected working files already contain a 52px square launcher, tour replay inside the assistant header, 72px step sprites, and a ten-step tour spanning eight pages. Session storage records the next step before navigation and resumes on the destination page. These are implementation observations, not validation results; check the final diff and verification report before calling them complete.

| Change | Acceptance criteria |
| --- | --- |
| Compact launcher | Exactly one launcher is visible when closed. Its square bounds remain about 52px, with a recognizable head sprite and an accessible name. It does not cover page controls at a 360px viewport or 200% zoom. |
| Actual page transitions | Next and Back navigate to the intended chapter page and resume the intended step once its target is ready. Skip, Escape, and completion prevent unwanted later resumption. Refresh and unavailable storage have a comprehensible fallback. |
| Sprites throughout the tour | Each step has a purposeful pose; image load failures preserve readable content and controls. Images retain aspect ratio and do not increase the tooltip footprint substantially. |
| Cleaner controls | One progression action has emphasis. Back and close are quieter, have explicit accessible names, and retain usable touch targets and visible focus. |

## P1: Keep the invitation as compact as the launcher

`gearly.js` schedules a tour offer after four seconds. The original `gearly-tour.css` gave that offer a 340px card, 18px padding, a paragraph, and two filled red controls. On a phone it can span nearly the entire screen width. Moving the replay button into the assistant does not address this remaining visual interruption.

Prefer an on-demand invitation inside the assistant, with a short “Take a website tour” row. If a first-visit invitation remains, use a small dismissible prompt beside the launcher, without a large heading and explanatory paragraph. Keep its dismissal persistent and offer replay inside Gearly.

Tradeoff: an on-demand tour is less immediately discoverable. An explicit label inside the assistant offsets this without permanently occupying the page.

Acceptance: a visitor who does nothing sees no large card appear over page content; dismissal survives refresh; replay remains easy to find using touch and keyboard. Opening chat should dismiss any invitation so two competing surfaces cannot remain open.

## P1: Explain transitions with a clear primary action

At review time, the tour renderer mapped Next, Back, Skip, and Done to arrow, cross, and checkmark glyphs. Accessible names preserve some meaning for assistive technology, but sighted visitors still have to infer what the icons mean. A right arrow does not communicate that an entirely new page will load.

Use a compact primary action such as “Next →” with nearby destination text (“Next: Join”), or “Go to Join →” when the following step changes pages. Use a quiet Back control and place the close icon consistently in the upper-right corner. Use “Finish” on the final step. Keep labels about the user's destination, not session storage or implementation details.

Tradeoff: short text uses slightly more width than arrows alone, but makes navigation predictable. Reducing padding and removing redundant actions is preferable to removing meaning.

Acceptance: before activating Next, a visitor can tell whether they will stay on the page or move to another one. Keyboard and screen-reader names reflect the same action. All controls retain at least the site's established 44px touch-target convention, with one clear visual primary action.

## P1: Make tour copy agree with the interaction model

The tour is modal: background elements are inert and click/focus guards prevent interaction outside the tooltip. At review time, some copy said “open the menu button,” “Sign up here,” and “Use Find My Points,” even though those actions cannot be performed during that step.

For the current guided overview, use observational wording: “The menu contains the chapter pages,” or “After the tour, sign up here for email announcements.” Where taking action matters, offer “Finish tour and explore” and restore normal page interaction before proceeding. An interactive walkthrough would require a separate design for allowing and recognizing target interactions; it should not be implied by copy alone.

Acceptance: no step tells someone to perform a blocked action. Every step can be dismissed immediately. After dismissal, the highlighted section remains visible and keyboard focus returns to a meaningful control on the current page.

## P2: Give the tour a shorter default route

The ten steps currently cover navigation, featured event, Join, Calendar, two resource sections, points, pictures, leadership, and sponsorship. This is a useful comprehensive inventory, but it asks a new member to load eight pages before finishing.

Consider a five-stop default: welcome/navigation, Join, Calendar, Resources, and Points. Put chapter moments, leadership, and sponsorship in an optional “Explore more” continuation. Group steps on the same page and tell people the tour length before starting. Avoid automatically making a new member traverse sponsorship unless they choose it.

Tradeoff: a shorter tour shows less of the site. Optional follow-on topics preserve coverage while giving visitors a clear stopping point. This is a future content decision, not a request to remove the current required destinations during implementation.

Acceptance: the invitation accurately states the number of stops, progress does not appear to stall during loading, and the final action leaves people on a useful page with an obvious next task.

## P2: Use sprites to reinforce meaning

The manifest contains 22 poses, with both originals and WebP variants. The compact head sprites are better suited to a small launcher than tall full-body or edge-peeking poses. Keep the launcher visually stable; changing it with the chat's thinking and confused states can make the small persistent control harder to recognize.

| Context | Existing WebP | Purpose |
| --- | --- | --- |
| Closed launcher | `gearly-neutral-head.webp` or `gearly-happy-head.webp` | A readable face in a small square |
| Welcome/navigation | `gearly-smiling-wave.webp` | Greeting |
| Join/newsletter | `gearly-double-thumbs-up.webp` | Encouragement |
| Calendar | `gearly-calendar-presenting.webp` | Literal topic cue |
| Member resources | `gearly-laptop-presenting.webp` | Tools and reference material |
| Career resources or sponsorship | `gearly-executive-briefcase.webp` | Professional context |
| Member points | `gearly-growth-chart.webp` | Progress |
| Chapter photos | `gearly-laughing-head.webp` | Social context |
| Leadership | `gearly-presenting-open-arms.webp` | Introduction |
| Completion | `gearly-celebrating-jump.webp` | A distinct finish |

Use one pose per step, not a carousel of unrelated poses. A completion pose can be shown briefly within the final step rather than adding another blocking screen. Keep decorative images `alt=""` when the text conveys the meaning. Reserve image dimensions so loading does not move the controls. Preload only the next needed pose if browser testing reveals a visible delay.

Acceptance: every chosen pose is recognizable at its rendered size, no pose is stretched, and no instruction depends on interpreting the image. Reduced-motion users receive a static presentation.

## P2: Make small-screen placement preserve the target

The positioning helper clamps a 340px tooltip inside the viewport, then places it below or above the target. For a tall section, both placements may overlap the content being explained; scrolling a large target to its center does not guarantee its important heading or control stays visible. Some selectors identify full grids rather than a focused control.

Prefer a specific heading, card, or control as the target where it explains the step just as well. For constrained phone layouts, use a compact bottom card and scroll the target into the remaining visible area. Account for fixed headers, the keyboard, and safe-area insets. Do not further shrink body copy to fit a large illustration.

Acceptance: at 360px width, 200% zoom, and landscape orientation, the step title, current target, and progression controls can be understood without a tooltip covering the entire relevant section. No horizontal page overflow is introduced.

## P2: Announce step changes and recover from missing sections

The dialog has an accessible title, but step changes rebuild its content and focus Next. Explicitly associate the descriptive paragraph with the dialog and verify that a screen reader announces the new title, description, and progress once. Do not assume changing a heading while focusing an identically named Next button is sufficient.

The current renderer skips missing targets and completes when none remain. That avoids getting stuck, but silently jumping from step 3 to 5 can appear broken. If a destination section cannot be found after the bounded wait, explain that the section is unavailable and let the visitor continue or finish. Do not claim they completed content they never saw.

Acceptance: keyboard-only users can advance, go back, and exit across page loads; the background remains unavailable while the tour is modal; restored focus is sensible on the destination page. A missing target produces a brief explanation rather than an unexplained jump or completion.

## P3: Align Gearly with the site's design language

The site already defines DM Sans, a 12px control radius, and a shared focus color in `styles/design-system.css`. The tour currently uses system-ui and a separate scarlet value; the chat uses a different scarlet. Reuse established tokens with fallbacks so Gearly feels part of the site. Give secondary controls a quieter treatment and keep their focus states prominent.

Replace visitor-facing implementation language such as “rule-based” and “published event snapshot” with useful limits: “I can help you find ASME pages and events” and “Check the Calendar for event details.” Retain concrete freshness or source labels when they affect whether someone can rely on an answer.

Acceptance: light and dark themes have readable body text, links, and controls; explicit theme settings agree between the website, assistant, and tour. The first message explains what the guide helps with in everyday language.

## Suggested verification sequence

1. Start as a first-time visitor on desktop and at 360px width. Inspect the closed launcher and delayed invitation before opening anything.
2. Run the entire tour forward and backward, including refresh after a page transition. Verify both the destination and the highlighted section.
3. Dismiss with close and Escape; refresh and confirm the tour does not unexpectedly restart. Replay from inside Gearly.
4. Repeat with blocked storage, an unavailable target, and a failed sprite load. Confirm that content and controls remain usable.
5. Use keyboard only, then a screen reader, to check step announcements, modal isolation, focus restoration, and meaningful control names.
6. Inspect light/dark modes, reduced motion, 200% zoom, and a small landscape viewport. Record actual outcomes separately from these recommendations.

## Source references

- `assets/gearly/gearly.js`: launcher, chat header, invitation timer, avatar state, and opening/closing behavior.
- `assets/gearly/gearly.css`: launcher footprint, assistant layout, controls, themes, and motion.
- `assets/gearly/gearly-tour.js`: page persistence, target selection, modal behavior, controls, and step rendering.
- `assets/gearly/gearly-tour.css`: invitation, tooltip, spotlight, sprites, and control styling.
- `assets/gearly/gearly-data.json`: current ten-step route and visitor-facing copy.
- `assets/gearly/sprites.json`: 22 supplied poses and WebP asset paths.
- `styles/design-system.css`: site fonts, control geometry, focus, and motion conventions.

The implementation owner subsequently addressed the three P1 concerns: the invitation is now a 204px sprite row, opening chat dismisses it, each step names the next section or destination, and tour copy uses observational wording. Back/close controls have a quieter treatment; the dialog associates its progress and description for assistive technology. `docs/gearly-validation.md` records current implementation checks separately. The remaining ideas above are recommendations rather than implemented or browser-certified behavior.
