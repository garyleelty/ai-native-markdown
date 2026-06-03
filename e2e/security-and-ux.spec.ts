import { test, expect } from '@playwright/test'

test.describe('安全修复验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420/')
    await page.waitForLoadState('networkidle')
  })

  test('CSP meta标签存在', async ({ page }) => {
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
  })

  test('XSS payload在预览中被转义', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(500)

    const welcomeBtn = page.locator('button:has-text("试用示例工作区")')
    await welcomeBtn.click()
    await page.waitForTimeout(1000)

    const firstMd = page.locator('.el-tree-node').filter({ hasText: '.md' }).first()
    await firstMd.click()
    await page.waitForTimeout(500)

    const editor = page.locator('.cm-content')
    await editor.click()
    await editor.fill('<script>alert("xss")</script>\n\n<img src=x onerror=alert(1)>')
    await page.waitForTimeout(1000)

    const preview = page.locator('.preview-content')
    const html = await preview.innerHTML()
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img')
  })

  test('aria-label存在于图标按钮', async ({ page }) => {
    const buttons = page.locator('button[aria-label]')
    const count = await buttons.count()
    expect(count).toBeGreaterThanOrEqual(5)

    const labels = await buttons.all()
    for (const btn of labels) {
      const label = await btn.getAttribute('aria-label')
      expect(label).toBeTruthy()
      expect(label!.length).toBeGreaterThan(0)
    }
  })
})

test.describe('性能优化验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420/')
    await page.waitForLoadState('networkidle')
  })

  test('初始加载不包含mermaid chunk', async ({ page }) => {
    const requests: string[] = []
    page.on('request', req => {
      const url = req.url()
      if (url.includes('.js')) requests.push(url)
    })

    await page.goto('http://localhost:1420/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const mermaidLoaded = requests.some(url => url.includes('mermaid'))
    expect(mermaidLoaded).toBe(false)
  })
})

test.describe('UX修复验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420/')
    await page.waitForLoadState('networkidle')
  })

  test('标签页状态持久化到localStorage', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(500)

    const welcomeBtn = page.locator('button:has-text("试用示例工作区")')
    await welcomeBtn.click()
    await page.waitForTimeout(1000)

    const firstMd = page.locator('.el-tree-node').filter({ hasText: '.md' }).first()
    await firstMd.click()
    await page.waitForTimeout(500)

    const tabState = await page.evaluate(() => localStorage.getItem('editor_tab_state'))
    expect(tabState).toBeTruthy()
    const parsed = JSON.parse(tabState!)
    expect(parsed).toHaveProperty('tabs')
    expect(parsed).toHaveProperty('activeTabId')
    expect(parsed).toHaveProperty('viewMode')
  })

  test('AI对话历史持久化', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(500)

    const aiBtn = page.locator('button[aria-label="AI 助手"]')
    await aiBtn.click()
    await page.waitForTimeout(500)

    const input = page.locator('.chat-input-area textarea')
    await input.fill('Hello test')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)

    const chatHistory = await page.evaluate(() => localStorage.getItem('ai_chat_history'))
    expect(chatHistory).toBeTruthy()
    const parsed = JSON.parse(chatHistory!)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThanOrEqual(1)
  })

  test('未保存更改警告 - 关闭标签页时提示', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(500)

    const welcomeBtn = page.locator('button:has-text("试用示例工作区")')
    await welcomeBtn.click()
    await page.waitForTimeout(1000)

    const firstMd = page.locator('.el-tree-node').filter({ hasText: '.md' }).first()
    await firstMd.click()
    await page.waitForTimeout(500)

    const editor = page.locator('.cm-content')
    await editor.click()
    await editor.type(' some new content')
    await page.waitForTimeout(500)

    const closeTab = page.locator('.el-tabs__nav-wrap .is-icon-close').first()
    if (await closeTab.isVisible()) {
      page.once('dialog', async dialog => {
        expect(dialog.message()).toContain('未保存')
        await dialog.dismiss()
      })
      await closeTab.click()
    }
  })
})

test.describe('功能完整性验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420/')
    await page.waitForLoadState('networkidle')
  })

  test('应用正常加载', async ({ page }) => {
    await expect(page.locator('.app-container')).toBeVisible()
    await expect(page.locator('.app-header')).toBeVisible()
  })

  test('试用示例工作区功能正常', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(500)

    const welcomeBtn = page.locator('button:has-text("试用示例工作区")')
    await expect(welcomeBtn).toBeVisible()
    await welcomeBtn.click()
    await page.waitForTimeout(1000)

    const tree = page.locator('.el-tree')
    await expect(tree).toBeVisible()
  })

  test('重命名到已存在路径会失败且不会产生重复文件记录', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { fileSystem } = await import('/src/services/fileSystem.ts')
      await fileSystem.init()
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const sourcePath = `/workspace/collision-${suffix}-a.md`
      const targetPath = `/workspace/collision-${suffix}-b.md`
      await fileSystem.createFile(sourcePath)
      await fileSystem.createFile(targetPath)
      let error = ''
      try {
        await fileSystem.renameFile(sourcePath, targetPath)
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }
      const files = await fileSystem.readDirectory('/workspace')
      return {
        error,
        paths: files.map(file => file.path).sort(),
        sourcePath,
        targetPath,
        targetCount: files.filter(file => file.path === targetPath).length,
      }
    })

    expect(result.error).toContain('路径已存在')
    expect(result.paths).toContain(result.sourcePath)
    expect(result.paths).toContain(result.targetPath)
    expect(result.targetCount).toBe(1)
  })

  test('编辑器加载和输入正常', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(500)

    const welcomeBtn = page.locator('button:has-text("试用示例工作区")')
    await welcomeBtn.click()
    await page.waitForTimeout(1000)

    const firstMd = page.locator('.el-tree-node').filter({ hasText: '.md' }).first()
    await firstMd.click()
    await page.waitForTimeout(500)

    const editor = page.locator('.cm-content')
    await editor.click()
    await editor.type('# Hello World\n\nThis is a test.')
    await page.waitForTimeout(500)

    const content = await editor.textContent()
    expect(content).toContain('Hello World')
  })

  test('预览面板渲染正常', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(500)

    const welcomeBtn = page.locator('button:has-text("试用示例工作区")')
    await welcomeBtn.click()
    await page.waitForTimeout(1000)

    const firstMd = page.locator('.el-tree-node').filter({ hasText: '.md' }).first()
    await firstMd.click()
    await page.waitForTimeout(500)

    const editor = page.locator('.cm-content')
    await editor.click()
    await editor.type('# Test Heading\n\n**Bold text** and *italic text*')
    await page.waitForTimeout(1000)

    const preview = page.locator('.preview-content')
    await expect(preview).toBeVisible()
    const html = await preview.innerHTML()
    expect(html).toContain('<h1')
    expect(html).toContain('<strong>')
    expect(html).toContain('<em>')
  })

  test('命令面板可打开', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(500)

    await page.keyboard.press('Control+Shift+P')
    await page.waitForTimeout(500)

    const palette = page.locator('.command-palette')
    await expect(palette).toBeVisible()
  })

  test('专注模式可切换', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(500)

    const focusBtn = page.locator('button[aria-label="专注模式"]')
    await expect(focusBtn).toBeVisible()
    await focusBtn.click()
    await page.waitForTimeout(500)

    const app = page.locator('.app-container')
    await expect(app).toHaveClass(/focus-mode-active/)
  })
})
