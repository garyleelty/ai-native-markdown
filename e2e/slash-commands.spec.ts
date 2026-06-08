import { expect, test } from '@playwright/test'
import {
  loadDemoWorkspace,
  openFirstMarkdownFile,
  resetBrowserState,
  setEditorContent,
} from './helpers'

test.describe('Slash 命令菜单', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page)
  })

  test('输入 / 后显示 Slash 命令菜单', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '')

    await page.locator('.cm-editor').click()
    await page.keyboard.type('/')

    await expect(page.locator('.slash-command-menu')).toBeVisible()
    await expect(page.locator('.slash-command-item').first()).toBeVisible()
  })

  test('输入 /heading 后只显示标题相关命令', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '')

    await page.locator('.cm-editor').click()
    await page.keyboard.type('/heading')

    await expect(page.locator('.slash-command-menu')).toBeVisible()
    const items = page.locator('.slash-command-item')
    const count = await items.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      await expect(items.nth(i)).toContainText('标题')
    }
  })

  test('输入 /h1 后按 Enter 插入一级标题', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '')

    await page.locator('.cm-editor').click()
    await page.keyboard.type('/h1')
    await expect(page.locator('.slash-command-menu')).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(page.locator('.slash-command-menu')).toHaveCount(0)

    await expect(page.locator('.cm-content')).toContainText('# ')
  })

  test('输入 /date 后按 Enter 插入当前日期', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '')

    const now = new Date()
    const today = now.toISOString().split('T')[0]

    await page.locator('.cm-editor').click()
    await page.keyboard.type('/date')
    await expect(page.locator('.slash-command-menu')).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(page.locator('.slash-command-menu')).toHaveCount(0)

    await expect(page.locator('.cm-content')).toContainText(today)
  })

  test('按 Escape 关闭 Slash 命令菜单', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '')

    await page.locator('.cm-editor').click()
    await page.keyboard.type('/')
    await expect(page.locator('.slash-command-menu')).toBeVisible()

    // Debug: check if Escape reaches the editor at all
    const allConsoleLogs: string[] = []
    page.on('console', msg => allConsoleLogs.push(msg.text()))

    // Try Escape via JavaScript directly
    await page.evaluate(() => {
      const editor = document.querySelector('.cm-editor')
      if (editor) {
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        editor.dispatchEvent(event)
      }
    })
    await page.waitForTimeout(500)
    console.log('All console logs after JS Escape:', allConsoleLogs.filter(l => l.includes('slash')))

    // If JS dispatch didn't work either, the handler isn't attached properly
    // Try Playwright's keyboard
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    console.log('All console logs after PW Escape:', allConsoleLogs.filter(l => l.includes('slash')))

    await expect(page.locator('.slash-command-menu')).toHaveCount(0)
  })
})
