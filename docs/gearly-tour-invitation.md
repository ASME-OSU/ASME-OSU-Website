# Gearly tour invitation redesign

The existing optional invitation now uses a 360×170px speech bubble above the launcher, with a seamless pointer, four blush circles, and the existing full-body waving sprite. Copy is “Take a tour”, “Let Gearley show you around!”, “Start tour →”, and “Maybe later”, plus a separately labelled close button. No character artwork, onboarding framework, or dependencies were added.

`assets/gearly/gearly-tour.js` reuses the existing tour start and versioned session dismissal state. Both dismissal controls use the same persistence handler. Dismissal fades for 180ms with motion enabled; opening chat or starting the tour removes the invitation immediately. A new guard also prevents offering the invitation beside an already-open chat. Reduced motion skips the exit delay and all decorative animations. The launcher animation is preserved.

`assets/gearly/gearly-tour.css` scopes the redesign to the invitation, including the tail, accent circles, button states, light/dark colors, responsive layout, and one-time entrance/mascot motion. On a 320px viewport the invitation is 296px wide, has no horizontal overflow, and clears the launcher by 20px. Tablet and desktop retain the 360px layout. Narrow screens allow the secondary action to wrap naturally.

Validation: available source/build checks and full unit/integration suite passed. Tour regression tests cover both dismissals, persisted opt-out, single-instance behavior, existing tour launch, open-chat suppression, fade cleanup, and reduced motion. Browser QA verified desktop light mode, 320px light mode, 768px dark mode, both dismissal controls, starting the existing walkthrough, and chat coexistence. No Gearly console errors were observed; unrelated installed-extension warnings were excluded.

Loader cache version: `20261014-v2-10` in `Gearly Embed.html` and the matching Footer block. Existing tour progress and dismissal keys are unchanged, so returning visitors who already dismissed this invitation will not be prompted again during that session.

## Compact mobile update (`20261014-v2-11`)

At widths up to 600px the same invitation becomes a 200×106px speech bubble showing only “Take a tour”, “Start →”, and close. The full-body image, subtitle, and secondary action are hidden with CSS. The existing decorative wrapper clips three blush circles inside the rounded card while the tail remains outside it. The Start pill paints at 34px high inside a 44px button; close also retains a 44px target. Both visible labels share the original Start button and handler.

Scoped mobile geometry shares the launcher's 64px size and edge offsets, adds a 16px gap, and accounts for right/bottom safe-area insets. Entrance motion is 6px over 230ms; reduced-motion overrides remain in effect. Above 600px the desktop appearance, artwork, spacing and animation remain unchanged.

Browser verification covered 320, 375, 390, 430 and 600px compact layouts (no horizontal overflow; 16px launcher gap) plus 768 and 1440px unchanged desktop layouts. Verified existing Start walkthrough, X dismissal, persistence through chat open/close, and immediate invitation removal when opening chat. Source/build checks, the 48 tour/chat UI tests and the full test suite passed. No Gearly browser console errors were observed.
