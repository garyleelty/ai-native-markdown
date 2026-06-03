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

test.describe('知识整理、导出、模板、版本历史', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page)
  })

  test('模板库可以创建文档并填充模板内容', async ({ page }) => {
    await loadDemoWorkspace(page)
    await runCommand(page, '从模板新建')
    await expect(page.getByRole('dialog', { name: '从模板创建' })).toBeVisible()
    await page.locator('.template-card').filter({ hasText: 'README' }).click()

    await expect(page.locator('.tabs-bar')).toContainText('README.md')
    const content = await readWorkspaceFile(page, '/workspace/README.md')
    expect(content).toContain('# 项目名称')
    expect(content).toContain('## 快速开始')
  })

  test('导出 Markdown、HTML、纯文本会触发对应下载文件', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '# Export Title\n\n**bold** [link](https://example.com)')

    for (const [format, extension] of [['Markdown', '.md'], ['HTML', '.html'], ['纯文本', '.txt']] as const) {
      await page.getByLabel('导出', { exact: true }).click()
      await page.getByRole('menuitem', { name: '导出...' }).click()
      await expect(page.getByRole('dialog', { name: '导出文档' })).toBeVisible()
      await page.locator('.el-radio-button').filter({ hasText: format }).click()
      await page.locator('.el-dialog').filter({ hasText: '导出文档' }).locator('input').last().fill(`playwright-export-${format}`)
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('dialog', { name: '导出文档' }).getByRole('button', { name: '导出' }).click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain(extension)
      await expect(page.getByRole('dialog', { name: '导出文档' })).toHaveCount(0)
    }
  })

  test('版本历史可以恢复已保存快照', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await page.evaluate(async () => {
      const { versionHistory } = await import('/src/services/versionHistory.ts')
      await versionHistory.saveSnapshot('/workspace/README.md', '# Snapshot Content', 'Playwright 快照')
    })

    await setEditorContent(page, '# Current Content')
    await page.getByRole('button', { name: '版本历史' }).click()
    await expect(page.getByText('Playwright 快照')).toBeVisible()
    await page.locator('.history-card').filter({ hasText: 'Playwright 快照' }).click()
    await page.getByRole('button', { name: '恢复此版本' }).click()
    await expect(page.locator('.cm-content')).toContainText('Snapshot Content')
  })

  test('知识面板展示 Frontmatter、标签、反链、未链接提及和图谱统计', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/Alpha.md', [
      '---',
      'title: Alpha Note',
      'aliases: [Alpha Alias]',
      'tags: [project, test]',
      '---',
      '',
      '# Alpha Note',
      'Links to [[Beta Note]].',
    ].join('\n'))
    await createWorkspaceFile(page, '/workspace/Beta.md', [
      '---',
      'title: Beta Note',
      '---',
      '',
      '# Beta Note',
      'Alpha Alias appears here without a wiki link.',
    ].join('\n'))
    await loadDemoWorkspace(page)
    await page.locator('.tree-node-label').filter({ hasText: 'Alpha.md' }).click()
    await expect(page.locator('.tabs-bar')).toContainText('Alpha.md')

    await page.getByRole('menuitem', { name: '知识图谱' }).click()
    await page.getByRole('button', { name: '刷新知识索引' }).click()
    await expect(page.locator('.note-title')).toHaveText('Alpha Note')
    await expect(page.locator('.property-row').filter({ hasText: 'title' })).toContainText('Alpha Note')
    await expect(page.locator('.tag-list')).toContainText('#project')
    await expect(page.locator('.link-chip')).toContainText('[[Beta Note]]')

    await page.getByRole('tab', { name: /提及/ }).click()
    await expect(page.locator('.reference-item').filter({ hasText: 'Beta Note' })).toBeVisible()

    await page.getByRole('tab', { name: '图谱' }).click()
    await expect(page.locator('.graph-stats')).toContainText('节点:')
    await expect(page.locator('.graph-stats')).toContainText('链接:')
  })

  test('知识索引随本地工作区写入更新', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/StaleSource.md', '# Stale Source\n\n[[Stale Target]]')
    await createWorkspaceFile(page, '/workspace/StaleTarget.md', '# Stale Target')
    await loadDemoWorkspace(page)
    await page.locator('.el-tree-node').filter({ hasText: 'StaleTarget.md' }).click()
    await page.getByRole('menuitem', { name: '知识图谱' }).click()
    await page.getByRole('button', { name: '刷新知识索引' }).click()
    await page.getByRole('tab', { name: /反链/ }).click()
    await expect(page.locator('.reference-item').filter({ hasText: 'Stale Source' })).toBeVisible()
  })

  test('窄屏下导出弹窗、模板弹窗和 AI 面板不产生横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 740 })
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)

    await page.getByRole('button', { name: 'AI 助手' }).click()
    await expect(page.locator('.ai-panel-section')).toBeVisible()
    await page.getByRole('button', { name: '导出' }).click()
    await page.getByRole('menuitem', { name: '导出...' }).click()
    await expect(page.getByRole('dialog', { name: '导出文档' })).toBeVisible()
    await page.keyboard.press('Escape')

    await runCommand(page, '从模板新建')
    await expect(page.getByRole('dialog', { name: '从模板创建' })).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('模板创建后的内容可以保存到工作区', async ({ page }) => {
    await loadDemoWorkspace(page)
    await runCommand(page, '从模板新建')
    await page.locator('.template-card').filter({ hasText: '博客文章' }).click()
    await page.keyboard.press('Control+S')
    await expect(page.locator('.save-status')).toContainText('保存成功')

    const content = await readWorkspaceFile(page, '/workspace/博客文章.md')
    expect(content).toContain('一句话描述')
  })
})
