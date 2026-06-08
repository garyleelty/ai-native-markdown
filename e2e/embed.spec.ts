import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'fs/promises'
import {
  createWorkspaceFile,
  loadDemoWorkspace,
  readWorkspaceFile,
  resetBrowserState,
  runCommand,
  setEditorContent,
} from './helpers'

const EMBED_SOURCE = [
  '# Embed Source',
  '',
  'Visible full-note body.',
  '',
  '## Section One',
  '',
  'Visible section body.',
  '',
  '## Section Two',
  '',
  'Hidden sibling body.',
  '',
  'Block paragraph opening',
  'Block paragraph body. ^source-block',
  '',
  'After block paragraph.',
].join('\n')

async function setEditorMarkdown(page: Page, content: string) {
  const livePreviewButton = page.getByRole('button', { name: '实时预览' })
  const wasLivePreviewOn = await livePreviewButton.evaluate(el => el.classList.contains('el-button--primary'))
  if (wasLivePreviewOn) await livePreviewButton.click()
  await setEditorContent(page, content)
  if (wasLivePreviewOn) await livePreviewButton.click()
}

test.describe('block embeds', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page)
    await createWorkspaceFile(page, '/workspace/Embed Source.md', EMBED_SOURCE)
    await createWorkspaceFile(page, '/workspace/Embed Host.md', '# Embed Host')
    await loadDemoWorkspace(page)
    await page.getByRole('treeitem', { name: 'Embed Host.md' }).click()
    await expect(page.locator('.cm-content')).toContainText('Embed Host')
  })

  test('preview renders an embedded note', async ({ page }) => {
    await setEditorMarkdown(page, '![[Embed Source]]')
    await runCommand(page, '分屏模式')

    const embed = page.locator('.preview-content .embed-note').first()
    await expect(embed).toBeVisible()
    await expect(embed).toContainText('Embed Source')
    await expect(embed).toContainText('Visible full-note body.')
  })

  test('live preview renders an embedded note inside the editor', async ({ page }) => {
    await setEditorMarkdown(page, '![[Embed Source#Section One]]')

    const embed = page.locator('.cm-live-preview-embed-note').first()
    await expect(embed).toBeVisible()
    await expect(embed).toContainText('Visible section body.')
    await expect(embed).not.toContainText('Hidden sibling body.')
  })

  test('preview renders only the requested embedded heading section', async ({ page }) => {
    await setEditorMarkdown(page, '![[Embed Source#Section One]]')
    await runCommand(page, '分屏模式')

    const embed = page.locator('.preview-content .embed-note').first()
    await expect(embed).toContainText('Visible section body.')
    await expect(embed).not.toContainText('Hidden sibling body.')
  })

  test('preview renders only the requested block id', async ({ page }) => {
    await setEditorMarkdown(page, '![[Embed Source#^source-block]]')
    await runCommand(page, '分屏模式')

    const embed = page.locator('.preview-content .embed-note').first()
    const embedContent = embed.locator('.embed-content')
    await expect(embedContent).toContainText('Block paragraph opening')
    await expect(embedContent).toContainText('Block paragraph body.')
    await expect(embedContent).not.toContainText('After block paragraph.')
    await expect(embedContent).not.toContainText('^source-block')
  })

  test('preview can embed a section from the current file', async ({ page }) => {
    await setEditorMarkdown(page, [
      '# Embed Host',
      '',
      '![[#Reusable Section]]',
      '',
      '## Reusable Section',
      '',
      'Current file reusable body.',
    ].join('\n'))
    await runCommand(page, '分屏模式')

    const embed = page.locator('.preview-content .embed-note').first()
    await expect(embed).toContainText('Current file reusable body.')
  })

  test('live preview can embed a section from the current unsaved file', async ({ page }) => {
    await setEditorMarkdown(page, [
      '# Embed Host',
      '',
      '![[#Reusable Section]]',
      '',
      '## Reusable Section',
      '',
      'Current editor-only section body.',
    ].join('\n'))

    const embed = page.locator('.cm-live-preview-embed-note').first()
    await expect(embed).toContainText('Current editor-only section body.')
  })

  test('preview shows a visible missing state for unresolved embeds', async ({ page }) => {
    await setEditorMarkdown(page, '![[Missing Embed Target]]')
    await runCommand(page, '分屏模式')

    const missing = page.locator('.preview-content .embed-not-found').first()
    await expect(missing).toBeVisible()
    await expect(missing).toContainText('未找到嵌入目标')
  })

  test('live preview embed source button opens the source note and heading', async ({ page }) => {
    await setEditorMarkdown(page, '![[Embed Source#Section One]]')
    await page.keyboard.press('Control+S')

    const sourceButton = page.locator('.cm-live-preview-embed-source').first()
    await expect(sourceButton).toBeVisible()
    await sourceButton.click()

    await expect(page.locator('.tabs-bar')).toContainText('Embed Source.md')
    await expect(page.locator('.cm-content')).toContainText('Visible section body.')
    await expect(page.locator('.status-bar')).toContainText('行 5')
  })

  test('live preview embed source button opens the source note and block id', async ({ page }) => {
    await setEditorMarkdown(page, '![[Embed Source#^source-block]]')
    await page.keyboard.press('Control+S')

    const sourceButton = page.locator('.cm-live-preview-embed-source').first()
    await expect(sourceButton).toBeVisible()
    await expect(page.locator('.cm-live-preview-embed-note').first()).toContainText('Block paragraph body.')
    await sourceButton.click()

    await expect(page.locator('.tabs-bar')).toContainText('Embed Source.md')
    await expect(page.locator('.cm-content')).toContainText('Block paragraph body.')
    await expect(page.locator('.status-bar')).toContainText('行 13')
  })

  test('HTML export inlines resolved embed content', async ({ page }) => {
    await setEditorMarkdown(page, '# Export With Embed\n\n![[Embed Source#Section One]]')

    await page.getByLabel('导出', { exact: true }).click()
    await page.getByRole('menuitem', { name: '导出...' }).click()
    await expect(page.getByRole('dialog', { name: '导出文档' })).toBeVisible()
    await page.locator('.el-radio-button').filter({ hasText: 'HTML' }).click()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('dialog', { name: '导出文档' }).getByRole('button', { name: '导出' }).click()
    const download = await downloadPromise
    const downloadedPath = await download.path()
    expect(downloadedPath).toBeTruthy()
    const html = await readFile(downloadedPath!, 'utf8')

    expect(html).toContain('Export With Embed')
    expect(html).toContain('Visible section body.')
    expect(html).not.toContain('Hidden sibling body.')
    expect(html).not.toContain('![[Embed Source')
  })

  test('wiki completion can insert an embed target with ![[ prefix', async ({ page }) => {
    await setEditorMarkdown(page, 'Embed ')

    await page.keyboard.insertText('![[Sour')
    await expect(page.locator('.wiki-link-completion')).toBeVisible()
    await expect(page.locator('.wiki-link-completion')).toContainText('Embed Source')

    await page.keyboard.press('Enter')
    await expect(page.locator('.cm-content')).toContainText('Embed ![[Embed Source]]')
    await page.keyboard.press('Control+S')
    await expect.poll(() => readWorkspaceFile(page, '/workspace/Embed Host.md')).toContain('![[Embed Source]]')
  })

  test('wiki completion can insert a current-file heading embed', async ({ page }) => {
    await setEditorMarkdown(page, '# Embed Host\n\n## Local Section\n\nEmbed ')

    await page.keyboard.insertText('![[#Loc')
    await expect(page.locator('.wiki-link-completion')).toBeVisible()
    await expect(page.locator('.wiki-link-completion')).toContainText('Local Section')

    await page.keyboard.press('Enter')
    await expect(page.locator('.cm-content')).toContainText('Embed ![[#Local Section]]')
  })

  test('wiki completion can insert a cross-document block embed', async ({ page }) => {
    await setEditorMarkdown(page, 'Embed ')

    await page.keyboard.insertText('![[Embed Source#^sou')
    await expect(page.locator('.wiki-link-completion')).toBeVisible()
    await expect(page.locator('.wiki-link-completion')).toContainText('^source-block')

    await page.keyboard.press('Enter')
    await expect(page.locator('.cm-content')).toContainText('Embed ![[Embed Source#^source-block]]')
  })

  test('wiki completion can insert a current-file block embed', async ({ page }) => {
    await setEditorMarkdown(page, [
      '# Embed Host',
      '',
      'Reusable current block. ^local-block',
      '',
      'Embed ',
    ].join('\n'))

    await page.keyboard.insertText('![[#^loc')
    await expect(page.locator('.wiki-link-completion')).toBeVisible()
    await expect(page.locator('.wiki-link-completion')).toContainText('^local-block')

    await page.keyboard.press('Enter')
    await expect(page.locator('.cm-content')).toContainText('Embed ![[#^local-block]]')
  })
})
