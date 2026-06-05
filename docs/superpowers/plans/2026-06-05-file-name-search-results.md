# File Name Search Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder file-name search behavior with a real workspace-wide result list.

**Architecture:** Keep search state inside `FileExplorer.vue`. Use `fileSystem.getAllMarkdownFiles()` for file-name search and keep content search on `fileSystem.searchFiles()`.

**Tech Stack:** Vue 3, TypeScript, Element Plus, Playwright.

---

### Task 1: Add Tests

**Files:**
- Modify: `e2e/file-and-editor.spec.ts`

- [ ] Update the existing `文件名搜索和内容搜索可以定位文档` test to expect a file-name result card instead of relying on the tree.
- [ ] Add a command palette file-name search test that creates a nested Markdown file, runs `搜索文件名`, types part of the file name, clicks the result, and verifies the editor opens it.

### Task 2: Implement File Name Search Results

**Files:**
- Modify: `src/components/sidebar/FileExplorer.vue`

- [ ] Add separate result state for content search and file-name search.
- [ ] Add a computed `activeSearchResults` selected by `searchMode`.
- [ ] Search all Markdown files through `fileSystem.getAllMarkdownFiles()` when the mode is `name`.
- [ ] Sort exact prefix matches before substring matches.
- [ ] Render file-name results with file name and relative path.
- [ ] Hide the normal tree while a search query is active.

### Task 3: Verify

Run:

```bash
npm run typecheck
npx playwright test e2e/file-and-editor.spec.ts -g "文件名搜索|搜索文件名"
npx playwright test
npm run build
git diff --check
```
