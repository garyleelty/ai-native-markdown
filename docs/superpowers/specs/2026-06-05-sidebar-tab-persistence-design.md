# Sidebar Tab Persistence Design

## Context

`settingsStore` already exposes `activeSidebarTab`, but `Sidebar.vue` keeps a separate local `activeTab`. That means the app loses the user's current sidebar panel after refresh, even though the store has the right concept.

## Goal

Persist the active sidebar panel so a user who is working in Knowledge, AI settings, Settings, Outline, or Files can refresh and return to the same context.

## UX

When a sidebar tab is selected, the active menu state and visible panel update immediately. On page reload, the sidebar restores the last valid tab. Invalid stored values fall back to `files`.

## Architecture

`settingsStore` becomes the single source of truth for the active sidebar tab:

- Load `active_sidebar_tab` from localStorage on startup.
- Validate it against the `SidebarTab` union before use.
- Save it when `setActiveTab(tab)` is called.

`Sidebar.vue` reads `settingsStore.activeSidebarTab` through a computed value and writes changes with `settingsStore.setActiveTab`. Existing command palette actions keep using `Sidebar.openTab(tab)`, which now writes through the store.

## Testing

Add Playwright coverage that selects the Knowledge panel, reloads the page, and verifies that both the panel content and active menu item are restored.
