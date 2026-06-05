# Cross-Document Heading Wiki Link Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Wiki Link completion for headings inside another Markdown note.

**Architecture:** Keep completion logic inside `Editor.vue`, pass an async file reader from `App.vue`, and reuse the existing Wiki Link resolver from `src/utils/wikiLinks.ts`. Suggestions remain rendered by the existing completion popup with clearer metadata for cross-document headings.

**Tech Stack:** Vue 3, TypeScript, CodeMirror, Element Plus, Playwright.

---

### Task 1: Add Failing Playwright Coverage

**Files:**
- Modify: `e2e/file-and-editor.spec.ts`

- [ ] **Step 1: Add a cross-document heading completion test**

Add a test near the existing Wiki Link completion tests:

```ts
test('Wiki Link 跨文档标题补全可以插入目标标题片段', async ({ page }) => {
  await createWorkspaceFile(page, '/workspace/Target Note.md', [
    '# Target Note',
    '',
    '## Installation Steps',
    '',
    'details',
  ].join('\n'))
  await createWorkspaceFile(page, '/workspace/cross-heading-source.md', '# Source')
  await loadDemoWorkspace(page)
  await page.getByRole('treeitem', { name: 'cross-heading-source.md' }).click()
  await setEditorContent(page, 'See ')

  await page.keyboard.insertText('[[Target Note#install')
  await expect(page.locator('.wiki-link-completion')).toBeVisible()
  await expect(page.locator('.wiki-link-completion')).toContainText('Installation Steps')
  await expect(page.locator('.wiki-link-completion')).toContainText('Target Note · H2')

  await page.keyboard.press('Enter')
  await expect(page.locator('.cm-content')).toContainText('See [[Target Note#Installation Steps]]')
  await page.keyboard.press('Control+S')
  await expect.poll(() => readWorkspaceFile(page, '/workspace/cross-heading-source.md')).toContain('[[Target Note#Installation Steps]]')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/file-and-editor.spec.ts -g "跨文档标题补全"`

Expected: FAIL because no cross-document heading suggestions are produced.

### Task 2: Implement Cross-Document Heading Completion

**Files:**
- Modify: `src/components/Editor.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Add editor props and query parsing**

Add `currentFile` and `readMarkdownFile` props to `Editor.vue`, import `resolveWikiLinkTarget`, and split completion detection into note/current-heading/cross-heading modes.

- [ ] **Step 2: Read target headings on demand**

When the context is cross-heading mode, resolve the target path with `resolveWikiLinkTarget(queryFile, currentFile, markdownPaths)`, read content using `readMarkdownFile`, parse headings, and ignore stale results.

- [ ] **Step 3: Render cross-heading suggestions**

Produce suggestions with `insertText: "<file target>#<heading title>"` and `meta: "<note title> · H<level>"` so accepting the suggestion preserves the typed file target.

- [ ] **Step 4: Wire App.vue**

Pass `:current-file="editorStore.currentFile"` and `:read-markdown-file="readMarkdownFileForCompletion"` into `<Editor>`. The reader should return active/open tab content for unsaved open tabs and fall back to `fileSystem.readFile(path)`.

### Task 3: Verify

**Files:**
- Test: `e2e/file-and-editor.spec.ts`
- Test: all project checks

- [ ] **Step 1: Run targeted tests**

Run: `npx playwright test e2e/file-and-editor.spec.ts -g "补全"`

Expected: all Wiki Link completion tests pass.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run typecheck
npx playwright test
npm run build
git diff --check
```

Expected: all commands pass.

