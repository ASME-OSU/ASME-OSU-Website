# Gearly character motion

Reviewed all 22 distinct illustrations in sprites.json. PNG and WebP copies are the same poses, not extra animation frames. Open assets/gearly/sprite-gallery.html to compare the complete collection.

- Welcome: open-eyes wave, brief greeting motion, smiling-wave reaction.
- Launcher: centered happy head, wink on hover or keyboard focus, one brief nod.
- Pending answer: thinking-chin pose beside the activity status.
- Reply: laptop pose beside the typing label; removed as soon as the answer completes or is cancelled.
- Join card: double thumbs up changes to a celebrating jump on hover or focus.
- Career card: briefcase changes to the laptop pose.
- Tour card: standing wave changes to sitting wave.
- Destination cards: topic-specific illustration changes to double pointing.
- Section guide: one small entrance and a pointing reaction inside the fixed sprite box.

Motion changes only the character transform, not the card layout or spotlight position. No perpetual idle animation or new artificial response delay. Active work loops end with the pending request or reply. Reduced motion disables transforms and animation but keeps readable states and static pose changes. Images are decorative inside controls with existing accessible names. Preload interaction poses to avoid a first-hover fetch flash.
