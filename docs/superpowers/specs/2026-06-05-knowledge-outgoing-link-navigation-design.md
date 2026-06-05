# Knowledge Outgoing Link Navigation Design

## Goal

Make the Knowledge panel's Outgoing Links chips behave like real navigation controls. Clicking an outgoing wiki link should open the resolved target note, or create the missing note through the existing wiki-link creation flow.

## Current Gap

The Knowledge panel renders outgoing links as button-like chips, but they do not have a click handler. This creates a misleading UI: users can see the link graph from the current note, but cannot move through it from the properties panel.

## Scope

This change covers:

- Existing outgoing links shown in the Knowledge panel properties tab.
- Missing outgoing links shown in the same list.
- Reusing the existing App-level `handleWikiNavigate` behavior for resolution, creation, sidebar refresh, and error messages.

This change does not alter graph layout, backlink indexing, or the markdown metadata shape. Outgoing links continue to display the link target currently parsed by `parseMarkdownMetadata`.

## Design

`KnowledgePanel` will emit a new `wiki-navigate` event when a `.link-chip` is clicked. `Sidebar` will forward that event to `App.vue`. `App.vue` already owns `handleWikiNavigate`, which can resolve existing notes and create missing notes, so the new event will call that existing method.

Keeping the navigation in `App.vue` preserves one authoritative behavior for preview links and knowledge panel links.

## UX

The chip remains visually compact, but gains keyboard and pointer behavior because it is already a native button. Hover styling remains unchanged.

## Tests

Playwright should cover:

- Clicking an outgoing link chip opens an existing target note.
- Clicking a missing outgoing link chip creates and opens a new Markdown note.
