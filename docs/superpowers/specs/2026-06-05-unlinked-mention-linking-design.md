# Unlinked Mention Linking Design

## Goal

Let users convert a Knowledge panel unlinked mention into a real wiki link with one click. This turns discovered implicit relationships into durable note links without leaving the knowledge workflow.

## Current Gap

The Knowledge panel can show unlinked mentions and can now open the source line, but it still requires manual editing to turn the mention into `[[Target Note]]`. That makes relationship cleanup slower than it needs to be.

## Scope

This change covers:

- A small action button on unlinked mention reference rows.
- Converting the first matching unlinked mention on the referenced line into a wiki link.
- Writing the updated source file back to the local workspace.
- Updating any open tab/editor content for that source file.
- Refreshing the knowledge index through the existing `fileSystem.writeFile` sync path.

This change does not batch-link all mentions, edit backlinks, or infer aliases beyond the current note title and aliases already indexed by the Knowledge panel.

## Design

`ReferenceList` will optionally render a compact action button. Backlinks will keep the current row-only behavior. The unlinked mentions tab will pass `action-label="链接"` and emit a `link-mention` event when the action is clicked.

`KnowledgePanel` will include the current note title and aliases in the event payload. `App.vue` will read the source content, call a small wiki-link utility to replace the first valid occurrence, then write the file through `fileSystem.writeFile`.

The replacement algorithm will:

- Prefer the reference `lineNumber` when present.
- Match current note title and aliases.
- Avoid replacing text already inside `[[...]]`.
- Use `[[Current Note Title]]` as the inserted link text.
- Return `null` if no safe match is found.

## UX

The row still opens the source line when clicked. The new small action button only performs the conversion and uses `@click.stop` so it does not also navigate away. Success and failure use Element Plus messages.

## Tests

Playwright should cover:

- The action button converts an unlinked mention into a wiki link and removes it from unlinked mentions after refresh.
- The updated file content is persisted in the workspace.
