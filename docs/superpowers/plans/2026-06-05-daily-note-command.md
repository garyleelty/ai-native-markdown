# Daily Note Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a command palette action that creates or opens today’s daily note.

**Architecture:** Add a command item to `CommandPalette.vue`; implement the workflow in `App.vue` using existing `fileSystem` methods and existing `handleFileSelect`/sidebar refresh paths.

**Tech Stack:** Vue 3, TypeScript, Element Plus, Playwright.

---

### Task 1: Add Failing Playwright Coverage

**Files:**
- Modify: `e2e/file-and-editor.spec.ts`

- [ ] **Step 1: Add daily note command test**

Add a test near command/editor workflow tests:

```ts
test('命令面板可以创建并打开今日笔记', async ({ page }) => {
  await loadDemoWorkspace(page)
  const today = new Date().toLocaleDateString('en-CA')

  await runCommand(page, '今日笔记')

  await expect(page.locator('.tabs-bar')).toContainText(`${today}.md`)
  await expect(page.locator('.cm-content')).toContainText(`# ${today}`)

  const content = await readWorkspaceFile(page, `/workspace/Daily/${today}.md`)
  expect(content).toContain(`date: ${today}`)
  expect(content).toContain('tags: [daily]')
  expect(content).toContain('## 今日重点')
  expect(content).toContain('## 记录')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/file-and-editor.spec.ts -g "今日笔记"`

Expected: FAIL because the command does not exist yet.

### Task 2: Implement Command

**Files:**
- Modify: `src/components/CommandPalette.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Add command palette item**

Add `{ id: 'file.daily-note', label: '今日笔记', icon: Calendar, category: '文件' }`.

- [ ] **Step 2: Implement daily note helpers**

In `App.vue`, add local date formatting, daily note template creation, `/workspace/Daily` directory ensure logic, and open/create flow.

- [ ] **Step 3: Wire command execution**

Map `file.daily-note` to `void handleOpenDailyNote()`.

### Task 3: Verify

**Files:**
- Test: `e2e/file-and-editor.spec.ts`
- Test: all project checks

- [ ] **Step 1: Run targeted command test**

Run: `npx playwright test e2e/file-and-editor.spec.ts -g "今日笔记"`

Expected: test passes.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run typecheck
npx playwright test
npm run build
git diff --check
```

Expected: all commands pass.

