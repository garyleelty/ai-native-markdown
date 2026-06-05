# Graph Search Opens Nodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn graph search into a direct note navigation control.

**Architecture:** Keep the feature local to `KnowledgeGraph.vue`. Compute filtered nodes from `graphData`, render accessible result buttons, and reuse the existing `nodeClick` event to open notes through `KnowledgePanel`.

**Tech Stack:** Vue 3, TypeScript, D3 graph component, Playwright.

---

### Task 1: Failing Test

**Files:**
- Modify: `e2e/knowledge-export-history.spec.ts`

- [ ] **Step 1: Add a graph search navigation test**

Create two notes, rebuild the knowledge index, open the graph tab, search for the target note, click the result, and assert the target tab opens.

- [ ] **Step 2: Run the targeted test**

Run: `npx playwright test e2e/knowledge-export-history.spec.ts -g "图谱搜索"`

Expected before implementation: the result button is not found.

### Task 2: Graph Search UI

**Files:**
- Modify: `src/components/knowledge/KnowledgeGraph.vue`

- [ ] **Step 1: Add computed search results**

Match by label, id, path, and tags. Limit visible results to six.

- [ ] **Step 2: Render result buttons and empty state**

Use semantic `<button>` controls with stable classes and `aria-label`s. Keep the result band compact and visually consistent with the sidebar.

- [ ] **Step 3: Add keyboard actions**

Enter opens the first result. Escape clears the search.

### Task 3: Verification

**Files:**
- Test: `e2e/knowledge-export-history.spec.ts`

- [ ] **Step 1: Run targeted graph search test**

Run: `npx playwright test e2e/knowledge-export-history.spec.ts -g "图谱搜索"`

- [ ] **Step 2: Run full checks**

Run:

```bash
npm run typecheck
npx playwright test
npm run build
git diff --check
```
