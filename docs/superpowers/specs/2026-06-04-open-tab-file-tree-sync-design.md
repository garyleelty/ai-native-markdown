# Open Tab File Tree Sync Design

## Goal

Keep open editor tabs consistent with file tree operations:

- Renaming an opened file updates its tab name and active file path.
- Renaming a folder updates all opened descendant tabs.
- Deleting an opened file closes that tab.
- Deleting a folder closes all opened descendant tabs.

## Current Problem

`FileExplorer` updates the file system after rename/delete, but the editor store keeps stale tab paths. Users can continue editing a tab that points to a deleted path or save content back to the old path after a rename.

## Design

Emit file tree operation events upward:

- `FileExplorer`: emit `renamed` and `deleted` after successful operations.
- `Sidebar`: forward those events to `App.vue`.
- `App.vue`: call editor store sync actions, then push the active tab content into CodeMirror.

Add editor store actions:

- `renameOpenPath(oldPath, newPath, isDirectory)` updates matching open tabs and current file path.
- `removeOpenPath(path, isDirectory)` removes matching open tabs and selects the next available tab or clears the editor.

## Test Cases

Add Playwright coverage:

- Rename an opened file from the file tree; the tab and saved file path move to the new name.
- Delete an opened file from the file tree; the tab closes and the editor returns to the welcome state if no tabs remain.

## Non-goals

- Do not rewrite file-system persistence.
- Do not implement an undo flow for file tree operations.
- Do not change knowledge graph rename semantics in this slice.
