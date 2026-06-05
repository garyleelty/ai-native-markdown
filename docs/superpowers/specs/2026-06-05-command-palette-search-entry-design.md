# Command Palette Search Entry Design

## Goal

Make search discoverable from the command palette. Users should be able to run a command for file-name search or global content search, land in the file sidebar, and immediately type the query.

## Current State

The file explorer already has a search box and supports two modes:

- `name`: file-name search in the file panel.
- `content`: global content search through `fileSystem.searchFiles`.

The command palette already opens files, switches sidebar panels, and refreshes the knowledge index. It does not expose search actions, so users must know where the search box lives.

## User Experience

Add two commands under a new `搜索` category:

- `搜索文件名`: opens the file sidebar, switches the file explorer search mode to file-name search, clears the previous query, and focuses the search input.
- `全局内容搜索`: opens the file sidebar, switches the file explorer search mode to content search, clears the previous query, and focuses the search input.

The command should not perform a search by itself unless a query is provided by code later. The first implementation only opens the right workspace context and puts focus in the input.

## Architecture

`CommandPalette.vue` remains declarative and emits command IDs. `App.vue` maps the new command IDs to a sidebar action. `Sidebar.vue` owns tab switching and waits for `FileExplorer.vue` to mount. `FileExplorer.vue` exposes a small `focusSearch(mode, query?)` method.

This keeps the command palette independent from the file explorer internals while avoiding a global event bus.

## Edge Cases

- If the sidebar is hidden, the command makes it visible before focusing search.
- If the active sidebar tab is not `files`, the command switches to `files` and waits for the explorer to mount.
- If hiding the sidebar destroys the file explorer component, the explorer restores the last workspace root path before focusing search.
- If no workspace is loaded, the command still switches to the file panel; the search input is absent until a workspace is opened.

## Testing

Add a Playwright test that creates a known file, loads the demo workspace, runs `全局内容搜索`, types a unique content token, presses Enter, and verifies the matching search result is visible and opens the file when clicked.
