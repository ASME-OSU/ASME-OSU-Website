# Gearly character motion

Reviewed all 22 distinct illustrations in sprites.json. PNG and WebP copies are the same poses, not extra animation frames. Open assets/gearly/sprite-gallery.html to compare the complete collection.

- Welcome: banner peek above the welcome card border, with a thumbs-up reaction.
- Launcher: centered happy head, wink on hover or keyboard focus, a brief tilt and bounce with a fading halo.
- Pending answer: thinking-chin pose beside the activity status.
- Reply: laptop pose beside the typing label; removed as soon as the answer completes or is cancelled.
- Join card: double thumbs up changes to a celebrating jump on hover or focus.
- Career card: briefcase changes to the laptop pose.
- Tour card: thumbs-up peek rests above the shortcut border, changing to the banner peek.
- Destination cards: side peek extends across the left card border, changing to the winking side peek.
- Section guide: one small entrance and a pointing reaction inside the fixed sprite box.

Motion changes only the character transform, not the card layout or spotlight position. No perpetual idle animation or new artificial response delay. Active work loops end with the pending request or reply. Reduced motion disables transforms and animation but keeps readable states and static pose changes. Images are decorative inside controls with existing accessible names. Preload interaction poses to avoid a first-hover fetch flash.

Corner launcher now uses a transparent 480 × 384 upper-body crop of the original smiling-wave PNG (source bounds: left 105, top 0, width 950, height 760). It retains the existing face and waving hand. The gallery includes this derivative alongside the 22 originals. A hover/focus speech bubble says “Hi! Need help?”; it disappears while chat is open.
