# Mobile walkthrough layout and scrolling

The live 390px tour reproduced two issues: 290–316px guide cards covered highlighted sections, and `scrollIntoView` combined the site's scroll margin with another fixed 96px offset. Content inserted above the Calendar after arrival moved its target down underneath the guide.

The mobile walkthrough now uses a compact full-width bottom guide (12px side/bottom clearance), 36px portrait, smaller type and controls that remain accessible. Its height follows content and is capped at 45% of the visual viewport. Desktop styling is preserved.

For each mobile stop, direct instant scrolling aligns the target below the actual fixed/sticky header and admin bar, without adding CSS scroll margins. Arrival can correct late layout movement for eight seconds. Any user wheel, pointer, touch or scrolling-key input immediately disables that correction; unchanged document-end clamps are not retried each frame. The guide does not chase page content.

The spotlight is limited to the visible page region above the guide with a 12px gap. Large sections show a scroll hint. Temporary document-end space lets the last content move above the guide and is removed on exit. Since the modal makes background content inert, swipe and wheel gestures outside the guide are forwarded to the page. Page Up/Down and Home/End also explore the active section without moving the guide; scrolling inside the guide remains local.

QA:

- Walked all eight original stops on the live 390px website and recorded the overlaps, including the Calendar starting beneath the guide.
- Walked all eight corrected preview stops at 390×844 and 320×568. Spotlight and guide did not overlap; long sections retain page scrolling. Guide heights at 390px were approximately 184–225px versus 268–316px before.
- Browser-verified Page Down advances page content while the guide remains fixed, and Finish returns Home and removes temporary spacing.
- Regression tests cover header clearance, late layout shifts, immediate user-scroll handoff, document-end space, clamped-scroll stability, swipe/wheel forwarding, Page Down/End and cleanup.
- Source/build checks and all 232 local tests passed, including 26 tour tests. Unrelated worktree changes were excluded.

Cache loader: `20261014-v2-12`. Existing invitation design, route validation, cross-page progress, dismissal persistence and chatbot behavior remain in place.
