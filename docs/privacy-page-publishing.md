# Privacy Policy page

Prepared November 13, 2026. Source: `Privacy Policy Page.html`.

## CampusPress publication

1. Follow `docs/campuspress-publishing.md` for backups, editor settings, saving, and read-back verification.
2. Create a page titled **Privacy Policy**, with slug **privacy-policy**, at `https://org.osu.edu/asme/privacy-policy/`. Use the same full-width/no-sidebar template and hidden native page title as the other custom chapter pages. Paste the complete fragment, including its scoped style block, into the HTML editor. Disable automatic paragraph insertion for this fragment.
3. Publish and verify the privacy page first. Its styling is self-contained and does not require a shared stylesheet release.
4. Update the Join page with `Join Page.html` and the shared footer markup with `Footer.html`. These add privacy links. Do not activate those CMS copies before the page exists.
5. Verify the page, footer link, and newsletter notice on desktop and mobile, including dark mode and keyboard access. Confirm the signup still uses its existing Brevo form action.

A GitHub push supplies source and assets; it does not create a WordPress page or replace saved CMS content. This change deliberately does not inject the new link through the live footer JavaScript before the CMS destination exists. The current v2 footer preserves its supplied markup.

## Content basis and maintenance

The notice reflects the existing signup fields and Brevo integration; approved public points export; public photos and officer information; résumé book sharing described in Member Resources; CampusPress and GitHub Pages delivery; and browser storage used by Gearly and the signup experience. It links Ohio State's privacy and cookie statements and Brevo's privacy policy.

No fixed deletion deadline, exact retention period, blanket confidentiality promise, or assertion that the website has no cookies/analytics is made. Hosting, provider account settings, newsletter tracking settings, and internal record retention cannot be established from this repository alone. Officers should confirm these operational details with their providers and university contacts as needed, and update the notice when practices change.

Keep the page out of generated search/page registries until its CMS URL is published. After publication, it can be added to those registries and the generated search content rebuilt.

## Published November 13, 2026

CampusPress page ID **1248** is live at `https://org.osu.edu/asme/privacy-policy/`. No sidebars, native content title hidden, and wpautop disabled. Saved source was read back and matched. The Join page (69) received only the new privacy notice; the active Advanced Settings footer received only the new Quick Links entry, preserving other saved CMS code. Both settings saves and public links were verified. Desktop and 390px mobile checks passed with no horizontal overflow and working section targets. The hero title uses an explicit white override for the installed shared heading styles.
