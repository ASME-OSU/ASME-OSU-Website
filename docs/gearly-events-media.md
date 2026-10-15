# Event wording and concise media answers

Gearly treats a general request for an ASME “meeting” as a request for upcoming chapter events. It does not filter for event titles containing “meeting.” Specific company, social, workshop, competition, and date filters still apply.

Instagram answers display the single newest post in the public feed, even if topic words in the question match an older post. Photo-gallery answers retain their existing topical matching and three-photo limit.

Photo and Instagram answer metadata uses a short Eastern date, for example `Updated Oct 15, 2026.` Refresh times, technical source labels, and snapshot schedules are omitted. A short stale-data message remains when necessary.

## Deployment

`Gearly Embed.html` and the Gearly block in `Footer.html` use asset version `20261015-events-media`. After the reviewed code is released to GitHub Pages, replace the existing Gearly block in the CampusPress shared footer with the updated embed, preserving other footer customizations. The local preview and pull request do not update CampusPress.

## Validation

- Engine regression: general meeting questions retain the events source without a meeting-type filter; company and social filters are preserved.
- Feed regressions: a newer unrelated Instagram post wins over an older query match, only one post is returned, gallery queries still match and return up to three photos, and a legacy meeting filter returns chronological events.
- UI regression: photo and Instagram metadata uses an Eastern calendar date with no time or technical source label.
- Browser preview: meeting question returns MATLAB first; Instagram shows one card; gallery and Instagram dates are short.
