# Command Palette Quick Open Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Inline execution in this session. Do not use subagents for this plan because the user explicitly requested no subagent use.

**Goal:** Make the command palette open notes by searching Markdown file names and paths.

**Architecture:** Reuse `markdownPaths` from `App.vue`, derive note results inside `CommandPalette.vue`, and route selected `file.quick-open:<path>` commands back through the existing file selection flow.

**Tech Stack:** Vue 3, Element Plus, Playwright.

---

### Task 1: Add Dynamic Note Results

**Files:**
- Modify: `src/components/CommandPalette.vue`

- [ ] **Step 1: Add a `markdownPaths` prop with a default empty array.**

- [ ] **Step 2: Derive note result commands when the search query is non-empty.**

- [ ] **Step 3: Render the path metadata without breaking existing command rows.**

### Task 2: Wire App-Level Quick Open

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Pass `markdownPaths` into `CommandPalette`.**

- [ ] **Step 2: Refresh markdown paths after demo workspace and folder import handlers.**

- [ ] **Step 3: Handle `file.quick-open:<path>` by opening the selected file.**

### Task 3: Add Regression Coverage

**Files:**
- Modify: `e2e/file-and-editor.spec.ts`

- [ ] **Step 1: Create a workspace file with unique title text.**

- [ ] **Step 2: Search for it through the command palette.**

- [ ] **Step 3: Select the note result and verify the editor opens the file.**

### Task 4: Verify

Run:

```bash
npm run typecheck
npx playwright test e2e/file-and-editor.spec.ts -g "命令面板可以快速打开笔记"
npx playwright test
npm run build
git diff --check
```

Expected: all commands pass.
