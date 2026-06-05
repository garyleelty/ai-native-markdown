# Search Result Line Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make full-text search results open directly at their first matching line.

**Architecture:** Propagate a typed search result selection event from `FileExplorer.vue` through `Sidebar.vue` to `App.vue`, then reuse `handleFileSelect` and `handleOutlineNavigate`.

**Tech Stack:** Vue 3, TypeScript, Element Plus, Playwright.

---

### Task 1: Add Regression Coverage

**Files:**
- Modify: `e2e/file-and-editor.spec.ts`

- [x] Use a content search fixture where the matching phrase is on line 2.
- [x] Click the content search result card.
- [x] Assert that the file opens and `.status-bar` contains `行 2`.

### Task 2: Emit Search Result Selection

**Files:**
- Modify: `src/components/sidebar/FileExplorer.vue`

- [x] Add a `search-result-select` emit with payload `{ path: string; lineNumber?: number }`.
- [x] In `handleSearchResultClick`, emit the first match line number when present.
- [x] Keep clearing search after emitting.

### Task 3: Wire Sidebar and App

**Files:**
- Modify: `src/components/Sidebar.vue`
- Modify: `src/App.vue`

- [x] Forward `search-result-select` from `Sidebar.vue`.
- [x] Add `handleSearchResultSelect` in `App.vue`.
- [x] Open the file, then call `handleOutlineNavigate(lineNumber)` when line number exists.

### Task 4: Verify

Run:

```bash
npm run typecheck
npx playwright test e2e/file-and-editor.spec.ts -g "文件名搜索和内容搜索"
npx playwright test
npm run build
git diff --check
```
