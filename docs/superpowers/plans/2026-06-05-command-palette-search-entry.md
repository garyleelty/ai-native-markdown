# Command Palette Search Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add command palette entries that open and focus file-name search or global content search.

**Architecture:** Keep commands declarative in `CommandPalette.vue`. Route command execution through `App.vue` to `Sidebar.vue`, and expose a focused search method from `FileExplorer.vue`.

**Tech Stack:** Vue 3, TypeScript, Element Plus, Playwright.

---

### Task 1: Add Regression Coverage

**Files:**
- Modify: `e2e/file-and-editor.spec.ts`

- [ ] Add a Playwright test after `命令面板可以快速打开笔记`.
- [ ] Create `/workspace/Command Search Target.md` with a unique content phrase.
- [ ] Run the `全局内容搜索` command.
- [ ] Type the phrase into the focused search input, press Enter, and expect the search result card.
- [ ] Click the result and verify the file opens.

### Task 2: Add Command Palette Entries

**Files:**
- Modify: `src/components/CommandPalette.vue`

- [ ] Add `search.file-name` with label `搜索文件名` in category `搜索`.
- [ ] Add `search.content` with label `全局内容搜索` in category `搜索`.
- [ ] Add `搜索` to `categoryOrder` after `笔记`.

### Task 3: Expose File Search Focus

**Files:**
- Modify: `src/components/sidebar/FileExplorer.vue`

- [ ] Add a template ref to the search input.
- [ ] Implement `focusSearch(mode: 'name' | 'content', query = '')`.
- [ ] Clear stale results when switching modes or resetting the query.
- [ ] Run content search automatically only when a non-empty content query is passed.
- [ ] Persist and restore the workspace root path so sidebar hide/show does not lose the file explorer context.
- [ ] Expose `focusSearch`.

### Task 4: Wire Sidebar and App Commands

**Files:**
- Modify: `src/components/Sidebar.vue`
- Modify: `src/App.vue`

- [ ] Add `focusFileSearch(mode, query?)` to `Sidebar.vue`.
- [ ] Switch the active sidebar tab to `files` and wait for `FileExplorer.vue` before focusing.
- [ ] Add `focusFileSearchFromCommand(mode)` in `App.vue`.
- [ ] Map command IDs `search.file-name` and `search.content`.

### Task 5: Verify

Run:

```bash
npm run typecheck
npx playwright test e2e/file-and-editor.spec.ts -g "全局内容搜索"
npx playwright test
npm run build
git diff --check
```
