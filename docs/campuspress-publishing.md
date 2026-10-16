# Saving CampusPress page updates

Codex and other browser agents must click the page editor's **Update** control in the **Publish** panel, not the signed-in profile/header area. On the classic editor this control has the DOM ID `publish`. A click alone does not establish that the page was saved.

## Required page-save workflow

1. Confirm the editor URL, page title and post ID match the intended page. Back up its current saved content before editing, and preserve unrelated content and formatting settings.
2. For custom HTML, select **Code** and edit the `#content` field. Check that the intended change is present before saving.
3. Obtain a **fresh accessibility/UI state after editing**. Locate **Update** in the Publish panel and verify that it is the actual `#publish` control. Use its freshly observed accessibility target to click it. Do not reuse an element index or coordinates from an earlier observation. If coordinates are necessary, scroll the actual control into view and inspect a fresh screenshot; keep the click clear of the admin toolbar and profile header.
4. Confirm the **Page updated. View page** notice and that the browser remains on the expected page editor URL/post ID. Read the saved source back and check the intended change.
5. Open or reload the canonical public page and verify the published change. An enabled Update button, a completed click, or a repository merge is not proof of publication.

## If the click opens Profile or another page

If the browser displays **Profile / Personal Options**, navigates to `profile.php` or the homepage, loses the editor, or shows no save confirmation, treat the save as **unverified**. Do not keep clicking the old target.

Reopen the exact intended editor. Compare its saved source with the backup and intended change, preserving any intervening edits. Reapply only the missing change, get a fresh accessibility state, click the real Publish-panel **Update** control, and repeat both saved-source and public-page verification.

## Observed failure and working recovery

During the October 16, 2026 Gearly deployment, a role/name locator reported one exact **Update** button, but its click landed on **Profile / Personal Options**. The Member Resources page still contained the old sentence. The cause of the targeting mismatch was not established.

Recovery succeeded by reopening Member Resources (post `1034`), checking the saved source, reapplying the sentence change in Code mode, obtaining a fresh accessibility state, and clicking the newly observed **Update, ID: publish** target. The editor then showed **Page updated**, the saved HTML matched the intended edit, and the public page showed the new wording. The accessibility index from that session must never be hardcoded into later runs.

## Shared settings use a different save control

**Settings → Advanced Settings → Additional code → Footer** uses **Save Changes**, not the page editor's Update control. Back up the current field, preserve unrelated code, replace only the intended marked block, and confirm **Settings saved** plus exact saved-field readback and a public-page check.
