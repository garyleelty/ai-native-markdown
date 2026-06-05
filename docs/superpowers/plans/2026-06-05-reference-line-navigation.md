# Reference Line Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Knowledge panel backlink and unlinked mention rows open the source file at the matching line.

**Architecture:** Add line metadata in `knowledgeIndex`, emit complete references through `ReferenceList` and `KnowledgePanel`, and route the selection in `App.vue` through the existing file-open and line-scroll behavior.

**Tech Stack:** Vue 3, TypeScript, Dexie, Playwright.

---

### Task 1: Add failing E2E coverage

**Files:**
- Modify: `e2e/knowledge-export-history.spec.ts`

- [ ] Add a test where `Target.md` has a backlink source with the wiki link on a later line. Open Knowledge panel, click the backlink row, and assert the active tab is the source note and the status bar contains the expected line number.
- [ ] Add a test where `Target.md` is mentioned without a wiki link in a later line. Open Knowledge panel, click the mention row, and assert the active tab is the source note and the status bar contains the expected line number.
- [ ] Run `npx playwright test e2e/knowledge-export-history.spec.ts -g "知识面板点击"` and confirm the new tests fail before implementation.

### Task 2: Compute line numbers in the knowledge index

**Files:**
- Modify: `src/services/knowledgeIndex.ts`

- [ ] Extend `KnowledgeIndexRecord` with raw note content needed for reference line lookup.
- [ ] Extend `KnowledgeReference` with optional `lineNumber`.
- [ ] In `indexFile`, persist the content.
- [ ] Add helper logic to find the first line containing a matching wiki link target for backlinks.
- [ ] Add helper logic to find the first line containing a valid unlinked text mention.
- [ ] Include `lineNumber` in `getBacklinks` and `getUnlinkedMentions` results.

### Task 3: Forward full references through the UI

**Files:**
- Modify: `src/components/sidebar/ReferenceList.vue`
- Modify: `src/components/sidebar/KnowledgePanel.vue`
- Modify: `src/components/Sidebar.vue`
- Modify: `src/App.vue`

- [ ] Change `ReferenceList` to emit `KnowledgeReference`.
- [ ] Render a compact line badge when `item.lineNumber` exists.
- [ ] Change `KnowledgePanel` and `Sidebar` events to forward the full reference.
- [ ] Add `handleKnowledgeReferenceSelect` in `App.vue`: open `reference.filePath`, then navigate to `reference.lineNumber` when present.

### Task 4: Verify

**Files:**
- No source edits unless verification finds a bug.

- [ ] Run `npm run typecheck`.
- [ ] Run `npx playwright test e2e/knowledge-export-history.spec.ts`.
- [ ] Run `npx playwright test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
