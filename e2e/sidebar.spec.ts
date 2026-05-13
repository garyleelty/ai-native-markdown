import { test, expect } from '@playwright/test'

test.describe('侧边栏收拢功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420/')
    await page.waitForLoadState('networkidle')
  })

  test('桌面端侧边栏默认展开', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(300)

    const sidebarPanel = page.locator('.sidebar-panel')
    await expect(sidebarPanel).not.toHaveClass(/collapsed/)
    
    const width = await sidebarPanel.evaluate(el => el.clientWidth)
    expect(width).toBeGreaterThan(200)
  })

  test('桌面端点击按钮收起侧边栏', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(300)

    const toggleBtn = page.locator('.toolbar-btn[title="侧边栏"]')
    await expect(toggleBtn).toBeVisible()

    // 点击收起
    await toggleBtn.click()
    await page.waitForTimeout(400)

    const sidebarPanel = page.locator('.sidebar-panel')
    await expect(sidebarPanel).toHaveClass(/collapsed/)
    
    const width = await sidebarPanel.evaluate(el => el.clientWidth)
    expect(width).toBe(0)
  })

  test('桌面端点击按钮展开侧边栏', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(300)

    const toggleBtn = page.locator('.toolbar-btn[title="侧边栏"]')
    
    // 先收起
    await toggleBtn.click()
    await page.waitForTimeout(400)

    // 再展开
    await toggleBtn.click()
    await page.waitForTimeout(400)

    const sidebarPanel = page.locator('.sidebar-panel')
    await expect(sidebarPanel).not.toHaveClass(/collapsed/)
    
    const width = await sidebarPanel.evaluate(el => el.clientWidth)
    expect(width).toBeGreaterThan(200)
  })

  test('移动端显示汉堡菜单按钮', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(300)

    const mobileMenuBtn = page.locator('.mobile-menu-btn')
    await expect(mobileMenuBtn).toBeVisible()

    const desktopToggleBtn = page.locator('.toolbar-btn[title="侧边栏"]')
    await expect(desktopToggleBtn).not.toBeVisible()
  })

  test('移动端点击汉堡菜单打开侧边栏', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(300)

    const mobileMenuBtn = page.locator('.mobile-menu-btn')
    await mobileMenuBtn.click()
    await page.waitForTimeout(400)

    const sidebarPanel = page.locator('.sidebar-panel')
    await expect(sidebarPanel).toHaveClass(/mobile-open/)
  })

  test('移动端点击遮罩层关闭侧边栏', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(300)

    // 先打开
    await page.locator('.mobile-menu-btn').click()
    await page.waitForTimeout(400)

    // 点击遮罩层
    const overlay = page.locator('.mobile-overlay')
    await expect(overlay).toBeVisible()
    await overlay.click()
    await page.waitForTimeout(400)

    const sidebarPanel = page.locator('.sidebar-panel')
    await expect(sidebarPanel).not.toHaveClass(/mobile-open/)
  })

  test('平板端侧边栏为抽屉模式', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(300)

    const sidebarPanel = page.locator('.sidebar-panel')
    await expect(sidebarPanel).toHaveClass(/mobile-drawer/)

    const mobileMenuBtn = page.locator('.mobile-menu-btn')
    await expect(mobileMenuBtn).toBeVisible()
  })

  test('侧边栏收起时编辑器区域正常显示', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(300)

    // 收起侧边栏
    await page.locator('.toolbar-btn[title="侧边栏"]').click()
    await page.waitForTimeout(400)

    const editorMain = page.locator('.editor-container-main')
    const editorWidth = await editorMain.evaluate(el => el.clientWidth)
    expect(editorWidth).toBeGreaterThan(800)

    // 检查没有元素重叠
    const sidebarPanel = page.locator('.sidebar-panel')
    const sidebarWidth = await sidebarPanel.evaluate(el => el.clientWidth)
    expect(sidebarWidth).toBe(0)
  })

  test('响应式断点切换正常', async ({ page }) => {
    // 桌面端
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.waitForTimeout(300)
    
    let sidebarPanel = page.locator('.sidebar-panel')
    await expect(sidebarPanel).not.toHaveClass(/mobile-drawer/)

    // 切换到平板
    await page.setViewportSize({ width: 767, height: 1024 })
    await page.waitForTimeout(300)
    
    sidebarPanel = page.locator('.sidebar-panel')
    await expect(sidebarPanel).toHaveClass(/mobile-drawer/)
  })
})
