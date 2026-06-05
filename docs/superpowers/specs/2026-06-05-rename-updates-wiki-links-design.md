# Rename Updates Wiki Links Design

## Problem

Renaming files or folders currently migrates the file tree, knowledge index, version history, and RAG document ids, but existing Wiki Links in other notes can still point at the old title or old path. This breaks a core knowledge-base workflow users expect from Obsidian-class editors.

## Goal

When a Markdown file or folder is renamed, saved notes that link to the renamed target are updated automatically, and already-open tabs show the updated links without losing unsaved edits.

## Scope

- Update Wiki Link targets that resolve to the renamed file, or to a file inside a renamed folder.
- Preserve link aliases and heading fragments, for example `[[Old#Part|Alias]]` becomes `[[New#Part|Alias]]`.
- Preserve the user's broad addressing style:
  - bare links stay bare when the renamed target can still be represented by a filename;
  - workspace-relative links stay workspace-relative;
  - relative links stay relative;
  - links with Markdown extensions keep extensions.
- Update the persistent local workspace through `fileSystem.renameFile`.
- Reindex updated Markdown files through the knowledge index.
- In the app shell, update open tab content after a rename. Modified tabs remain modified.

## Non-Goals

- No confirmation dialog or diff preview in this slice.
- No rewriting of display aliases.
- No global rewrite for normal Markdown links like `[text](file.md)`.
- No attempt to rewrite ambiguous bare links that did not resolve to the renamed file before the rename.

## Architecture

- Add a pure utility in `src/utils/wikiLinks.ts` that rewrites Wiki Link targets based on `oldPath`, `newPath`, source file path, and the pre-rename Markdown path list.
- Call that utility from `fileSystem.renameFile` after the file tree paths are moved. The service updates saved Markdown contents and returns the paths that had links rewritten.
- In `App.vue`, reuse the same pure utility against open tab content after the file explorer reports a rename. This keeps unsaved tabs coherent with the workspace rename while preserving their modified state.

## Testing

- Add Playwright coverage for direct `fileSystem.renameFile` behavior.
- Add UI coverage for a source note that is open while another file is renamed from the tree.
- Run targeted file/editor tests, full Playwright tests, typecheck, production build, and `git diff --check`.
