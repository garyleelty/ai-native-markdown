# Cross-Document Heading Wiki Link Completion Design

## Problem

The editor can complete existing note names and headings in the current document, but it cannot complete headings from another note. Users migrating from Obsidian expect `[[Note#Heading]]` to be fast and accurate without switching files to inspect headings manually.

## Goal

When the user types a Wiki Link with a file target and fragment, such as `[[Project Plan#mil`, the completion panel should suggest matching headings from the resolved target note and insert the full link when accepted.

## User Experience

- `[[#hea` keeps showing headings from the current document.
- `[[Target Note#hea` resolves `Target Note` using the same Markdown path rules as preview navigation.
- Matching headings show the heading title and a compact source label like `Target Note · H2`.
- Pressing Enter or Tab inserts `[[Target Note#Heading Title]]`.
- If the target note cannot be resolved, the panel shows the existing empty state instead of blocking typing.

## Architecture

`Editor.vue` keeps the existing completion UI and adds one optional prop: `readMarkdownFile(path)`. `App.vue` wires that prop to `fileSystem.readFile`, with a current-tab fast path so unsaved target-tab edits can be used later without changing the component contract.

The editor detects three completion modes:

- note mode: no `#`, suggest notes.
- current-heading mode: query starts with `#`, parse current editor content.
- cross-heading mode: query contains `#` after a non-empty file target, resolve the target path, read its content on demand, cache it by path, and parse headings.

## Data Flow

1. CodeMirror update detects an open Wiki Link query.
2. The query is parsed into file target and heading query.
3. If this is cross-heading mode, the editor resolves the file against `markdownPaths`.
4. The editor reads target content asynchronously and stores a versioned completion result.
5. The computed suggestion list renders the resolved headings.
6. Accepting a suggestion replaces the open Wiki Link text with the full inserted link.

## Error Handling

- Read failures produce an empty suggestion list and do not throw into the UI.
- Stale async reads are ignored when the user keeps typing or closes completion.
- Missing or ambiguous targets keep normal typing behavior intact.

## Testing

Add a Playwright test covering:

- creating a target note with a heading,
- typing a cross-document heading Wiki Link in a source note,
- seeing the target heading suggestion and source meta,
- accepting with Enter,
- saving and verifying persisted Markdown.

