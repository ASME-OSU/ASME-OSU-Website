# Browser fixture accessibility audit

Axe-core 4.10.3 scanned six page fixtures in Chromium 151.0.7922.34 on November 27, 2026. Each fixture ran at 390px and 1440px in light and dark mode. The scan used the repository's built stylesheet and the browser tests' mocked CampusPress wrapper and services. The source was `main` at `150ac75`.

Across 24 scans, axe reported 5 distinct failing rules, 34 rule failures across views and 51 failing element instances. It also flagged 680 element instances for manual verification, including repeated elements across views.

## Results by fixture

Each cell shows confirmed failing elements followed by elements that axe could not determine automatically.

| Fixture | 390px light | 390px dark | 1440px light | 1440px dark |
| --- | ---: | ---: | ---: | ---: |
| Home | 3 / 22 | 1 / 22 | 2 / 38 | 0 / 38 |
| About | 1 / 10 | 9 / 16 | 0 / 23 | 8 / 29 |
| Calendar | 1 / 7 | 1 / 7 | 0 / 20 | 0 / 20 |
| Current Sponsors | 3 / 4 | 2 / 12 | 2 / 17 | 1 / 25 |
| Sponsor ASME | 2 / 65 | 1 / 65 | 2 / 78 | 0 / 78 |
| Join | 4 / 11 | 3 / 11 | 3 / 31 | 2 / 31 |
| Total | 14 / 119 | 17 / 133 | 9 / 207 | 11 / 221 |

## Confirmed findings

| Axe rule and impact | Fixture and element | Where it failed | How to fix |
| --- | --- | --- | --- |
| `button-name`, critical | All six, fallback header `.inside-navigation > .menu-toggle` | 390px, both schemes, 12 instances | The recorded CampusPress header contains the text “Menu.” Hide it visually while keeping it readable by assistive technology, and verify the visible fallback. |
| `color-contrast`, serious | Home, `.ah-about-text > .ah-eyebrow-dark` and `.ah-calendar-heading > .ah-eyebrow-dark` | Both widths in light mode, 4 instances. 2.24:1 and 2.53:1. | Use a darker foreground on these two light backgrounds to reach 4.5:1. |
| `color-contrast`, serious | About, four `.about-pillar-icon` labels and four `.about-stat-num` figures | Both widths in dark mode, 16 instances. 2.45:1. | Use the light accent text color. The small labels need 4.5:1 and large figures need 3:1. |
| `color-contrast`, serious | Current Sponsors, `.sponsors-cta .sponsors-eyebrow` | Both widths in light mode, 2 instances. 2.53:1. | Use a darker foreground to reach 4.5:1 on white. |
| `color-contrast`, serious | Sponsor ASME, `.sponsor-contact-header > .sponsor-eyebrow` and `label[for="sif-message"] > .sponsor-form-optional` | Light mode. Eyebrow at both widths (2.41:1) and optional-message label at 1440px (2.53:1), 3 instances. | Use a darker foreground in the inline inquiry form to reach 4.5:1. |
| `color-contrast`, serious | Join, `.join-faq-heading > p` | Both widths in light mode, 2 instances. 4.27:1. | Use a darker foreground to reach 4.5:1 against the FAQ background. |
| `landmark-unique`, moderate | Current Sponsors, the Brutus tier ribbons in the Pratt & Whitney and PPG cards | All four views. Axe lists the first duplicate. | Use ordinary card markup for the ribbons and keep their visible tier text. |
| `landmark-complementary-is-top-level`, moderate | Join, `#joinGroupMeStep` | All four views. | Mark up the GroupMe step as a section of the joining process and name it from the existing heading. |
| `link-in-text-block`, serious | Join, `.join-form-purpose > a` | All four views. 2.58:1 in light and 1.35:1 in dark against surrounding text, without a persistent underline. | Underline the link in both schemes so readers can identify it without relying on color. |

## Manual verification

- **`color-contrast`, serious.** Axe returned 658 unresolved element instances across the six fixtures. These include the fallback header title and description, the Home and About hero copy, Calendar headings, sponsor ribbons and form copy, and Join steps. Measure text against the actual background and image or gradient in the published page. Check links and focus indicators in their interactive states.
- **`aria-prohibited-attr`, serious.** Axe flagged 14 instances of labels on generic elements. The targets are Home `#ahSpotlight` and `.ah-status-row`, About `.about-hero-badges`, and Join `.join-flow-progress`. Inspect how each group is exposed to screen readers. If a group needs a name, give it an appropriate grouping role. Otherwise remove the redundant label.
- **`frame-tested`, critical.** The Home calendar iframe and Calendar `#asmeCalendarFrame` accounted for 8 manual checks. The fixtures block the third-party documents. Verify focus, keyboard interaction and announcements in the actual embeds.

## Regression coverage and limits

The browser suite now checks the 46 rules with at least one pass and zero confirmed violations in this audit. Each fixture and configuration runs that same rule set. A rule can still require manual checks on elements that axe could not evaluate.

The automated scan covers the six fixture documents in their initial state. The CampusPress theme and injected header and footer, third-party embeds, full visual contrast over live images, and keyboard or screen-reader behavior across interaction states need separate verification on the published site.
