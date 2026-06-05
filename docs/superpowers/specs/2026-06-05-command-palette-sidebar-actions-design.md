# Command Palette Sidebar Actions Design

## Context

The app already has working sidebar panels for files, knowledge, AI settings, app settings, and outline. Users can reach them with mouse clicks, but the command palette does not expose these panels. The knowledge panel also has a manual refresh button, but there is no keyboard command for rebuilding the knowledge index.

## Goal

Add command palette actions that make existing sidebar and knowledge workflows reachable from the keyboard:

- Open the file panel.
- Open the knowledge panel.
- Open the AI settings panel.
- Open the outline panel.
- Open the settings panel.
- Refresh the knowledge index.

## UX

The commands live in the existing `视图` and `知识` categories. Panel commands should show the sidebar if it is hidden, then switch to the requested tab. Refreshing the knowledge index should show the knowledge panel first so the user can see the refreshed stats and graph state.

Labels:

- `打开文件面板`
- `打开知识面板`
- `打开 AI 设置`
- `打开文档大纲`
- `打开设置`
- `刷新知识索引`

## Architecture

`Sidebar.vue` remains the owner of sidebar panel rendering, but it exposes a small imperative API for the app shell:

- `openTab(tab: SidebarTab)`
- `refreshKnowledgeIndex()`

`KnowledgePanel.vue` already owns `refreshIndex()`. It should expose that method so the sidebar can call it without duplicating indexing logic.

`App.vue` maps new command IDs to these sidebar APIs. If a command needs the sidebar, `App.vue` sets `settingsStore.showSidebar = true` before calling the exposed sidebar method.

## Error Handling

If the sidebar or knowledge panel is not mounted yet, command handlers should safely no-op instead of throwing. Knowledge refresh continues to use the existing success and failure messages from `KnowledgePanel.vue`.

## Tests

Add Playwright coverage for:

- A command palette command can open each sidebar panel.
- `刷新知识索引` switches to the knowledge panel and refreshes visible graph stats after a workspace file is added.
