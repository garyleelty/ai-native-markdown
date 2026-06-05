# Reference Line Navigation Design

## Goal

Make Knowledge panel backlinks and unlinked mentions actionable: selecting a reference should open the source note and move the editor/preview to the line that contains the matching wiki link or text mention.

## Current Gap

The Knowledge panel already shows backlinks and unlinked mentions, but each reference only contains `filePath`, `title`, and `excerpt`. Clicking a reference opens the file without context, so the user still has to search manually inside the source note.

## Scope

This change covers:

- Backlink references in the Knowledge panel.
- Unlinked mention references in the Knowledge panel.
- Line-number metadata for each reference.
- A compact line indicator in each reference row.
- Reusing the existing App-level `handleOutlineNavigate` flow so editor and preview scrolling stay consistent.

This change does not redesign the graph canvas, add bidirectional editing, or create a backlinks database separate from the existing Dexie knowledge index.

## Design

`KnowledgeReference` will gain an optional `lineNumber` field. The knowledge index will compute this field from the indexed note content at query time:

- For backlinks, find the first wiki link whose normalized target matches the current note title or one of its aliases.
- For unlinked mentions, find the first source line that contains a valid textual mention and is not already counted as a wiki link.

`ReferenceList` will emit the full reference item instead of only a path. `KnowledgePanel` and `Sidebar` will forward that reference to `App.vue`. `App.vue` will open the source file through the existing file selection path, then call the shared line navigation method when `lineNumber` is available.

## UX

Each reference row remains a simple button. A small `L<number>` badge appears beside the title when the line is known. The existing excerpt remains the main preview text.

## Error Handling

If a reference has no line number, clicking it still opens the file. If file opening fails, the existing file-open error path remains responsible for the user-facing error.

## Tests

Playwright should cover:

- Clicking a backlink opens the source note and moves the status bar/editor to the wiki-link line.
- Clicking an unlinked mention opens the source note and moves the status bar/editor to the mention line.
