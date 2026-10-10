# Conversation-first acceptance

Implemented the supplied conversation-first style guide while retaining routing, public data sources, sprite files, and chat state handling.

- Desktop panel: 390 × 560px, limited to viewport height and a 620px cap, bottom/right 20px.
- Phone: viewport width minus 24px, right/bottom 12px; verified at 360 × 640px.
- Only the feed scrolls; suggestions live inside it. Header, context, composer, and notice are fixed flex sections.
- Short welcome bubble and four compact question buttons replace the decorative hero.
- Launcher hidden property toggles from the same open/close functions as panel visibility. Close restores focus.
- Topic hover/focus uses scoped foreground/background tokens, including nested labels and SVGs. Browser verified hover in light mode: RGB 36,34,40 on 255,243,245. Dark mode: 245,242,243 on 48,39,46. Keyboard focus retains the same text.
- Circular mascot and brief hover wave retained. Reduced motion disables character motion.
- Regression coverage includes reset, Enter/send, history, topics, navigation, action cards, and launcher focus/visibility.
