# Graph Current Note Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a current-note local graph mode that shows the active note and its one-hop neighbors.

**Architecture:** Keep graph filtering inside `KnowledgeGraph.vue` as a derived `KnowledgeGraphData`. Pass `currentFile` from `KnowledgePanel.vue`; leave `knowledgeIndex` and `useKnowledgeGraph` data contracts unchanged.

**Tech Stack:** Vue 3, TypeScript, D3, Element Plus, Playwright.

---

### Task 1: Add Failing Playwright Coverage

**Files:**
- Modify: `e2e/knowledge-export-history.spec.ts`

- [ ] **Step 1: Add local graph mode test**

Add a test near the existing graph search test:

```ts
test('知识图谱当前笔记模式只展示一跳邻域并限制搜索范围', async ({ page }) => {
  await createWorkspaceFile(page, '/workspace/Graph Focus Alpha.md', '# Graph Focus Alpha\n\n[[Graph Focus Beta]]')
  await createWorkspaceFile(page, '/workspace/Graph Focus Beta.md', '# Graph Focus Beta')
  await createWorkspaceFile(page, '/workspace/Graph Focus Isolated.md', '# Graph Focus Isolated')
  await loadDemoWorkspace(page)
  await page.locator('.tree-node-label').filter({ hasText: 'Graph Focus Alpha.md' }).click()
  await page.getByRole('menuitem', { name: '知识图谱' }).click()
  await page.getByRole('button', { name: '刷新知识索引' }).click()
  await page.getByRole('tab', { name: '图谱' }).click()

  await page.getByRole('button', { name: '当前笔记图谱' }).click()
  await expect(page.locator('.graph-focus-summary')).toContainText('Graph Focus Alpha')
  await expect(page.locator('.graph-focus-summary')).toContainText('1 个邻居')
  await expect(page.locator('.graph-stats')).toContainText('节点: 2')
  await expect(page.locator('.graph-stats')).toContainText('链接: 1')

  await page.getByPlaceholder('搜索笔记...').fill('Isolated')
  await expect(page.locator('.graph-search-empty')).toContainText('没有匹配笔记')

  await page.getByRole('button', { name: '全局图谱' }).click()
  await expect(page.getByRole('button', { name: /打开图谱节点 Graph Focus Isolated/ })).toBeVisible()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/knowledge-export-history.spec.ts -g "当前笔记模式"`

Expected: FAIL because the segmented graph mode controls do not exist yet.

### Task 2: Implement Local Graph Mode

**Files:**
- Modify: `src/components/sidebar/KnowledgePanel.vue`
- Modify: `src/components/knowledge/KnowledgeGraph.vue`

- [ ] **Step 1: Pass current file into graph**

In `KnowledgePanel.vue`, pass `:current-file="currentFile"` to `KnowledgeGraph`.

- [ ] **Step 2: Add local graph state and derived data**

In `KnowledgeGraph.vue`, add `currentFile?: string`, `graphMode`, endpoint helpers, local node filtering, and stat recomputation.

- [ ] **Step 3: Add segmented controls and empty state**

Add accessible buttons with labels `全局图谱` and `当前笔记图谱`, render a focus summary in current mode, and show an empty state when no current graph can be rendered.

- [ ] **Step 4: Rebuild D3 from visible data**

Call `initGraph(visibleGraphData)` instead of full graph data, and watch the derived data plus mode/current file.

### Task 3: Verify

**Files:**
- Test: `e2e/knowledge-export-history.spec.ts`
- Test: all project checks

- [ ] **Step 1: Run target graph tests**

Run: `npx playwright test e2e/knowledge-export-history.spec.ts -g "图谱"`

Expected: graph tests pass.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run typecheck
npx playwright test
npm run build
git diff --check
```

Expected: all commands pass.

