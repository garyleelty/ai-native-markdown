# Tab Restore Reliability Design

## Goal

Restore editor tabs after reload without blanking the active document:

- Saved tabs reload their latest content from the local workspace.
- Unsaved tabs keep their persisted draft content.
- Missing files do not crash the app.
- The editor view and store stay in sync after hydration.

## Current Problem

The editor store loads tab metadata from `localStorage`, but `App.vue` calls `editorStore.setContent('')` on mount. If a tab was restored, that call can mark the active tab as modified and replace its content with an empty string in memory.

## Design

Add a store-level session hydration action:

- Validate the restored active tab id.
- If the active tab is modified and has draft content, use that draft.
- Otherwise read the active tab from `fileSystem`.
- If reading fails, keep an empty safe state for that tab instead of throwing.
- Update `content`, `currentFile`, and tab metadata silently.

Update app startup:

- Initialize the file system first.
- Hydrate restored tabs after initialization.
- Push hydrated content into the CodeMirror editor if it is mounted.
- Do not call the normal editing setter during startup.

## Test Cases

Add Playwright coverage:

- Open and save a workspace document.
- Reload the page.
- Verify the active tab and editor content are restored from the local workspace.

## Non-goals

- Do not add cross-device sync.
- Do not redesign tab persistence UI.
- Do not preserve cursor/scroll positions in this slice.
