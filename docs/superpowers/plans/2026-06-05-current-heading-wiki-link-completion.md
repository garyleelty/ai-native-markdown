# Current Heading Wiki Link Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing editor Wiki Link completion popup so `[[#...` suggests headings from the current document.

**Architecture:** Keep all behavior inside `src/components/Editor.vue`. Extend the existing suggestion type with `kind`, parse headings from the current CodeMirror document, branch suggestions by query prefix, and keep the same insertion/keymap path.

**Tech Stack:** Vue 3, TypeScript, CodeMirror 6, Playwright.

---

### Task 1: Add failing e2e coverage

**Files:**
- Modify: `e2e/file-and-editor.spec.ts`

- [ ] **Step 1: Add current-heading completion test**

Create a document containing `# Source`, `## Deep Heading`, and body text. Type `[[#deep`, expect `.wiki-link-completion` to contain `Deep Heading` and `当前文档 · H2`, press `Enter`, save, and verify the file contains `[[#Deep Heading]]`.

- [ ] **Step 2: Run the target test**

Run: `npx playwright test e2e/file-and-editor.spec.ts -g "当前文档标题补全"`

Expected: fail because `[[#...` currently uses note completion and shows no matching heading.

### Task 2: Extend suggestion types

**Files:**
- Modify: `src/components/Editor.vue`

- [ ] **Step 1: Add suggestion kind**

Change `WikiLinkSuggestion` to include `kind: 'note' | 'heading'`, `insertText`, and `meta`.

- [ ] **Step 2: Update template bindings**

Render `suggestion.title` and `suggestion.meta` instead of hard-coded `relativePath`.

### Task 3: Add heading parsing and filtering

**Files:**
- Modify: `src/components/Editor.vue`

- [ ] **Step 1: Parse current headings**

Read `editorView.state.doc.toString()`, split lines, and collect headings matching `/^(#{1,6})\s+(.+)$/` with level and clean text.

- [ ] **Step 2: Branch suggestions by query**

If the query starts with `#`, filter heading suggestions by heading text or slug. Otherwise, keep note suggestions unchanged.

- [ ] **Step 3: Insert heading fragment**

For heading suggestions, insert `[[#Heading Text]]`. For note suggestions, keep inserting `[[Note Title]]`.

### Task 4: Verify

**Files:**
- No source changes unless verification finds a defect.

- [ ] **Step 1: Run target tests**

Run: `npx playwright test e2e/file-and-editor.spec.ts -g "补全"`

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

- [ ] **Step 3: Run full e2e**

Run: `npx playwright test`

- [ ] **Step 4: Run build and diff check**

Run: `npm run build && git diff --check`
