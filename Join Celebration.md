# Join celebration

The Join page renders Newsletter → GroupMe → Welcome card directly in its HTML to avoid a layout flash. Styles load before the markup; celebration.js attaches the interactive flow and supports legacy two-step markup. The real newsletter integration and all form fields remain in place. Opening GroupMe arms Step 3; self-confirmation starts the animation from the beginning. No membership verification or automatic LinkedIn posting is claimed.

No test harness, mock fetch, test form action, or local GroupMe destination is deployed. Personalization is held in memory. A pending timestamp is stored in sessionStorage for up to 30 minutes; no name, email, or membership data is stored. Reduced motion skips effects. Escape and focus handling are scoped to dialogs. The embedded chapter logo makes PNG export independent of cross-origin assets.

To update: publish these three assets, bump all three version query strings in the Join Page.html block, and update WordPress page 69 with that source. Keep the existing form and newsletter script.

Rollback: remove only ASME JOIN CELEBRATION START/END from page 69. Native newsletter and GroupMe links remain. Restore the saved pre-deployment page if needed.

Validation: approved local browser review at 320–1920px; tested simulated newsletter outcomes, GroupMe return confirmation, animation/replay, reduced motion, LinkedIn helper/copy, PNG generation, and matching desktop card/button baselines. Physical mobile devices and independent Safari/Firefox remain unverified. Live verification does not require submitting the newsletter.

October 31 polish: larger responsive O–H / I–O formations, shared 9px button corners, scoped scarlet/navy controls, and a compact final panel.

Reload styling: Join Page.html embeds the current celebration.css and join-three-step.css before page markup. It no longer waits on separate design stylesheet requests. After editing either stylesheet, run `node scripts/sync-join-styles.mjs`; use `--check` to verify the embedded styles are current, then publish Join Page.html to WordPress. The interaction script remains deferred.

The embedded CSS is generated as one line so WordPress wpautop cannot insert paragraph tags into stylesheet rules. Do not pretty-print the embedded style block.

Initial-render layout: WordPress paragraph wrappers around the GroupMe helper/action and welcome-card action use display:contents, so their flex layout matches the later JS normalization. Empty formatting paragraphs around the inline style block are hidden. The Join content has no extra horizontal inset, matching the navigation edges.

Animation refinement: larger separated startup gear, wide side cannons with a longer welcome beat, no top-left wordmark, icon-based sharing buttons and centered SVG dismiss control. Clicking the final backdrop returns to Join; sharing backdrop dismisses only sharing.

November 1 sharing and card polish: the LinkedIn helper uses a caption dropdown and one primary action per stage: copy caption, download card, then open LinkedIn. Three caption variants avoid em dashes; the preview uses higher contrast and a readable line height. Manual clipboard fallback never silently advances after a failed copy. PNG generation must succeed before the download stage advances. Extra helper text was removed.

Script Ohio fades out before the final card fades in. The card shimmer starts invisible and outside the card to avoid a first-frame flash; the exported PNG omits the diagonal shine stripe. Sound is opt-in and represented by speaker/mute SVG icons with accessible labels and a 44px target. The soundtrack is a synthesized, harmonized closing phrase of Carmen Ohio at 100 BPM, transcribed from the Tenor II melody in Ohio State's published score: https://music.osu.edu/sites/default/files/2024-05/carmen-ohio-ttbb.pdf . Muting, replaying, skipping or closing cancels queued notes, and unmuting during the intro joins the current position.

Validation for this revision: seven focused lifecycle, sharing, caption, PNG and audio scheduling tests plus the repository suite. Local browser verification covered PNG rendering, speaker/mute states and playback without console errors. Subjective audio quality is reviewed through the local preview.
