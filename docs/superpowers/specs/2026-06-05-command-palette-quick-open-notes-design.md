# Command Palette Quick Open Notes Design

## Context

The command palette is now the main keyboard entry for app actions, but it only searches static commands. Obsidian users expect a quick switcher that can jump to a note by typing part of its name. This app already keeps a `markdownPaths` list for Wiki Link completion and preview link resolution, so the palette can reuse that list instead of adding a separate index.

## Goal

Let users open Markdown notes directly from the command palette:

- Press `Ctrl+P`.
- Type part of a note name or path.
- See matching notes under a `笔记` section.
- Press Enter or click a result to open that note.

## UX

The command palette should still show static commands first when they match. Note results should appear under their own `笔记` category, with the file name as the main label and the path as muted metadata. This keeps command execution and quick note navigation in one interface without adding another modal.

When the query is empty, the palette should not list every note. This prevents large workspaces from making the default palette noisy. Note results appear only after the user types at least one character.

## Architecture

`CommandPalette.vue` receives a `markdownPaths` prop. It derives note commands with IDs in the form `file.quick-open:<path>`. The existing `execute` event remains the only output.

`App.vue` passes `markdownPaths` into the palette and handles `file.quick-open:` IDs by calling the existing `handleFileSelect(path)`.

`markdownPaths` should be refreshed after demo workspace initialization and folder import, because those flows change the available notes without necessarily selecting a file.

## Error Handling

If a quick-open command references a path that cannot be read, `handleFileSelect` keeps the existing file-operation error behavior. The palette itself does not read files.

## Tests

Add Playwright coverage that creates a Markdown note, loads the workspace, searches for the note through `Ctrl+P`, selects it, and verifies the editor opens the note content.
