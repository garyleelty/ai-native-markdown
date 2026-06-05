# Graph Current Note Focus Design

## Problem

The knowledge graph currently renders the whole workspace. It supports search and opening nodes, but it does not help users answer the common writing question: “what is connected to the note I am editing right now?” Obsidian users expect both a global graph and a local graph.

## Goal

Add a current-note focus mode to the graph panel. The mode should show the current note and its one-hop neighborhood while preserving the existing global graph and search behavior.

## User Experience

- The graph toolbar has a compact segmented control with `全局` and `当前`.
- `全局` keeps the existing full workspace graph.
- `当前` shows the current note, direct outgoing links, and direct backlinks.
- A small focus summary states how many neighboring notes are visible.
- Search results respect the selected mode, so local search only searches visible local nodes.
- If no Markdown file is active, current mode shows a clear empty state instead of an empty canvas.

## Architecture

`KnowledgePanel.vue` passes `currentFile` into `KnowledgeGraph.vue`. `KnowledgeGraph.vue` computes a derived `visibleGraphData` without changing the knowledge index. The D3 renderer continues to receive a normal `KnowledgeGraphData` object, so `useKnowledgeGraph` does not need a structural rewrite.

The one-hop local graph is calculated by:

1. starting with `currentFile`,
2. finding every edge where source or target is the current file,
3. adding the opposite endpoint from those edges,
4. filtering nodes and edges to that visible set,
5. recomputing local stats.

## Error Handling

- If the current file is not in the graph data, show an empty state and do not initialize D3 with a misleading graph.
- If mode switches while data changes, destroy and rebuild the graph with the latest derived data.
- Existing node clicks still emit the selected file path.

## Testing

Add Playwright coverage that creates a small graph, opens a source note, switches graph mode to `当前`, verifies the local stats and summary, and confirms local search excludes an unrelated note.

