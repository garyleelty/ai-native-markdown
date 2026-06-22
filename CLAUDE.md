# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Native Markdown — a local-first Markdown knowledge workstation built with Electron + Vue 3 + CodeMirror 6. Chinese-language UI (Obsidian-style). Desktop uses real filesystem via Electron IPC; browser fallback uses IndexedDB (Dexie).

## Commands

```bash
npm install              # Install dependencies
npm run dev              # Vite dev server on port 1420
npm run electron:dev     # Vite + Electron desktop app
npm run build            # Production build
npm run typecheck        # vue-tsc type checking
npm run test             # Vitest (unit tests, jsdom)
npm run test:watch       # Vitest watch mode
npx playwright test      # E2E tests (Chromium, requires dev server on 1420)
```

Run a single test file: `npx vitest run src/path/to/test.spec.ts`

## Architecture

### Dual-Backend Vault

The core abstraction is `vaultService` (`src/services/vault/vaultService.ts`). It auto-selects between two backends:
- **Electron FS** (`electronVault.ts`): real filesystem via IPC bridge (`window.aiNativeVault` exposed in `preload.js`)
- **IndexedDB** (`indexedDbVault.ts`): browser fallback using Dexie

All file operations go through `vaultService` — never call the backends directly. The vault also orchestrates side effects: knowledge index updates, RAG re-indexing, version history, and Wiki Link rewriting on rename.

### Electron IPC Boundary

`electron/main.js` handles `vault:*` IPC channels. `electron/preload.js` exposes `window.aiNativeVault` and `window.aiNativeUpdater` via `contextBridge`. Renderer code accesses vault only through these bridged APIs.

### AI System

- `src/services/ai.ts` — unified provider interface (Ollama, OpenAI-compatible). Streaming via SSE.
- `src/services/agent/` — Agent loop with tool-calling. `agentController.ts` runs the multi-step loop, `toolRegistry.ts` manages tools, `tools/` has built-in tools (CRUD notes, search, backlinks, etc.)
- `src/composables/useChatStream.ts` — streaming chat with RAG context injection
- AI config is stored encrypted (AES-GCM) in localStorage via `src/utils/security.ts`

### Knowledge Index

`src/services/knowledgeIndex.ts` — Dexie-backed index of all markdown files. Stores normalized titles, aliases, tags, links, and frontmatter. Powers: backlinks, unlinked mentions, knowledge graph data, and file search. Auto-refreshes on vault changes.

### Composables Pattern

Business logic lives in `src/composables/` as Vue Composition API functions (not in components). Each composable encapsulates a domain: `useFileOperations`, `useKnowledgeGraph`, `useChatStream`, `useAgentChat`, `useRAG`, `useGlobalSearch`, etc. Components compose these.

### Stores (Pinia)

- `editor.ts` — tabs, active file, view mode, unsaved state
- `file.ts` — file tree, workspace state
- `settings.ts` — AI config, theme, sidebar state, feature toggles

### CodeMirror Extensions

`src/extensions/` — each subdirectory is a CodeMirror 6 extension: `ghost-text/`, `inline-edit/`, `ai-actions/`, `live-preview/`, `smart-paste/`, `slash-command/`, `embed/`, `multimodal/`. The theme is in `obsidianTheme.ts`.

### Plugin System

`src/plugin-system/` — full plugin infrastructure:
- `types.ts` — PluginManifest, PluginContext, PluginSidebarTab, EditorAPI, AppAPI, SettingsAPI
- `manager.ts` — PluginManager: register/activate/deactivate plugins, topological dependency sorting, settings persistence via `safeStorage`
- `context.ts` — `createPluginContext()` factory, `bindEditorAPI()` for runtime editor binding, event bus, settings adapter
- `base.ts` — `BasePlugin` abstract class with auto-cleanup on deactivate

`src/plugins/` — all feature plugins, each in its own directory:
- **Editor plugins**: ghost-text, inline-edit, ai-actions, live-preview, smart-paste, slash-commands, multimodal
- **Sidebar plugins**: global-search, knowledge-graph, rss
- **Feature plugins**: ai-panel, templates, daily-notes, export, version-history, migration-audit

Each plugin extends `BasePlugin`, implements `onActivate()`/`onDeactivate()`, and uses convenience methods like `addCommand()`, `addSidebarTab()`, `addEditorExtension()`.

Plugin state (enabled/disabled, settings) is persisted in localStorage under `plugin-system:state`. The `PluginSettings.vue` component provides a UI in the Settings sidebar to toggle plugins.

App.vue initializes the system: `registerAllPlugins()` → `createPluginContext()` → `pluginManager.setContext()` → `pluginManager.activateAll()`. Editor.vue reads `pluginManager.editorExtensions` for dynamic extension loading. Sidebar.vue reads `pluginManager.sidebarTabs` for dynamic tab rendering.

### Embed System

Wiki Links (`[[...]]`) and embeds (`![[...]]`) are handled by:
- `src/utils/wikiLinks.ts` — parsing, normalization, rewriting
- `src/services/embedResolver.ts` — resolves embed targets (notes, headings, block-ids, media assets)
- `src/services/embedRenderer.ts` — renders resolved embeds as HTML
- `src/extensions/embed/` — CodeMirror decoration for embeds in the editor

### Security

- API keys: AES-GCM encryption with PBKDF2 key derivation (`src/utils/security.ts`)
- Markdown/HTML rendering: DOMPurify sanitization
- `safeStorage` wrapper for localStorage with JSON parsing fallback

## UI Design System

The app uses an Obsidian-inspired design system with enhanced visual polish:

### Design Tokens
- **Colors**: Ink & Paper palette with Violet accent (`--violet`, `--violet-bright`, `--violet-dim`)
- **Spacing**: Consistent scale from `--space-1` (4px) to `--space-10` (40px)
- **Radius**: Subtle rounding from `--radius-xs` (4px) to `--radius-full` (9999px)
- **Shadows**: Layered depth with violet ambient light (`--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-glow`)
- **Typography**: SF Pro Display for UI, JetBrains Mono for code, Iowan Old Style for editor
- **Animations**: Spring-based easing (`--ease-spring`), smooth transitions throughout

### Visual Enhancements
- **Gradient accents**: Subtle violet/teal/amber gradients on headers, toolbars, panel headers
- **Glow effects**: Active elements have subtle violet glow (cursor, tabs, buttons)
- **Entrance animations**: Sections fade-in with staggered delays
- **Micro-interactions**: Buttons scale on hover/active, icons animate
- **Grid patterns**: Subtle dot grid backgrounds in graph view
- **Animated backgrounds**: Welcome page has floating gradient orbs

### Key CSS Files
- `src/style.css` — Design system tokens, markdown rendering, CodeMirror overrides
- `src/styles/app.css` — Layout, components, Element Plus overrides
- `src/styles/panel.css` — Panel-specific styles

## Key Conventions

- Path alias: `@/` maps to `src/` (configured in vite.config.ts and tsconfig.json)
- Auto-imports: Element Plus components and Vue APIs are auto-imported via `unplugin-auto-import` and `unplugin-vue-components`. No manual imports needed for Element Plus components.
- All user-facing strings are in Chinese
- CSS variables follow Obsidian naming: `--obsidian-bg-primary`, `--obsidian-text-normal`, `--obsidian-accent`, etc.
- Tests: unit tests use Vitest + jsdom, co-located in `__tests__/` directories. E2E tests use Playwright in `e2e/`.
- The app has two entry points: `src/main.ts` (Vue app) and `electron/main.js` (Electron main process)

## Transformative Features (超越 Obsidian)

### AI 原生能力
- **AI 命令面板** (`CommandPalette.vue`) - 自然语言执行任何操作，输入 `>` 开启 AI 模式
- **AI 知识分析** (`KnowledgePanel.vue`) - 智能分析知识图谱，发现连接和洞察
- **智能 Ghost Text** (`completionService.ts`) - 上下文感知的写作建议，理解文档结构
- **写作分析** (`useWritingAnalysis.ts`) - 实时写作质量指标，可读性评分，语法建议
- **智能模板** (`templateService.ts`) - AI 驱动的模板生成，根据需求自动创建内容
- **语义搜索** (`useGlobalSearch.ts`) - 自然语言搜索，理解意图而非仅匹配文本
- **研究助手** (`useResearchAssistant.ts`) - 自动发现和建议相关内容

### 与 Obsidian 的差异
- Obsidian 依赖插件实现 AI 功能，此应用 AI 是一等公民
- Obsidian 的图谱只是可视化，此应用能主动发现洞察
- Obsidian 的搜索是文本匹配，此应用支持语义搜索
- Obsidian 的模板是静态的，此应用能智能生成模板
- Obsidian 没有内置写作分析，此应用提供实时质量指标
