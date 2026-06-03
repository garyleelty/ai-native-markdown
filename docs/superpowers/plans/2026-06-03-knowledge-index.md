# Knowledge Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-grade slice of the future knowledge-management roadmap: indexed properties, backlinks, unlinked mentions, and graph data.

**Architecture:** Add a dedicated IndexedDB knowledge index that is updated by file operations. UI reads from the index instead of rescanning every Markdown file on every render.

**Tech Stack:** Vue 3, TypeScript, Dexie, Element Plus, D3 knowledge graph component.

---

### Task 1: Metadata Parser

**Files:**
- Create: `src/utils/metadata.ts`
- Modify: `src/utils/index.ts`

- [ ] Parse YAML-like frontmatter into a plain object.
- [ ] Extract title, aliases, tags, wiki links, and plain searchable text.
- [ ] Export parser helpers through `src/utils/index.ts`.

### Task 2: Knowledge Index Service

**Files:**
- Create: `src/services/knowledgeIndex.ts`
- Modify: `src/services/index.ts`

- [ ] Create a Dexie database for indexed Markdown metadata.
- [ ] Add file indexing, delete, rename, full rebuild, backlink lookup, unlinked mention lookup, and graph generation APIs.

### Task 3: File Operation Integration

**Files:**
- Modify: `src/services/fileSystem.ts`

- [ ] Index Markdown content on create/write/import.
- [ ] Remove index records on delete.
- [ ] Rename index records when files or folders are renamed.

### Task 4: Knowledge Sidebar

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/Sidebar.vue`
- Modify: `src/components/sidebar/KnowledgePanel.vue`

- [ ] Pass the active file path into the sidebar.
- [ ] Replace the graph-only panel with tabs for Properties, Backlinks, Unlinked mentions, and Graph.
- [ ] Keep the panel compact and consistent with the existing Obsidian-like UI.

### Task 5: Docs and Verification

**Files:**
- Modify: `README.md`

- [ ] Move basic Backlinks, Unlinked mentions, and Frontmatter Properties into supported features.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
