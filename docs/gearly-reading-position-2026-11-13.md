# Gearly reading position — November 13, 2026

New answers open at the start of the reply, with fourteen pixels of space above the bubble. Short replies are clamped to the available scroll range so their complete content stays visible. Gearly no longer scrolls to the bottom on every typed character or when finishing a reply.

Visitors who scroll up keep their position through loading, typing, completed answers, and closing/reopening the panel. A “Latest reply ↓” button appears when the newest reply begins below the visible conversation. It returns to that reply’s beginning and focuses the answer without a second browser scroll. Scrolling back to the bottom resumes following new replies. The input remains outside the scrolling feed.

The typing reveal reserves the final reply height, and its status label remains available to screen readers without taking space in the text flow. The feed disables browser scroll anchoring so newly added content cannot independently move the reader. Before changing reply layout, Gearly reconciles actual scroll movement even if the browser has not delivered its queued scroll event yet. Repeated programmatic scroll events do not incorrectly switch into manual reading mode. Reduced-motion preferences skip the typing reveal and do not introduce smooth scrolling.

Eleven geometry-backed UI tests cover long replies, asynchronous loading, manual scrolling during typing, delayed native scroll events, repeated programmatic events, Latest reply focus, clearing, reopening, and restored history. Real browser checks cover desktop and 390px mobile views. No forms are submitted by these checks.

Release asset version: `20261113-reading`. Publish after GitHub Pages deployment by updating only the marked Gearly block in the WordPress shared Footer.
