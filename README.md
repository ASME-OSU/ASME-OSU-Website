# Ohio State ASME Website (`ASME-OSU-Website`)

This repository serves as the official version control and backup for the custom themes, styles, page layouts, and scripts utilized on the **[Ohio State ASME Chapter Website](https://org.osu.edu/asme/)**. 

Because the live site is a hosted WordPress environment running on the GeneratePress theme, this repository acts as the **single source of truth** for all custom overrides before they are updated on the WordPress dashboard.

---

## 📂 Repository Structure

The files in this repository represent copy-paste blocks for various sections of the WordPress site:

| File Name | Target Location in WordPress Admin | Purpose |
| :--- | :--- | :--- |
| **[`ASME Custom CSS.rtf`](file:///Users/matthewallen/.gemini/antigravity/scratch/ASME-OSU-Website/ASME%20Custom%20CSS.rtf)** | **Appearance > Customize > Additional CSS** | Custom responsive variables, dark-mode cards, button spacing patches, grayscale partner sponsor grids, and styling overrides. |
| **[`Footer.rtf`](file:///Users/matthewallen/.gemini/antigravity/scratch/ASME-OSU-Website/Footer.rtf)** | **GeneratePress Elements / Footer Code Snippets** | Custom bottom-bar footer structure and all client-side JavaScript controllers (Animations, Slideshow, Google Calendar, Gallery Lightbox). |
| **[`Home Page.rtf`](file:///Users/matthewallen/.gemini/antigravity/scratch/ASME-OSU-Website/Home%20Page.rtf)** | **Pages > Home (Custom HTML Block)** | Layout structure for the Home Hero slideshow, statistics panels, Quick Links grid, and Calendar embed widget. |
| **[`Join Page.rtf`](file:///Users/matthewallen/.gemini/antigravity/scratch/ASME-OSU-Website/Join%20Page.rtf)** | **Pages > Join (Custom HTML Block)** | Newsletter signup form connected to Brevo (Sendinblue) and the dynamic FAQ accordion component. |
| **[`Leadership Page.rtf`](file:///Users/matthewallen/.gemini/antigravity/scratch/ASME-OSU-Website/Leadership%20Page.rtf)** | **Pages > Leadership (Custom HTML Block)** | Structure for officer grids, year tabs, and biography modal styling. |
| **[`Gallery Page.rtf`](file:///Users/matthewallen/.gemini/antigravity/scratch/ASME-OSU-Website/Gallery%20Page.rtf)** | **Pages > Gallery (Custom HTML Block)** | HTML structure for visual media collections. |
| **[`About Us Page.rtf`](file:///Users/matthewallen/.gemini/antigravity/scratch/ASME-OSU-Website/About%20Us%20Page.rtf)** | **Pages > About Us (Custom HTML Block)** | Organizational pillars, history, and mission statements. |
| **[`Current Sponsors Page.rtf`](file:///Users/matthewallen/.gemini/antigravity/scratch/ASME-OSU-Website/Current%20Sponsors%20Page.rtf)** | **Pages > Sponsors (Custom HTML Block)** | Tiers layout for corporate sponsors and partner boards. |

---

## 🎨 Theme & Styling System

The website's custom CSS uses CSS custom properties (`:root`) to maintain branding consistency matching the Ohio State University colors:

*   **OSU Charcoal/Slate:** `--asme-navy: #1f2937;` (Used for readable high-contrast typography/headers)
*   **OSU Scarlet:** `--asme-blue: #bb0000;` (Used for link hovers, active navigation markers, and call-to-actions)
*   **Neutral Backgrounds:** `--asme-bg: #f4f5f7;` & `--asme-card: #ffffff;`

### Custom Layout Fixes
*   **`wpautop` Button Breaks:** WordPress automatically adds formatting breaks (`<br />`) to raw HTML blocks. The CSS contains rules to suppress these spacing anomalies within `.join-submit-button`, `.ah-cards-grid`, `.sponsor-card`, and `.leader-card`.
*   **Responsive Widths:** The layout automatically supports ultra-wide displays up to `2200px` down to standard mobile views with dynamic grids and flex wrappers.

---

## ⚡ Client-Side Features (`Footer.rtf`)

The custom scripts are loaded dynamically on page load to add interactivity:

1.  **Image Classification:** Auto-detects portrait vs. landscape images inside the gallery to format the grid aspect ratio correctly.
2.  **Home Slide Transitioner:** Configures the automatic fade slider for hero images.
3.  **Dynamic Calendar Feed:** Fetches events from the public Google Calendar iCal feed and renders the details dynamically in the *Upcoming Events* module.
4.  **Glassmorphic Lightbox:** Provides a native click-to-enlarge modal wrapper for gallery images supporting Next/Prev navigation and keyboard shortcuts (`Escape`, `ArrowLeft`, `ArrowRight`).

---

## 🔄 Development Workflow

To make updates to the ASME OSU website:

1.  **Edit Files Locally:** Edit the `.rtf` code blocks in this repository. (It is easiest to convert them to plain text or edit them inside a text editor, then commit).
2.  **Commit and Push:**
    ```bash
    git add .
    git commit -m "Detail what was modified"
    git push origin main
    ```
3.  **Apply to WordPress:** Copy the modified code block directly into the corresponding settings panel in the WordPress dashboard as documented in the table above.