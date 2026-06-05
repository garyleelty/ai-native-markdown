# Missing Wiki Link Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make missing Wiki Links visible and create a new Markdown note when clicked from preview.

**Architecture:** Keep path and title derivation in `src/utils/wikiLinks.ts`, mark rendered links in `Preview.vue` from known paths, and perform file creation in `App.vue` using the existing file-system and open-file flow.

**Tech Stack:** Vue 3, TypeScript, Markdown-it, Element Plus, Playwright.

---

### Task 1: Add Missing Target Helpers

**Files:**
- Modify: `src/utils/wikiLinks.ts`
- Modify: `src/utils/index.ts`

- [x] Add `getCreatableWikiLinkPath(rawTarget, currentFile)` that returns the new file path or `null` for heading-only/current-document links.
- [x] Add `createWikiLinkInitialContent(rawTarget)` that returns a heading title for new notes.
- [x] Export both helpers.

### Task 2: Mark Preview Link State

**Files:**
- Modify: `src/components/Preview.vue`
- Modify: `src/App.vue`

- [x] Add `currentFile` and `markdownPaths` props to `Preview.vue`.
- [x] During Wiki Link restoration, add `wiki-link-exists` or `wiki-link-missing` classes.
- [x] Pass the current file and Markdown paths from `App.vue`.
- [x] Refresh Markdown paths when the workspace changes or after creating a note.

### Task 3: Create Missing Links

**Files:**
- Modify: `src/App.vue`

- [x] In `handleWikiNavigate`, when resolution fails, derive a creatable path.
- [x] Create the note through `fileSystem.writeFile(path, initialContent)`.
- [x] Open the created note through `handleFileSelect(path)`.
- [x] Show a success message on creation and keep warning behavior for non-creatable targets.

### Task 4: User Workflow Test

**Files:**
- Modify: `e2e/preview-security.spec.ts`

- [x] Add a failing test for `[[New Idea]]` showing `.wiki-link-missing`.
- [x] Click the missing link and assert `New Idea.md` opens.
- [x] Assert the preview contains `New Idea`.
- [x] Run the preview spec to verify the test passes.

### Task 5: Verify

Run:

```bash
npm run typecheck
npx playwright test e2e/preview-security.spec.ts
npx playwright test
npm run build
git diff --check
```
