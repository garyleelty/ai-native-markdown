# Rename Updates Wiki Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Wiki Links valid when Markdown files or folders are renamed.

**Architecture:** Add a pure Wiki Link rewrite helper, call it from the file-system rename path for saved files, and mirror the same rewrite into open editor tabs after UI rename events. This keeps persistence and in-memory editor state aligned.

**Tech Stack:** Vue 3, Pinia, Dexie, TypeScript, Playwright.

---

### Task 1: Failing Tests

**Files:**
- Modify: `e2e/file-and-editor.spec.ts`

- [ ] **Step 1: Add tests for service and UI rename behavior**

Add one direct service test that renames a linked target and checks saved source content. Add one UI test that keeps a source note open while the target is renamed and checks the editor updates.

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `npx playwright test e2e/file-and-editor.spec.ts -g "Wiki Link"`

Expected before implementation: at least one assertion still sees the old Wiki Link target.

### Task 2: Pure Wiki Link Rewrite Utility

**Files:**
- Modify: `src/utils/wikiLinks.ts`
- Modify: `src/utils/index.ts`

- [ ] **Step 1: Implement `updateWikiLinksForRename`**

The helper should parse `[[target#heading|alias]]`, resolve each target against the pre-rename path list, and rewrite only links that resolve to the renamed file or renamed folder descendants.

- [ ] **Step 2: Preserve fragments, aliases, relative paths, workspace-relative paths, and extension style**

Use path helpers instead of ad-hoc string replacement so `../notes/Old.md`, `notes/Old`, and `Old#Part` each get an expected new target.

### Task 3: Persist Rewrites During Rename

**Files:**
- Modify: `src/services/fileSystem.ts`

- [ ] **Step 1: Capture pre-rename Markdown paths**

Before moving records in Dexie, collect existing Markdown paths for correct old-target resolution.

- [ ] **Step 2: Update saved Markdown contents after path moves**

After moving records, scan Markdown files, rewrite matching Wiki Links, save changed content, and reindex changed files.

- [ ] **Step 3: Return changed link paths from `renameFile`**

Return metadata without breaking existing callers that ignore the result.

### Task 4: Sync Open Tabs

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/sidebar/FileExplorer.vue`

- [ ] **Step 1: Include `updatedLinkPaths` in rename events**

Forward the service result from `FileExplorer.vue`.

- [ ] **Step 2: Rewrite open tab content in `App.vue`**

Apply the same pure helper to every open Markdown tab after path rename. Keep modified tabs modified, and update the active editor content if the active tab changed.

### Task 5: Verification

**Files:**
- Test: `e2e/file-and-editor.spec.ts`

- [ ] **Step 1: Run targeted tests**

Run: `npx playwright test e2e/file-and-editor.spec.ts -g "Wiki Link"`

- [ ] **Step 2: Run full checks**

Run:

```bash
npm run typecheck
npx playwright test
npm run build
git diff --check
```
