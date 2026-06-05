# Layout Visibility Persistence Design

## Context

The app persists sidebar width, AI panel height, active editor tabs, and active sidebar tab. It does not persist whether the sidebar or AI panel is visible. This makes the UI feel less like a stable workspace: users can hide the sidebar or open the AI assistant, refresh, and lose that layout.

## Goal

Persist workspace layout visibility:

- Sidebar visible/hidden state.
- AI assistant panel visible/hidden state.

## UX

Header buttons and the Settings panel AI switch keep their current behavior, but the selected layout survives reload. Command palette actions that open sidebar panels also persist sidebar visibility because they intentionally reveal the sidebar.

## Architecture

`settingsStore` loads `show_sidebar` and `show_ai_panel` on startup. It exposes `setSidebarVisible` and `setAIPanelVisible`, and existing toggle methods delegate to those setters. `App.vue` uses the setter when command handlers reveal the sidebar.

## Testing

Add Playwright coverage for:

- Hiding the sidebar, reloading, and verifying it stays hidden.
- Opening the AI panel, reloading, and verifying it stays open.
- Toggling the AI assistant switch in Settings and verifying the switch and panel state persist.
