import { test, expect } from '@playwright/test'

test.describe('侧边栏行为', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('桌面端默认显示侧边栏', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    const sidebarAside = page.locator('.sidebar-aside')
    await expect(sidebarAside).toBeVisible()
    await expect(page.locator('.sidebar')).toBeVisible()

    const box = await sidebarAside.boundingBox()
    expect(box?.width).toBeGreaterThan(200)
  })

  test('点击切换按钮可以隐藏和恢复侧边栏', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    const toggleButton = page.getByRole('button', { name: '切换侧边栏' })
    const sidebarAside = page.locator('.sidebar-aside')

    await toggleButton.click()
    await expect(page.locator('.sidebar')).toHaveCount(0)
    const collapsedBox = await sidebarAside.boundingBox()
    expect(collapsedBox?.width).toBeLessThanOrEqual(1)

    await toggleButton.click()
    await expect(page.locator('.sidebar')).toBeVisible()
    const box = await sidebarAside.boundingBox()
    expect(box?.width).toBeGreaterThan(200)
  })

  test('侧边栏隐藏后编辑器区域扩展', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    const editorMain = page.locator('.editor-container-main')
    const before = await editorMain.boundingBox()

    await page.getByRole('button', { name: '切换侧边栏' }).click()
    const after = await editorMain.boundingBox()

    expect(after?.width).toBeGreaterThan(before?.width ?? 0)
  })

  test('侧边栏导航可以切换到知识、AI、设置和大纲', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.getByRole('menuitem', { name: '知识图谱' }).click()
    await expect(page.locator('.panel-title')).toHaveText('知识')

    await page.getByRole('menuitem', { name: 'AI 配置' }).click()
    await expect(page.locator('.panel-title')).toContainText('AI')

    await page.getByRole('menuitem', { name: '设置' }).click()
    await expect(page.locator('.panel-title')).toContainText('设置')

    await page.getByRole('menuitem', { name: '文档大纲' }).click()
    await expect(page.locator('.panel-title')).toContainText('大纲')
  })

  test('窄屏下页面不产生横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(300)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
