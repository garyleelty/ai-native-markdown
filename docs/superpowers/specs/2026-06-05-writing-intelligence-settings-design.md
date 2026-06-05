# Writing Intelligence Settings Design

## Context

The editor already has several writing intelligence flags in `settingsStore`: RAG, AI editor actions, smart paste, and inline edit. RAG is persisted but has no visible settings entry. The other three flags are loaded from localStorage but are not consistently saved, and smart paste cannot be reconfigured while the editor is mounted.

## Goal

Make writing intelligence controls visible, persistent, and live-updating:

- Knowledge-enhanced chat (`enableRAG`)
- AI inline actions (`enableAIActions`)
- Smart paste (`enableSmartPaste`)
- Inline edit (`enableInlineEdit`)

## UX

Add a compact `写作智能` section to the existing Settings panel. Each row has a short label, a plain-language description, and a switch. Toggling a switch takes effect immediately and survives reload.

## Architecture

`settingsStore` exposes explicit setters for the four flags and persists each value. `Editor.vue` keeps AI actions, smart paste, and inline edit behind CodeMirror compartments so mounted editors can reconfigure without reload.

## Testing

Add Playwright coverage that toggles all four settings, verifies localStorage values, reloads the page, and confirms the Settings panel restores the switch states.
