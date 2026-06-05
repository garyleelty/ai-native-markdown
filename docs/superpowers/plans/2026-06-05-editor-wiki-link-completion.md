# Editor Wiki Link Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline Wiki Link note completion to the CodeMirror editor.

**Architecture:** `App.vue` passes existing `markdownPaths` into `Editor.vue`. `Editor.vue` computes the active unfinished Wiki Link query from CodeMirror cursor state, renders a small Vue popup, and inserts the selected note title with a CodeMirror transaction.

**Tech Stack:** Vue 3, TypeScript, CodeMirror 6, Playwright.

---

### Task 1: Add failing e2e coverage

**Files:**
- Modify: `e2e/file-and-editor.spec.ts`

- [ ] **Step 1: Add a completion insertion test**

Add a test that creates `/workspace/Alpha Note.md`, opens `/workspace/wiki-completion-source.md`, types `[[alp`, expects a `.wiki-link-completion` popup with `Alpha Note`, presses `Enter`, saves, and verifies the file contains `[[Alpha Note]]`.

- [ ] **Step 2: Add an empty-state and Escape test**

Add a test that types an unmatched Wiki Link query, expects `没有匹配笔记`, presses `Escape`, and verifies the popup closes while the typed text remains.

- [ ] **Step 3: Run the target tests**

Run: `npx playwright test e2e/file-and-editor.spec.ts -g "Wiki Link 补全"`

Expected: fail because the popup does not exist yet.

### Task 2: Wire Markdown paths into the editor

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/Editor.vue`

- [ ] **Step 1: Add an editor prop**

Add `markdownPaths?: string[]` to `Editor.vue` props with an empty-array default.

- [ ] **Step 2: Pass App paths**

Pass `:markdown-paths="markdownPaths"` from `App.vue` to `<Editor>`.

### Task 3: Implement completion behavior

**Files:**
- Modify: `src/components/Editor.vue`

- [ ] **Step 1: Detect active Wiki Link query**

On CodeMirror selection/doc updates, inspect the current line before the cursor. If the nearest unmatched `[[` appears after the nearest `]]`, treat the text after `[[` as the query. If the query contains `]`, newline, or `|`, close completion.

- [ ] **Step 2: Build suggestions**

Map Markdown paths to title/path suggestions, hide `.md` and `.markdown`, filter by lowercase title or workspace-relative path, limit to six, and keep a selected index.

- [ ] **Step 3: Insert selection**

Replace from the `[[` start through the cursor with `[[Selected Title]]`, move the cursor after the closing brackets, focus the editor, and close the popup.

- [ ] **Step 4: Add keyboard handling**

While the popup is open, handle `ArrowDown`, `ArrowUp`, `Enter`, `Tab`, and `Escape`. Only `Enter`/`Tab` insert when a suggestion is selected.

- [ ] **Step 5: Add compact UI and styles**

Render the popup in the editor wrapper with accessible buttons, stable dimensions, selected row state, and an empty state.

### Task 4: Verify

**Files:**
- No source changes unless verification reveals defects.

- [ ] **Step 1: Run target tests**

Run: `npx playwright test e2e/file-and-editor.spec.ts -g "Wiki Link 补全"`

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

- [ ] **Step 3: Run full e2e**

Run: `npx playwright test`

- [ ] **Step 4: Run build and diff check**

Run: `npm run build && git diff --check`
