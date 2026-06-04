import { test, expect } from '@playwright/test'
import { loadDemoWorkspace, openApp, openFirstMarkdownFile, setEditorContent } from './helpers'

test.describe('安全修复验证', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('CSP meta标签存在', async ({ page }) => {
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
  })

  test('XSS payload在预览中被转义', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '<script>alert("xss")</script>\n\n<img src=x onerror=alert(1)>')

    const preview = page.locator('.preview-content')
    await expect(preview).toContainText('<script>alert')
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

  test('localStorage不可用时应用仍可进入基础工作流', async ({ page }) => {
    await page.addInitScript(() => {
      const fail = () => {
        throw new Error('localStorage unavailable')
      }
      Object.defineProperty(Storage.prototype, 'getItem', { value: fail, configurable: true })
      Object.defineProperty(Storage.prototype, 'setItem', { value: fail, configurable: true })
      Object.defineProperty(Storage.prototype, 'removeItem', { value: fail, configurable: true })
      Object.defineProperty(Storage.prototype, 'clear', { value: fail, configurable: true })
    })

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.app-container')).toBeVisible()
    await page.getByRole('button', { name: '试用示例工作区' }).click()
    await expect(page.locator('.el-tree')).toBeVisible()
  })
})

test.describe('性能优化验证', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('初始加载不包含mermaid chunk', async ({ page }) => {
    const requests: string[] = []
    page.on('request', req => {
      const url = req.url()
      if (url.includes('.js')) requests.push(url)
    })

    await openApp(page)
    await expect(page.locator('.app-container')).toBeVisible()

    const mermaidLoaded = requests.some(url => url.includes('mermaid'))
    expect(mermaidLoaded).toBe(false)
  })
})

test.describe('UX修复验证', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('标签页状态持久化到localStorage', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)

    const tabState = await page.evaluate(() => localStorage.getItem('editor_tab_state'))
    expect(tabState).toBeTruthy()
    const parsed = JSON.parse(tabState!)
    expect(parsed).toHaveProperty('tabs')
    expect(parsed).toHaveProperty('activeTabId')
    expect(parsed).toHaveProperty('viewMode')
  })

  test('刷新页面后活动标签会从本地工作区恢复内容', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '# Reload Persisted\n\ncontent after reload')
    await page.keyboard.press('Control+S')
    await expect(page.locator('.save-status')).toContainText('保存成功')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('.app-container')).toBeVisible()
    await expect(page.locator('.tabs-bar')).toContainText('README.md')
    await expect(page.locator('.cm-content')).toContainText('Reload Persisted')
    await expect(page.locator('.status-bar')).toContainText('已保存')
  })

  test('AI对话历史持久化', async ({ page }) => {
    await page.getByRole('button', { name: 'AI 助手' }).click()

    const input = page.locator('.chat-input-area textarea')
    await input.fill('Hello test')
    await page.keyboard.press('Enter')

    await expect.poll(() => page.evaluate(() => localStorage.getItem('ai_chat_history'))).not.toBeNull()
    const chatHistory = await page.evaluate(() => localStorage.getItem('ai_chat_history'))
    expect(chatHistory).toBeTruthy()
    const parsed = JSON.parse(chatHistory!)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThanOrEqual(1)
  })

  test('未保存更改警告 - 关闭标签页时提示', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '# Unsaved Content')

    await page.locator('.el-tabs__nav-wrap .is-icon-close').first().click()
    const dialog = page.getByRole('dialog', { name: '关闭确认' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.locator('.tabs-bar')).toContainText('README.md')
  })
})

test.describe('功能完整性验证', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('应用正常加载', async ({ page }) => {
    await expect(page.locator('.app-container')).toBeVisible()
    await expect(page.locator('.app-header')).toBeVisible()
  })

  test('试用示例工作区功能正常', async ({ page }) => {
    await loadDemoWorkspace(page)
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
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '# Hello World\n\nThis is a test.')

    const editor = page.locator('.cm-content')
    const content = await editor.textContent()
    expect(content).toContain('Hello World')
  })

  test('预览面板渲染正常', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '# Test Heading\n\n**Bold text** and *italic text*')

    const preview = page.locator('.preview-content')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText('Test Heading')
    const html = await preview.innerHTML()
    expect(html).toContain('<h1')
    expect(html).toContain('<strong>')
    expect(html).toContain('<em>')
  })

  test('命令面板可通过欢迎页提示的快捷键打开', async ({ page }) => {
    await page.locator('.app-container').click({ position: { x: 20, y: 20 } })
    await page.keyboard.press('Control+P')

    const palette = page.locator('.command-palette')
    await expect(palette).toBeVisible()
  })

  test('专注模式可切换', async ({ page }) => {
    const focusBtn = page.getByRole('button', { name: '专注模式' })
    await expect(focusBtn).toBeVisible()
    await focusBtn.click()

    const app = page.locator('.app-container')
    await expect(app).toHaveClass(/focus-mode-active/)
  })
})
