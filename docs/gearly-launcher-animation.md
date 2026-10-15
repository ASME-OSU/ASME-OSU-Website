# Occasional launcher animation and conversational portraits

The supplied `Gearley_Original_Look_24fps.webp` stays unchanged in the user's Downloads folder. It contains 150 frames at approximately 24 fps on an opaque black 1280×720 canvas (9,226,218 bytes). RGBA alone did not indicate transparency.

The launcher rendition is 128×128 with genuine transparency, a fixed crop across all frames, and a single playthrough. Its matching still uses frame 1. Edge-connected dark background is removed without keying out the enclosed black visor; disconnected encoder flecks are discarded. The 699,774-byte animation is fetched once, only after a visible closed launcher has sat for 8–12 seconds for its first greeting, then 60–90 seconds between later waves. Each later play uses a fresh local blob URL to restart without downloading again. It returns to the still after 6.25 seconds. Opening chat, hiding the document, or enabling reduced motion cancels playback and restores the still. Hover or keyboard focus can request a wave with a 60-second cooldown. Transient playback failures retain the still and retry after 90 seconds. The fixed canvas centers the visor at working-canvas x=188, rather than centering the bounds extended by the raised hand. Updated centered asset filenames prevent old cached images from persisting.

Rebuild from the repository root with Python, Pillow and NumPy:

```sh
python3 scripts/gearly/prepare-launcher-wave.py /path/to/Gearley_Original_Look_24fps.webp
```

The converter preserves source proportions and adds padding, but does not synthesize missing source detail or smooth the source's pose/lighting differences. A few glove/hoodie edges have small source discontinuities; this is an occasional short wave rather than a seamless continuous idle animation. The original remains available for future refinement.

Every assistant message, including restored history and reduced-motion replies, has one small decorative head portrait beside its bubble. The portrait gently moves while typing and remains still after completion. User messages do not receive Gearly portraits.

Validation: 219 unit/integration tests; 129 Gearly tests plus the frozen utterance/holdout runner; browser conversation and dark-mode checks; real browser playback confirmed using a decoded blob image, followed by return to the still. The development-only 12-PNG animation lab remains separate and is not deployed by this change.
