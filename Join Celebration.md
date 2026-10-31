# Join celebration

The Join page renders Newsletter → GroupMe → Welcome card directly in its HTML to avoid a layout flash. Styles load before the markup; celebration.js attaches the interactive flow and supports legacy two-step markup. The real newsletter integration and all form fields remain in place. Opening GroupMe arms Step 3; self-confirmation starts the animation from the beginning. No membership verification or automatic LinkedIn posting is claimed.

No test harness, mock fetch, test form action, or local GroupMe destination is deployed. Personalization is held in memory. A pending timestamp is stored in sessionStorage for up to 30 minutes; no name, email, or membership data is stored. Reduced motion skips effects. Escape and focus handling are scoped to dialogs. The embedded chapter logo makes PNG export independent of cross-origin assets.

To update: publish these three assets, bump all three version query strings in the Join Page.html block, and update WordPress page 69 with that source. Keep the existing form and newsletter script.

Rollback: remove only ASME JOIN CELEBRATION START/END from page 69. Native newsletter and GroupMe links remain. Restore the saved pre-deployment page if needed.

Validation: approved local browser review at 320–1920px; tested simulated newsletter outcomes, GroupMe return confirmation, animation/replay, reduced motion, LinkedIn helper/copy, PNG generation, and matching desktop card/button baselines. Physical mobile devices and independent Safari/Firefox remain unverified. Live verification does not require submitting the newsletter.

October 31 polish: larger responsive O–H / I–O formations, shared 9px button corners, scoped scarlet/navy controls, and a compact final panel.
