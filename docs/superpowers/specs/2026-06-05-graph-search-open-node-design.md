# Graph Search Opens Nodes Design

## Problem

The knowledge graph has a search box, but search only focuses the canvas. Users do not get a visible result list, cannot reliably open a matched note from the search control, and keyboard interaction is weak. For a production knowledge-base product, graph search should be a navigation surface, not only a visual zoom helper.

## Goal

Make graph search immediately useful: typing a query shows compact matching notes, and clicking a result or pressing Enter opens the note.

## Scope

- Add an accessible search input label.
- Show up to six matching graph nodes below the toolbar while a query is active.
- Each result shows note title, path, and lightweight graph metadata.
- Clicking a result focuses the node and emits the same node-open event used by canvas clicks.
- Pressing Enter opens the first match.
- Pressing Escape clears the search.
- Show a compact empty state when no nodes match.

## Non-Goals

- No graph layout rewrite in this slice.
- No persistent saved graph filters.
- No full command-palette replacement.
- No visual redesign of the whole sidebar.

## UX Direction

The graph lives inside a dense productivity sidebar. Results should be compact, scannable, and keyboard-friendly. The UI should use existing color tokens, avoid decorative effects, and keep hit targets large enough for reliable clicking.

## Testing

Add Playwright coverage that creates two linked notes, opens the graph tab, searches for one note, clicks the search result, and verifies the corresponding note opens in the editor.
