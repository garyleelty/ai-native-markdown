# Preview Wiki Link Navigation Design

## Goal

Make Wiki Links in rendered preview open existing Markdown documents, matching the basic Obsidian workflow users expect.

## Current Problem

`Preview.vue` emits a `navigate` event when a rendered `.wiki-link` is clicked, but `App.vue` does not listen to it. The link looks clickable but does nothing.

## Scope

- Listen for the preview `navigate` event in `App.vue`.
- Resolve existing Markdown files for common link forms:
  - `[[README]]`
  - `[[README.md]]`
  - `[[notes/topic]]`
  - `[[./sibling]]`
  - `[[../parent]]`
  - `[[Target#Heading|Alias]]` by opening the target file and jumping to the heading.
  - `[[#Heading|Alias]]` by jumping within the current document, including unsaved editor content.
- Use the existing file open flow so unsaved changes are saved before switching.
- Show a short user-facing message when no target exists.

## Non-goals

- Do not auto-create missing notes.
- Do not redesign backlink indexing or preview styling.

## Testing

Add Playwright coverage for clicking a preview Wiki Link with an alias and no extension. The test should verify the target file opens in the editor tab and its content appears.

Add Playwright coverage for clicking a preview Wiki Link with `#Heading`. The test should verify the target file opens and the matching heading becomes the active preview line.

Add Playwright coverage for clicking a current-document heading link. The test should verify the app jumps to the matching heading without requiring the file to be reloaded from disk.
