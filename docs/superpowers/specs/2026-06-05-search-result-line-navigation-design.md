# Search Result Line Navigation Design

## Goal

Clicking a full-text search result should open the matching file and move the editor to the first matched line. Search should answer "where is it?" rather than only "which file contains it?".

## Current State

`FileExplorer.vue` receives content search matches with `lineNumber`, but `handleSearchResultClick` ignores the line and only emits the file path. `App.vue` already has `handleOutlineNavigate(lineNumber)`, which updates cursor state and scrolls the editor and preview.

## User Experience

- File-name search results keep opening the file without changing cursor position.
- Content search results open the file and navigate to the first matched line.
- The search input clears after opening a result.
- Existing result card visuals stay unchanged.

## Architecture

Add a `search-result-select` event from `FileExplorer.vue` to `Sidebar.vue` to `App.vue`. The payload contains `path` and optional `lineNumber`. `App.vue` opens the file through the existing file selection flow, then calls `handleOutlineNavigate(lineNumber)` after the file is active.

## Testing

Extend the existing search Playwright test to click a content search result and assert that the opened editor status bar reports the matched line.
