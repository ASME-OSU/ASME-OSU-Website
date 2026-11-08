# Page transition audit — November 7, 2026

## Scope and verification limits

Reviewed all ten authored page templates, the WordPress Blog, shared CSS, installed footer behavior,
navigation, gallery dialogs/carousels, signup progression, sponsorship dialogs,
and Points dashboard selection. Browser access was initially disabled. A follow-up
browser review visited all eleven production pages at 1280px in dark mode with
normal motion, confirmed missing card opacity transitions and nested Home/FAQ
reveals, and exercised FAQ, Gallery and sponsorship dialogs. Mobile checks used
390px; an ultrawide Sponsor ASME check used 3440px. This is not a frame-rate
certification, and light mode/reduced-motion visual checks remain outstanding.

The live WordPress REST inventory lists eleven published pages. Fetched all
eleven successfully and confirmed that each installs both the legacy motion
footer and the external `Footer Integration.js` upgrade entrypoint. The Blog
contains ten post excerpts and a sidebar using the shared reveal selectors.
The fetched live HTML also passed 33 DOM scenarios (eleven pages in three motion
modes) using its installed inline footer script and the updated external upgrade.

The shared motion tests execute each actual page template with the footer in
normal-motion, reduced-motion, and unavailable-IntersectionObserver modes. The
external footer upgrade is also tested against the older CMS footer behavior.
Existing navigation, carousel, dialog, signup and loading-state tests provide
additional interaction coverage. They do not measure perceived animation quality.

## Findings and changes

- Hover transition shorthands omitted opacity, overriding the reveal fade on
  cards. Shared reveal transitions now explicitly include opacity and transform,
  with 360ms entrances and immediate hover feedback after arrival.
- Parent and child reveal targets could both translate/fade. The external
  footer upgrade removes redundant descendant reveals and caps sibling stagger
  at 140ms. Existing mobile Home content treatment is preserved.
- Initial hero sections could be hidden after their first paint by late footer
  initialization. Initial headings now remain visible; below-fold reveals remain.
- The footer lacked a no-IntersectionObserver fallback for regular sections.
  Both the maintained footer and externally delivered upgrade now reveal content
  without it. The upgrade also reveals a section immediately when keyboard focus
  enters it, rather than waiting for scroll observation.
- Points member selection always requested smooth scrolling. It now reads the
  current reduced-motion preference before scrolling to the dashboard.

## Page-by-page review

| Page | Reviewed transitions | Result |
| --- | --- | --- |
| Home | Hero startup, two carousels, event/About entrances, impact counts, card hover | Stable hero; shared fade/nesting/stagger fixes apply. Existing carousels pause on focus/hover and start manually under reduced motion. |
| About | Hero, mission/pillars, statistics, history, CTA | Stable hero; shared fades and nested-target cleanup apply. |
| Join | Introduction, signup cards/progress, FAQ, success progression | Stable introduction; FAQ parent/child stacking removed. Existing signup scroll respects reduced motion. |
| Calendar | Heading, month view, help cards, subscription controls | Stable heading; shared fade/hover fixes apply. The embedded Google Calendar's internal transitions are third-party behavior. |
| Gallery | Hero, asynchronous archive reveals, Instagram carousel, lightbox | Stable heading; existing late-item initializer and dialog focus tests retained; shared fade/fallback applies to archive items. |
| Leadership | Year groups, officer cards, portrait hover | Live officer cards lack opacity transitions; shared fade fix applies. No nested reveal targets were found in the live markup. |
| Current Sponsors | Hero, sponsor cards/logos, CTA | Stable hero; card reveal opacity no longer overridden by hover transitions. |
| Sponsor ASME | Hero, benefit/tier sections, inquiry form, tier dialog | Stable hero; shared entrance/fallback/focus fixes apply. Tier dialog opens/closes without requiring animation to complete. |
| Member Resources | Resource cards, links, shared navigation/footer | Existing restrained hover feedback retained; no artificial section animation added. |
| Member Points | Loading skeletons, search/dashboard selection, bar updates, jump navigation | Selection scroll now respects reduced motion. Existing loading, empty/error state, and reduced-motion skeleton behavior retained. |
| Blog | WordPress post excerpts, sidebar widgets, shared navigation/footer | Live review found ten post cards missing opacity transitions. The shared CSS fix explicitly covers articles outside `.entry-content`; native post/archive navigation is retained. |

## Delivery

The CSS build regenerates both main stylesheets. `Footer Integration.js` is
already installed sitewide through WordPress's header settings; the compatibility
upgrade is delivered through that existing URL. No CMS paste is needed for these
fixes. `Footer.html` also contains the corrected fallback for future installations.

## Remaining visual verification

The published site was inspected before these fixes were deployed. After approval
and deployment, verify the corrected timing in both color schemes, tab through
interactive cards, test slow image/feed loading, and confirm reduced-motion
preferences. Mobile Home navigation opens/closes with Escape; Gallery Next changes
the image and Escape restores focus; Sponsor ASME keeps all six tiers in one row
at 3440px. No cross-document animation was introduced: normal
WordPress navigation, history, modified clicks and external destinations remain
native.
