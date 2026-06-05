# Command Palette Sidebar Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Inline execution in this session. Do not use subagents for this plan because the user explicitly requested no subagent use.

**Goal:** Add keyboard command palette entries for sidebar panels and knowledge index refresh.

**Architecture:** Expose small panel-control methods from `Sidebar.vue` and `KnowledgePanel.vue`, then map new command IDs in `App.vue`. Cover the behavior with focused Playwright tests in `e2e/sidebar.spec.ts`.

**Tech Stack:** Vue 3, Pinia, Element Plus, Playwright.

---

### Task 1: Expose Sidebar Panel Controls

**Files:**
- Modify: `src/components/Sidebar.vue`
- Modify: `src/components/sidebar/KnowledgePanel.vue`

- [ ] **Step 1: Add a `knowledgePanelRef` in `Sidebar.vue`.**

- [ ] **Step 2: Add `openTab(tab: SidebarTab)` that validates the tab and updates `activeTab`.**

- [ ] **Step 3: Add `refreshKnowledgeIndex()` that opens the graph tab and calls `KnowledgePanel.refreshIndex()` after render.**

- [ ] **Step 4: Expose `refreshIndex` from `KnowledgePanel.vue`.**

### Task 2: Add Command Palette Entries

**Files:**
- Modify: `src/components/CommandPalette.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Add view commands for file, knowledge, AI settings, outline, and settings panels.**

- [ ] **Step 2: Add a knowledge command category with `刷新知识索引`.**

- [ ] **Step 3: Map new command IDs in `App.vue`. Panel commands should reveal the sidebar before switching tab.**

### Task 3: Add Regression Tests

**Files:**
- Modify: `e2e/sidebar.spec.ts`

- [ ] **Step 1: Import existing helper utilities.**

- [ ] **Step 2: Test command palette sidebar panel switching.**

- [ ] **Step 3: Test command palette knowledge refresh after creating a Markdown file.**

### Task 4: Verify

Run:

```bash
npm run typecheck
npx playwright test e2e/sidebar.spec.ts
npx playwright test
npm run build
git diff --check
```

Expected: all commands pass.
