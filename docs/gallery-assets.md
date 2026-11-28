# Gallery assets in page HTML

Page HTML must never link directly to files under `assets/gallery/google-photos-auto/`. The [Google Photos sync](../scripts/sync-google-photos.mjs) publishes versioned filenames and removes files that the current feed no longer references. The Gallery integration reads those URLs from the feed.

For a photo embedded in a page, copy the image to a stable path outside the sync directory. The About page uses `assets/optimized/about/chapter-photo.webp`. Keep descriptive alt text and the image dimensions when updating the page.
