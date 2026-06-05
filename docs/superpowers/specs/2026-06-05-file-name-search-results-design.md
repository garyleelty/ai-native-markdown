# File Name Search Results Design

## Goal

Make file-name search behave like a real workspace search instead of leaving the full tree visible. Users should get a concise result list and be able to open matching files even when their folders were not expanded.

## Current State

The file explorer has a `name` search mode, but typing a query does not build actual search results. The UI continues to show the tree, which only works for already visible files and makes the new command palette `搜索文件名` entry feel incomplete.

## User Experience

- In file-name mode, typing into the search box searches all Markdown files in the current workspace.
- Results use the same compact result card style as content search.
- Each card shows the file name and relative path.
- Clicking a result opens the file and clears the search.
- Empty queries show the normal file tree and recent files.

## Architecture

`FileExplorer.vue` keeps content search and file-name search as separate result arrays. The visible result list is selected from `searchMode`. File-name search uses `fileSystem.getAllMarkdownFiles()` so it can find files that are not currently loaded into the tree.

## Testing

Add Playwright coverage for:

- The existing file-name search flow now showing a result card.
- The command palette `搜索文件名` entry focusing the search input and opening a nested matching file.
