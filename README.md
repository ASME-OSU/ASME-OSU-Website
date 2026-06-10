# Ohio State ASME Website

This repository is the source of truth for the custom HTML and CSS used on the Ohio State ASME WordPress site:

https://org.osu.edu/asme/

The live site runs on WordPress with GeneratePress. CSS is loaded from this GitHub repository. Page HTML files are still copy/paste blocks that must be pasted into the matching WordPress page editor.

## Live CSS

WordPress should load the main stylesheet from jsDelivr:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/ASME-OSU/ASME-OSU-Website@main/ASME%20Custom%20CSS.css?v=20260610">
```

The `v=` value is only a cache-buster. Increment it when the live site keeps showing stale CSS.

After pushing CSS changes, purge jsDelivr:

```bash
curl -sS --connect-timeout 10 "https://purge.jsdelivr.net/gh/ASME-OSU/ASME-OSU-Website@main/ASME%20Custom%20CSS.css"
```

Then hard refresh the site.

## Files

| File | WordPress location | Purpose |
| --- | --- | --- |
| `ASME Custom CSS.css` | Header stylesheet link from GitHub/jsDelivr | Site-wide styling, responsive fixes, dark mode, navigation, footer, and page-specific polish. |
| `Home Page.html` | Home page custom HTML block | Home hero, stats, quick links, and event preview content. |
| `About Us Page.html` | About page custom HTML block | About ASME OSU content, mission, and pillars. |
| `Join Page.html` | Join page custom HTML block | Join/signup content and FAQ. |
| `Sponsor ASME Page.html` | Sponsor ASME page custom HTML block | Corporate sponsorship information and calls to action. |
| `Member Resources Page.html` | Member Resources page custom HTML block | Member resource hub, SVG resource cards, jump links, career links, forms, and chapter resources. |
| `Member Points Page.html` | Member Points page custom HTML block | Member point tracking page shell while the tracking system is in development. |
| `Footer.html` | GeneratePress footer element/snippet | Custom footer markup and client-side scripts, if used on the WordPress site. |
| `Leadership Page.html` | Leadership page custom HTML block | Officer/leadership layout, if maintained in WordPress. |
| `Gallery Page.html` | Gallery page custom HTML block | Gallery layout, if maintained in WordPress. |
| `Current Sponsors Page.html` | Sponsors page custom HTML block | Sponsor listing layout, if maintained in WordPress. |

## Update Workflow

1. Edit the file in this repo.
2. Commit the change.
3. Push to `main`.
4. If CSS changed, purge jsDelivr.
5. If HTML changed, paste the updated HTML file into the matching WordPress page editor.
6. Hard refresh the browser.

Example:

```bash
git add "ASME Custom CSS.css" "Member Resources Page.html"
git commit -m "Update member resources page"
git push origin main
curl -sS --connect-timeout 10 "https://purge.jsdelivr.net/gh/ASME-OSU/ASME-OSU-Website@main/ASME%20Custom%20CSS.css"
```

## Mobile Gutters

Custom pages should use one consistent mobile page gutter: `16px` on each side.

The final CSS block labeled `MOBILE GUTTER STANDARD` enforces this with:

```css
width: calc(100vw - 32px);
max-width: calc(100vw - 32px);
```

Use the existing page wrapper classes, such as `asme-home`, `asme-about-page`, `asme-join-page`, `asme-member-resources-page`, and `asme-members-page`, instead of adding one-off width rules. If a page looks edge-to-edge on mobile, fix it in the shared gutter rule rather than adding a separate page-specific patch.

## Notes

- CSS updates go live from GitHub/jsDelivr after push and cache purge.
- HTML updates do not automatically deploy to WordPress.
- The Member Resources page uses inline SVG icons. If the live site shows letter badges instead of icons, the WordPress HTML is stale and needs the latest `Member Resources Page.html` pasted into the editor.
- The Member Resources page includes links for ASME student membership, ASME OSU chapter signup, the ASME OSU Career Packet, ECS advising, co-ops/internships, Handshake, LinkedIn, events, and board contact.
