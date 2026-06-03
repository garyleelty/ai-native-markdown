import { expect, test } from '@playwright/test'
import {
  createWorkspaceFile,
  loadDemoWorkspace,
  openFirstMarkdownFile,
  readWorkspaceFile,
  resetBrowserState,
  runCommand,
  setEditorContent,
} from './helpers'

test.describe('文件与编辑器主流程', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page)
  })

  test('可以通过 UI 新建文件和文件夹', async ({ page }) => {
    await loadDemoWorkspace(page)

    await page.getByRole('button', { name: '新建文件', exact: true }).click()
    await page.locator('.el-message-box input').fill('playwright-note.md')
    await page.getByRole('button', { name: '创建' }).click()
    await expect(page.locator('.el-tree-node').filter({ hasText: 'playwright-note.md' })).toBeVisible()
    await expect(page.locator('.tabs-bar')).toContainText('playwright-note.md')

    await page.getByRole('button', { name: '新建文件夹' }).click()
    await page.locator('.el-message-box input').fill('playwright-folder')
    await page.getByRole('button', { name: '创建' }).click()
    await expect(page.locator('.el-tree-node').filter({ hasText: 'playwright-folder' })).toBeVisible()
  })

  test('文件系统服务支持成功重命名和删除文件夹树', async ({ page }) => {
    const suffix = Date.now()
    const originalPath = `/workspace/rename-${suffix}.md`
    const renamedPath = `/workspace/renamed-${suffix}.md`
    const folderPath = `/workspace/delete-folder-${suffix}`
    const nestedPath = `${folderPath}/nested.md`

    const result = await page.evaluate(async ({ originalPath, renamedPath, folderPath, nestedPath }) => {
      const { fileSystem } = await import('/src/services/fileSystem.ts')
      await fileSystem.init()
      await fileSystem.writeFile(originalPath, 'rename target')
      await fileSystem.renameFile(originalPath, renamedPath)
      await fileSystem.createDirectory(folderPath)
      await fileSystem.writeFile(nestedPath, 'nested target')
      await fileSystem.deleteFile(folderPath)
      const rootFiles = await fileSystem.readDirectory('/workspace')
      return {
        renamedContent: await fileSystem.readFile(renamedPath),
        rootPaths: rootFiles.map((file: any) => file.path),
        deletedNestedContent: await fileSystem.readFile(nestedPath),
      }
    }, { originalPath, renamedPath, folderPath, nestedPath })

    expect(result.renamedContent).toBe('rename target')
    expect(result.rootPaths).toContain(renamedPath)
    expect(result.rootPaths).not.toContain(originalPath)
    expect(result.rootPaths).not.toContain(folderPath)
    expect(result.deletedNestedContent).toBe('')
  })

  test('文件名搜索和内容搜索可以定位文档', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/search-target.md', 'needle-content-line\nsecond line')
    await loadDemoWorkspace(page)

    const searchInput = page.getByPlaceholder('搜索文件...')
    await searchInput.fill('search-target')
    await expect(page.locator('.el-tree-node').filter({ hasText: 'search-target.md' })).toBeVisible()

    await page.locator('.search-bar button').click()
    await expect(page.locator('.search-mode-hint')).toHaveText('内容搜索')
    await searchInput.fill('needle-content-line')
    await page.keyboard.press('Enter')
    await expect(page.locator('.search-result-card').filter({ hasText: 'search-target.md' })).toBeVisible()
    await expect(page.locator('.search-result-card').filter({ hasText: 'needle-content-line' })).toBeVisible()
  })

  test('源码、分屏、预览模式可以切换', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '# View Mode\n\npreview target')

    await runCommand(page, '源码模式')
    await expect(page.locator('.cm-content')).toBeVisible()
    await expect(page.locator('.preview-content')).toHaveCount(0)

    await runCommand(page, '分屏模式')
    await expect(page.locator('.cm-content')).toBeVisible()
    await expect(page.locator('.preview-content')).toBeVisible()

    await runCommand(page, '预览模式')
    await expect(page.locator('.cm-content')).toHaveCount(0)
    await expect(page.locator('.preview-content')).toContainText('View Mode')
  })

  test('Markdown 工具栏插入常用语法', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, 'toolbar target')

    await page.getByRole('button', { name: '一级标题' }).click()
    await page.getByRole('button', { name: '加粗' }).click()
    await page.getByRole('button', { name: '链接' }).click()
    await page.getByRole('button', { name: '图片' }).click()
    await page.keyboard.press('Control+S')
    await expect(page.locator('.save-status')).toContainText('保存成功')

    const content = await readWorkspaceFile(page, '/workspace/README.md')
    expect(content).toContain('# ')
    expect(content).toContain('**')
    expect(content).toContain('](')
    expect(content).toContain('![')
  })

  test('查找替换会更新编辑器内容', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/README.md', 'alpha alpha beta')
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)

    await page.keyboard.press('Control+h')
    await expect(page.locator('.find-replace-panel')).toBeVisible()
    await page.getByPlaceholder('查找...').fill('alpha')
    await page.getByPlaceholder('替换为...').fill('gamma')
    await page.getByRole('button', { name: '全部替换' }).click()
    await page.keyboard.press('Control+S')
    await expect(page.locator('.save-status')).toContainText('保存成功')

    const content = await readWorkspaceFile(page, '/workspace/README.md')
    expect(content).toContain('gamma gamma beta')
  })

  test('大纲面板识别标题并可点击导航', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '# First\n\n## Second\n\n### Third\n\nbody')

    await page.getByRole('menuitem', { name: '文档大纲' }).click()
    await expect(page.locator('.outline-item').filter({ hasText: 'First' })).toBeVisible()
    await expect(page.locator('.outline-item').filter({ hasText: 'Second' })).toBeVisible()
    await page.locator('.outline-item').filter({ hasText: 'Third' }).click()
    await expect(page.locator('.outline-item.active')).toContainText('Third')
  })

  test('保存快捷键会写回本地工作区', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '# Saved by Playwright')
    await page.keyboard.press('Control+S')
    await expect(page.locator('.save-status')).toContainText('保存成功')

    const saved = await readWorkspaceFile(page, '/workspace/README.md')
    expect(saved).toContain('Saved by Playwright')
  })
})
