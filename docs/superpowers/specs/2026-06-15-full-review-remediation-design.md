# Full Review Remediation Design

Date: 2026-06-15

## Summary

This design covers all issues listed in `REVIEW.md` and `CODE_REVIEW.md`. The work will be delivered in vertical phases so each phase leaves the app testable and usable. The implementation should preserve existing user data and current local work, including the KnowledgePanel simple/advanced mode intent, while allowing that code to be reshaped to fit the final design.

`opencode.json` is out of scope unless the user explicitly requests changes to local OpenCode configuration.

## Goals

- Fix the documented layout, UX, accessibility, performance, and code quality issues.
- Add the missing product capabilities documented in the review files.
- Keep each phase independently verifiable with tests, typecheck, and build.
- Reduce large-component risk by moving state and behavior into focused services, stores, composables, and child components.
- Preserve compatibility with existing local storage keys and user content.

## Non-goals

- Replacing the current Vue/Element Plus/Pinia architecture.
- Large visual redesign beyond the review items.
- Breaking changes to vault file storage or markdown file format.
- Changing OpenCode configuration.

## Chosen Approach

Use vertical slice delivery across five phases. Each phase fixes visible product issues and related technical debt together. This avoids long-running infrastructure-only work while still improving boundaries as the touched areas evolve.

Alternatives considered:

- Infrastructure-first: cleaner foundations, but high upfront risk and fewer user-visible checkpoints.
- Review-order execution: easy to track, but causes repeated cross-module context switching and more rework.

## Phase 1: Shell Stabilization

Scope:

- Make app header height use one source of truth.
- Move `sidebarTabs` to one shared constants/types module used by settings and Sidebar.
- Reduce sidebar icon rail width to an Obsidian-like compact width so narrow sidebars remain usable.
- Replace the tab context menu positioning so it appears at the pointer location.
- Validate recent files before opening; remove missing files from the recent list.
- Add responsive panel rules so AI, graph, and right dock panels do not squeeze the editor below a usable minimum width.

Acceptance criteria:

- Header height is consistent in template and CSS.
- There is only one canonical sidebar tab definition.
- Right-click tab menu appears near the mouse pointer.
- Invalid recent files are removed without crashing the app.
- Medium-width layouts preserve a practical editor width.
- `npm test -- --run`, `npm run typecheck`, and `npm run build` pass.

## Phase 2: Files and Knowledge Workflow

Scope:

- Add file favorites/bookmarks with add, remove, persistence, and a favorites section at the top of the file explorer.
- Add file tree multi-selection using Ctrl/Cmd and Shift selection.
- Add safe batch delete and batch move. Batch rename may be deferred if it creates excessive risk, but the UI should leave room for it.
- Integrate the existing KnowledgePanel simple/advanced mode with the reviewed goal of reducing tab overload.
- Keep KnowledgePanel to four or fewer primary tabs by moving properties and insights into inline sections or advanced mode.
- Add graph filters for search text, tag or directory scope, and connection depth.
- Prevent repeated graph rebuilds when switching files by debouncing or only loading when the graph tab is active.
- Add missing accessible labels to important knowledge/file controls.

Acceptance criteria:

- Favorites persist across reloads.
- Multi-select behavior works with mouse and keyboard modifier expectations.
- Batch destructive operations show confirmation and summarize partial failures.
- Graph filtering changes the displayed graph without rebuilding unrelated data unnecessarily.
- Simple mode prioritizes outline, backlinks, and graph; advanced mode exposes properties, mentions, and insights.
- Key controls have accessible names.

## Phase 3: Editor and Export Capabilities

Scope:

- Collapse low-frequency editor toolbar actions into a More menu while keeping common editing actions visible.
- Add export scope selection: current file, current directory, and entire workspace.
- Add user template management: save current document as template, edit template, delete template, and use built-in templates.
- Add clipboard image paste support: save image files into an `assets/` location and insert a markdown image link.
- Add a non-blocking Markdown lint and spelling/grammar-check entry point with basic rules.
- Start converging Preview, Export, and Live Preview onto a shared markdown renderer factory.

Acceptance criteria:

- The editor toolbar is usable on narrower widths without relying on horizontal overflow for common commands.
- Export dialog can target the selected scope.
- User templates persist and can be managed without editing source code.
- Pasted images create files and insert correct markdown links, or fail with a clear non-blocking message.
- Lint/spelling hints never block editing, saving, or exporting.

## Phase 4: AI and Settings System

Scope:

- Add AI chat session history with create, switch, delete, and restore after restart.
- Persist chat history in IndexedDB or an equivalent large-data store, not small local preference storage.
- Rework SettingsPanel into collapsible groups such as Appearance, Editor, AI, and Advanced.
- Add keyboard shortcut viewing, rebinding, and reset-to-defaults.
- Add writing goal configuration and connect it to the existing WritingGoal component.
- Replace empty catch blocks and production `console.*` calls with a unified logger/error handler.
- Add dark-theme styling coverage for the RSS edit dialog.

Acceptance criteria:

- Chat sessions survive app restart.
- Settings are discoverable by group and can be reset where appropriate.
- Shortcut changes are persisted and can be restored to defaults.
- Writing goal settings affect the visible goal UI.
- Expected recoverable errors are logged consistently and user-visible where useful.
- RSS dialog remains legible in dark theme.

## Phase 5: Architecture Cleanup and Verification

Scope:

- Slim `App.vue` by extracting tab bar management, welcome-page event handling, and panel layout policy into child components or composables.
- Remove Preview-specific wiki link renderer divergence by moving shared markdown behavior into the renderer factory.
- Avoid synchronous full line-map rebuilds on every preview content update for long documents.
- Add focused tests for new services, stores, composables, and critical UI flows.

Acceptance criteria:

- `App.vue` is meaningfully smaller and primarily coordinates the app shell.
- Preview, export, and live preview share markdown behavior for wiki links and related extensions.
- Long-document preview work is deferred or reduced where safe.
- Tests cover favorites, batch file operations, AI session restore, shortcut rebinding, image paste, and batch export.
- Final `npm test -- --run`, `npm run typecheck`, and `npm run build` pass.

## Module Boundaries

### Stores and Services

- `settingsStore`: appearance, editor, AI, advanced settings, shortcuts, and writing goals.
- `workspacePreferences`: favorites, recent files, and layout preferences.
- `templateService`: built-in and user template CRUD.
- `chatSessionService`: session metadata, message history, active session, and persistence.
- `fileSelectionStore`: file tree selection and batch operation state.
- `logger` / `errorHandler`: consistent diagnostics and user-facing error routing.

Storage rules:

- Small preferences use `safeStorage` or localStorage-backed helpers.
- Larger histories, especially AI chat sessions, use IndexedDB/Dexie.
- Real file content continues through vault/file services.

Suggested namespaced keys:

- `ai-markdown:favorites`
- `ai-markdown:recent-files`
- `ai-markdown:keyboard-shortcuts`
- `ai-markdown:templates`
- `ai-markdown:knowledge-panel-view-mode`

Existing keys should be read compatibly and migrated opportunistically on first successful load.

### UI Components and Composables

- `App.vue`: app shell composition only.
- `TabContextMenu`: pointer-positioned tab actions.
- `useResponsivePanels`: AI, graph, right dock, and minimum editor width policy.
- `FileExplorer` family: visible file tree, favorites section, and batch toolbar; selection state lives in a store.
- `KnowledgePanel`: simple/advanced display, inline properties and insights, graph filter controls, and deferred graph work.
- `Editor` toolbar: core commands plus More menu, backed by command registry where possible.
- `SettingsPanel`: grouped sections for appearance, editor, AI, shortcuts, writing goals, and advanced settings.

## Error Handling

- File operations should report typed outcomes such as missing file, permission denied, conflict, cancelled, and unknown error.
- Batch operations should execute item by item and summarize successes and failures.
- Destructive batch operations require confirmation.
- AI session persistence failure should not discard the in-memory conversation; show a non-blocking warning.
- Image paste failure should not insert markdown.
- Markdown lint and spelling checks are advisory only.

## Testing Strategy

- Unit-test services, stores, and composables first: favorites, templates, chat sessions, shortcuts, file selection, renderer configuration, and recent-file cleanup.
- Component-test key UI states where practical: SettingsPanel groups, Editor More menu, KnowledgePanel simple/advanced mode, and ExportDialog scope selection.
- Keep E2E focused on high-value flows: favorites persistence, multi-select batch operation, AI session restore, image paste, shortcut rebinding, and batch export.
- Each phase ends with `npm test -- --run`, `npm run typecheck`, and `npm run build`.

## Risk Controls

- Do not modify `opencode.json` without explicit user instruction.
- Preserve current user data and support old storage keys.
- Treat the existing KnowledgePanel simple/advanced mode as intended product direction, but allow code changes to fit the final boundaries.
- Implement destructive batch operations conservatively before adding advanced convenience features.
- Prefer many focused tests over broad brittle E2E coverage.

## Open Decisions Resolved

- All review issues are in scope.
- Delivery is phased, not one large unverified merge.
- The chosen implementation style is vertical slices.
- Existing KnowledgePanel working-tree changes may be rewritten to match the design.
