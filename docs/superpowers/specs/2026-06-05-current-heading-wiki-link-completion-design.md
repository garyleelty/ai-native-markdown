# Current Heading Wiki Link Completion Design

## Goal

Make current-document heading links fast to create while writing. When the user types `[[#...` inside the editor, the completion popup should suggest headings from the current Markdown document and insert a valid current-document Wiki Link fragment.

## Scope

This slice supports current-document heading completion only:

- Detect incomplete Wiki Links whose query starts with `#`.
- Parse Markdown headings from the active editor content.
- Filter headings by visible heading text or generated slug.
- Insert the selected suggestion as `[[#Heading Text]]`.
- Preserve the existing completion keyboard behavior: `Enter`, `Tab`, arrows, `Escape`, and mouse click.

This slice does not add cross-document heading completion, alias insertion, block references, or fuzzy ranking. Those can be layered later after the file-content cache is designed explicitly.

## UX

Heading suggestions reuse the existing Wiki Link completion popup. Rows show:

- heading text as the primary label;
- a muted metadata line like `当前文档 · H2`;
- the same selected-row visual treatment as note suggestions.

If no heading matches, the empty state remains concise and tells the user there are no matching headings. The popup must stay compact and must not resize the editor.

## Architecture

`Editor.vue` already owns CodeMirror cursor state and the Wiki Link completion UI. This feature extends its existing suggestion model with a suggestion `kind`.

When `completionContext.query` starts with `#`, `Editor.vue` parses the current document text from `editorView.state.doc`, extracts ATX headings (`#` through `######`), and returns heading suggestions instead of note suggestions. Existing note completion behavior is unchanged for queries without `#`.

No data model or service changes are required.

## Edge Cases

- Complete links like `[[#Heading]]` should close the popup after `]]`.
- Empty `[[#` shows the first few current headings.
- Duplicate heading names are allowed; the first selected duplicate inserts the same fragment text.
- Heading markers inside fenced code blocks are not parsed in this slice.

## Testing

Add Playwright coverage for:

- Typing `[[#deep` in a document with `## Deep Heading` shows the heading suggestion.
- Pressing `Enter` inserts `[[#Deep Heading]]` and saves it to the workspace.
- Existing note completion tests continue to pass.
