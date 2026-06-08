# Current Architecture

Date: 2026-06-09

This document is the current architecture fact source for AI Native Markdown.

## Product Shape

AI Native Markdown is a local-first AI Markdown workspace built with Electron, Vue 3, TypeScript, Vite, Pinia, CodeMirror 6, Markdown-it, Node filesystem access, Dexie/IndexedDB, D3, Tesseract.js, and pdf.js.

The current application is not a Tauri application. Historical docs and plans may mention Tauri or `src-tauri`; those references describe an older direction and should not be treated as the current implementation.

## Runtime

- Renderer: Vue 3 application mounted from `src/main.ts`.
- Desktop shell: Electron entrypoint at `electron/main.js`.
- Build: Vite production build, packaged by `electron-builder`.
- Dev server: Vite on port `1420`.

## Persistence Model

The current persistence model has two backends behind `src/services/vault/vaultService.ts`:

- Desktop Vault: Electron main-process handlers in `electron/vaultHandlers.js` read and write the selected native folder through `fs/promises`. The preload bridge in `electron/preload.js` exposes the safe `window.aiNativeVault` API and Vault change subscription to the renderer.
- Browser/demo fallback: Dexie database `ai-markdown-fs` in `src/services/fileSystem.ts`, wrapped by `src/services/vault/indexedDbVault.ts`.
- Frontend callers use `vaultService`, not the backend directly. `src/App.vue`, `src/components/sidebar/FileExplorer.vue`, `src/composables/useFileOperations.ts`, `src/services/embedResolver.ts`, and knowledge line-resolution paths are backend-agnostic.
- Vault paths are normalized to `/workspace/...`; Electron maps those virtual paths to the selected native folder and rejects path traversal outside the active Vault.
- Knowledge index: Dexie database `ai-markdown-knowledge-index` in `src/services/knowledgeIndex.ts`. Queries use indexed lookups and streaming with `.each()`/`.until()` instead of full-table `toArray()`.
- RAG chunks and metadata: Dexie database `ai-markdown-rag` in `src/services/rag.ts`.
- Version history: Dexie-backed service in `src/services/versionHistory.ts`.
- UI settings and tab/session state: `localStorage` through `safeStorage`.
- API keys: AES-GCM encrypted via Web Crypto API (`crypto.subtle`) with PBKDF2 key derivation in `src/utils/security.ts`. Legacy XOR obfuscation is deprecated but a fallback path exists for migration.

Desktop folder opening now keeps a live binding to the real filesystem folder. Electron watches the active Vault and `src/App.vue` refreshes the file tree, Markdown path list, knowledge index, and unmodified open tabs when external changes arrive. Modified tabs are preserved instead of being overwritten; when the same file also changes on disk, the editor shows a conflict banner with reload-disk and keep-local actions. The IndexedDB workspace remains the browser and demo fallback.

## Core Application Areas

- `src/App.vue`: top-level layout, command palette dispatch, file/navigation orchestration, drag-and-drop import, mobile sidebar behavior, session timer, and global keyboard handling.
- `src/components/Editor.vue`: CodeMirror host, toolbar, editor extensions, Wiki Link completion, tag autocompletion (`#` trigger), find/replace, wrapping helpers, and exposed editor commands.
- `src/components/Preview.vue`: Markdown preview, Wiki Link rendering/navigation, Mermaid rendering, KaTeX, task lists, source-line mapping, and preview/editor line sync.
- `src/components/sidebar/FileExplorer.vue`: Vault file tree, file creation/rename/delete, search, recent files, and workspace/demo entry points.
- `src/components/sidebar/KnowledgePanel.vue`: backlinks, unlinked mentions, outgoing links, graph stats, and knowledge-index refresh controls.
- `src/components/sidebar/PropertiesPanel.vue`: YAML Frontmatter property editor with automatic type inference (text, number, boolean, date, tag, select, URL, email), type preference memory, and real-time sync with editor content.
- `src/components/ai-panel/ChatPanel.vue`: AI chat UI, streaming responses, RAG context integration, Agent mode, and chat history.
- `src/components/CommandPalette.vue`: `Cmd/Ctrl+P` command palette for quick file open, search, sidebar switching, and view operations.
- `src/components/knowledge/KnowledgeGraph.vue`: D3 force-directed graph visualization with global/current-note view modes, search filtering (matches + direct neighbors), and node click navigation.
- `src/services/migrationAudit.ts` and `src/components/MigrationAuditDialog.vue`: command-driven Vault audit for unresolved Wiki Links, note embeds, heading sections, `^block-id` references, image/audio/video/PDF attachment targets, unreferenced supported attachments, and unsupported attachment formats. The dialog can navigate to the source line, batch-create placeholder Markdown notes for missing-note issues, and append placeholder headings or block IDs to existing target notes for missing-heading and missing-block issues.

## Editing Modes

The application supports three Obsidian-style editing modes:

1. **Source mode**: Raw Markdown text editing with Obsidian-style syntax highlighting (`src/extensions/obsidianTheme.ts`).
2. **Live Preview mode**: Inline rendering within the editor via `src/extensions/live-preview/`. Task list checkboxes are directly toggleable.
3. **Reading mode**: Read-only rendered view via `src/components/Preview.vue`.

Mode switching is managed through the editor store and the header toolbar.

## AI Model

AI providers are configured in `src/services/ai.ts` and `src/stores/settings.ts`.

Supported provider shapes:

- Ollama local endpoint.
- OpenAI-compatible cloud endpoint.
- DeepSeek-compatible configuration.

API key handling uses Web Crypto API (AES-GCM + PBKDF2) for encryption. Legacy XOR obfuscation is deprecated but a fallback path exists for backward compatibility.

### Agent System

The Agent system (`src/services/agent/`) enables AI to perform actions on the Vault:

- `agentController.ts`: Orchestrates Agent execution, tool calls, and conversation flow.
- `contextBuilder.ts`: Builds context from current document, RAG results, and knowledge index.
- `toolRegistry.ts`: Registers and validates available tools.
- Built-in tools: create/read/write/append/delete/move/search notes, get backlinks, get tags, and more.

Agent mode is toggled in the AI chat panel and uses the same streaming infrastructure as regular chat.

## Knowledge Model

The current knowledge system is Markdown-file oriented:

- Metadata extraction supports title, aliases, tags, links, frontmatter, and searchable text.
- Wiki Links are normalized and indexed.
- Backlinks use indexed `normalizedLinks` with paginated/streaming queries.
- Unlinked mentions scan indexed searchable text and resolve line numbers from source content.
- Graph data is generated from current knowledge-index records.
- Global search (`src/composables/useGlobalSearch.ts`) prioritizes the knowledge index `searchableText` field over full file content reads.
- Knowledge index queries use `.where()`/`.filter()` with `.each()`/`.until()` instead of `toArray()` full-table loads.

## RAG Model

The current RAG service is lexical, not semantic-vector based:

- Documents are split into overlapping text chunks.
- Search tokenizes Latin and CJK text.
- Scoring is based on phrase/token hits in title, path, and content.
- Context is built from the top scored chunks.

Embedding-based semantic retrieval is not implemented in the current architecture.

## Properties Panel

The properties panel (`src/components/sidebar/PropertiesPanel.vue` + `src/composables/useProperties.ts` + `src/services/frontmatterService.ts`) provides structured editing of YAML Frontmatter:

- Automatic type inference: text, number, boolean, date, tag, select, URL, email.
- Type preference memory per property name.
- Real-time bidirectional sync with editor content.
- Keyboard shortcuts: `Cmd+Enter` to add property, `Tab` to switch inputs, `Esc` to cancel.
- Select type with dropdown options and custom creation.

## Markdown Rendering

Preview rendering uses a shared Markdown-it factory (`createMarkdownRenderer`) to ensure consistency between preview and export:

- Markdown source rendering with raw HTML disabled.
- Task lists.
- Anchor links.
- KaTeX.
- Mermaid fences rendered asynchronously.
- Wiki Link inline parsing and navigation.
- `![[...]]` block embeds for full notes, heading sections, `^block-id` block references, current-file sections/blocks, image/audio/video/PDF attachments, preview rendering, and HTML export inlining.
- Source-line attributes for editor/preview synchronization.
- DOMPurify sanitization with `style` attribute excluded from allowed list to prevent CSS injection.

Block embed support is wired through `src/utils/markdown/embedPlugin.ts`, `src/services/embedResolver.ts`, `src/services/embedRenderer.ts`, `src/services/embedSyncService.ts`, `src/components/Preview.vue`, `src/utils/exportHtml.ts`, `src/extensions/embed/embedWidget.ts`, and `src/extensions/live-preview/livePreviewPlugin.ts`. Live Preview currently decorates whole-line `![[...]]` embeds inside the editor. Block references use `#^block-id` targets and share extraction/navigation helpers in `src/utils/wikiLinks.ts`. Embed rendering records source dependencies, and Vault/source-file changes refresh affected host previews and Live Preview widgets without editing the host document. Image, audio, video, and PDF attachments are read through `vaultService.readAsset()` as data URLs so native binary assets can render in Preview, Live Preview, and HTML export.

## Security

- API keys: AES-GCM encryption via Web Crypto API with PBKDF2 key derivation (`src/utils/security.ts`). No XOR or other reversible obfuscation for new data.
- Markdown sanitization: DOMPurify with centralized whitelist in `security.ts`. The `style` attribute is excluded to prevent CSS injection.
- Error handling: `wrapAsync` and similar wrappers must explicitly return failure signals (`undefined`) with honest type signatures (`Promise<T | undefined>`).
- State persistence: Single-write pattern via `watch` callbacks; setter functions only modify ref values.

## Release Gates

Current local verification commands:

```bash
npm run typecheck
npm run build
npx vitest run
npx playwright test
```

As of 2026-06-09, these pass locally: TypeScript, production build, 408 unit tests.

## Strategic Gaps Versus Obsidian

The main gaps are not isolated UI defects. They are platform-level:

1. Stable plugin/extension API.
2. Richer Obsidian migration tooling beyond audit, placeholder creation, and asset inventory: guided import, attachment relocation/rename repairs, alias edge cases, large-vault performance budgets, and repair reports.
3. Semantic RAG and graph-aware AI context.
4. Agent workflow with dry-run, diff review, confirmed writes, and rollback.
5. Properties/Bases-like structured views (properties panel exists; Bases/database view does not).
6. Sync or compatibility with external file sync tools.
7. Canvas or whiteboard workflow.
8. Mobile app or mobile-grade PWA strategy.
9. More native filesystem polish: recent native Vaults, batch-sync conflict handling, merge strategy, deeper external sync compatibility, and OS keychain integration.

The recommended product direction is to compete as an AI-native local knowledge workspace, not as a broad Obsidian clone.
