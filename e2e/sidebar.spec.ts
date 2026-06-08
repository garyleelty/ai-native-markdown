import { test, expect } from '@playwright/test'
import { createWorkspaceFile, loadDemoWorkspace, runCommand } from './helpers'

test.describe('侧边栏行为', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.app-container')).toBeVisible()
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

  test('刷新页面后会恢复上次打开的侧边栏面板', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.getByRole('menuitem', { name: '知识图谱' }).click()
    await expect(page.locator('.panel-title')).toHaveText('知识')
    await page.reload()
    await expect(page.locator('.app-container')).toBeVisible()

    await expect(page.locator('.panel-title')).toHaveText('知识')
    await expect(page.getByRole('menuitem', { name: '知识图谱' })).toHaveClass(/is-active/)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('active_sidebar_tab'))).toBe('"graph"')
  })

  test('刷新页面后会恢复侧边栏和 AI 面板可见性', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.getByRole('button', { name: '切换侧边栏' }).click()
    await expect(page.locator('.sidebar')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('show_sidebar'))).toBe('false')

    await page.reload()
    await expect(page.locator('.app-container')).toBeVisible()
    await expect(page.locator('.sidebar')).toHaveCount(0)

    await page.getByRole('button', { name: '切换侧边栏' }).click()
    await expect(page.locator('.sidebar')).toBeVisible()
    await page.getByRole('button', { name: 'AI 助手' }).click()
    await expect(page.locator('.ai-panel-section')).toBeVisible()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('show_sidebar'))).toBe('true')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('show_ai_panel'))).toBe('true')

    await page.reload()
    await expect(page.locator('.app-container')).toBeVisible()
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('.ai-panel-section')).toBeVisible()
  })

  test('命令面板可以打开侧边栏面板', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.getByRole('button', { name: '切换侧边栏' }).click()
    await expect(page.locator('.sidebar')).toHaveCount(0)

    await runCommand(page, '打开知识面板')
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('.panel-title')).toHaveText('知识')

    await runCommand(page, '打开 AI 设置')
    await expect(page.locator('.panel-title')).toHaveText('AI 配置')

    await runCommand(page, '打开文档大纲')
    await expect(page.locator('.panel-title')).toHaveText('大纲')

    await runCommand(page, '打开设置')
    await expect(page.locator('.panel-title')).toHaveText('设置')

    await runCommand(page, '打开文件面板')
    await expect(page.locator('.panel-title')).toHaveText('资源管理器')
  })

  test('命令面板可以刷新知识索引', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await loadDemoWorkspace(page)
    await page.evaluate(async () => {
      const { knowledgeIndex } = await import('/src/services/knowledgeIndex.ts')
      await knowledgeIndex.rebuild([])
    })
    await createWorkspaceFile(page, '/workspace/Palette Refresh Target.md', '# Palette Refresh Target\n\nCommand palette refresh body.')

    await runCommand(page, '刷新知识索引')

    await expect(page.locator('.panel-title')).toHaveText('知识')
    await expect(page.locator('.el-message').filter({ hasText: '知识索引已刷新' })).toBeVisible()
    await expect.poll(async () => page.evaluate(async () => {
      const { knowledgeIndex } = await import('/src/services/knowledgeIndex.ts')
      return (await knowledgeIndex.getByPath('/workspace/Palette Refresh Target.md'))?.title ?? ''
    })).toBe('Palette Refresh Target')
  })

  test('设置里的主题开关只设置明确的亮暗主题', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const wasDark = await page.locator('html').evaluate(el => el.classList.contains('dark'))

    await page.getByRole('menuitem', { name: '设置' }).click()
    await page.locator('.setting-row').filter({ hasText: '外观主题' }).locator('.el-switch').click()

    const storedTheme = await page.evaluate(() => localStorage.getItem('theme'))
    expect(storedTheme).toBe(JSON.stringify(wasDark ? 'light' : 'dark'))
    await expect(page.locator('html')).toHaveClass(wasDark ? /light/ : /dark/)
  })

  test('设置里的写作智能开关会持久化并在刷新后恢复', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('menuitem', { name: '设置' }).click()

    await page.locator('.setting-row').filter({ hasText: '知识库增强问答' }).locator('.el-switch').click()
    await page.locator('.setting-row').filter({ hasText: 'AI 行内操作' }).locator('.el-switch').click()
    await page.locator('.setting-row').filter({ hasText: '智能粘贴' }).locator('.el-switch').click()
    await page.locator('.setting-row').filter({ hasText: '行内编辑' }).locator('.el-switch').click()

    await expect.poll(() => page.evaluate(() => localStorage.getItem('enable_rag'))).toBe('true')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('enable_ai_actions'))).toBe('false')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('enable_smart_paste'))).toBe('false')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('enable_inline_edit'))).toBe('false')

    await page.reload()
    await expect(page.locator('.panel-title')).toHaveText('设置')
    await expect(page.locator('.setting-row').filter({ hasText: '知识库增强问答' }).locator('.el-switch')).toHaveClass(/is-checked/)
    await expect(page.locator('.setting-row').filter({ hasText: 'AI 行内操作' }).locator('.el-switch')).not.toHaveClass(/is-checked/)
    await expect(page.locator('.setting-row').filter({ hasText: '智能粘贴' }).locator('.el-switch')).not.toHaveClass(/is-checked/)
    await expect(page.locator('.setting-row').filter({ hasText: '行内编辑' }).locator('.el-switch')).not.toHaveClass(/is-checked/)
  })

  test('设置里的 AI 助手开关会持久化面板可见性', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('menuitem', { name: '设置' }).click()

    await page.locator('.setting-row').filter({ hasText: 'AI 助手' }).locator('.el-switch').click()
    await expect(page.locator('.ai-panel-section')).toBeVisible()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('show_ai_panel'))).toBe('true')

    await page.reload()
    await expect(page.locator('.app-container')).toBeVisible()
    await expect(page.locator('.ai-panel-section')).toBeVisible()
    await expect(page.locator('.panel-title')).toHaveText('设置')
    await expect(page.locator('.setting-row').filter({ hasText: 'AI 助手' }).locator('.el-switch')).toHaveClass(/is-checked/)
  })

  test('设置 store dispose 时会清理系统主题监听', async ({ page }) => {
    const listenerState = await page.evaluate(async () => {
      const originalMatchMedia = window.matchMedia
      const listeners = new Set<EventListenerOrEventListenerObject>()

      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
          if (type === 'change') listeners.add(listener)
        },
        removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
          if (type === 'change') listeners.delete(listener)
        },
        addListener(listener: EventListenerOrEventListenerObject) {
          listeners.add(listener)
        },
        removeListener(listener: EventListenerOrEventListenerObject) {
          listeners.delete(listener)
        },
        dispatchEvent: () => false,
      })) as typeof window.matchMedia

      const { createApp, h, nextTick } = await import('/node_modules/.vite/deps/vue.js')
      const { createPinia } = await import('/node_modules/.vite/deps/pinia.js')
      const { useSettingsStore } = await import('/src/stores/settings.ts')
      let store: ReturnType<typeof useSettingsStore> | null = null
      const host = document.createElement('div')
      document.body.appendChild(host)
      const pinia = createPinia()
      const app = createApp({
        setup() {
          store = useSettingsStore(pinia)
          return () => h('div')
        },
      })
      app.use(pinia)
      app.mount(host)
      await nextTick()

      const afterCreate = listeners.size
      store?.$dispose()
      const afterDispose = listeners.size
      app.unmount()
      host.remove()
      window.matchMedia = originalMatchMedia

      return { afterCreate, afterDispose }
    })

    expect(listenerState).toEqual({ afterCreate: 1, afterDispose: 0 })
  })

  test('响应式 composable 卸载时会清理 resize 监听', async ({ page }) => {
    const listenerState = await page.evaluate(async () => {
      const originalAdd = window.addEventListener.bind(window)
      const originalRemove = window.removeEventListener.bind(window)
      let activeResizeListeners = 0

      window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
        if (type === 'resize') activeResizeListeners += 1
        return originalAdd(type, listener, options)
      }) as typeof window.addEventListener
      window.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
        if (type === 'resize') activeResizeListeners = Math.max(0, activeResizeListeners - 1)
        return originalRemove(type, listener, options)
      }) as typeof window.removeEventListener

      const { createApp, h } = await import('/node_modules/.vite/deps/vue.js')
      const { useResponsive } = await import('/src/composables/useResponsive.ts')
      const host = document.createElement('div')
      document.body.appendChild(host)
      const app = createApp({
        setup() {
          const responsive = useResponsive()
          responsive.onResize(() => {})
          return () => h('div')
        },
      })

      app.mount(host)
      const afterMount = activeResizeListeners
      app.unmount()
      host.remove()
      const afterUnmount = activeResizeListeners

      window.addEventListener = originalAdd as typeof window.addEventListener
      window.removeEventListener = originalRemove as typeof window.removeEventListener

      return { afterMount, afterUnmount }
    })

    expect(listenerState).toEqual({ afterMount: 1, afterUnmount: 0 })
  })

  test('应用卸载时会清理全局 resize 监听', async ({ page }) => {
    await page.addInitScript(() => {
      const originalAdd = window.addEventListener.bind(window)
      const originalRemove = window.removeEventListener.bind(window)
      const resizeListeners = new Set<EventListenerOrEventListenerObject>()

      window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
        if (type === 'resize') resizeListeners.add(listener)
        return originalAdd(type, listener, options)
      }) as typeof window.addEventListener
      window.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
        if (type === 'resize') resizeListeners.delete(listener)
        return originalRemove(type, listener, options)
      }) as typeof window.removeEventListener
      ;(window as any).__getResizeListenerCount = () => resizeListeners.size
    })

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.app-container')).toBeVisible()

    const listenerState = await page.evaluate(() => {
      const beforeUnmount = (window as any).__getResizeListenerCount()
      ;(document.querySelector('#app') as any).__vue_app__?.unmount()
      const afterUnmount = (window as any).__getResizeListenerCount()
      return { beforeUnmount, afterUnmount }
    })

    expect(listenerState.beforeUnmount).toBeGreaterThan(0)
    expect(listenerState.afterUnmount).toBe(0)
  })

  test('应用在异步初始化期间卸载不会留下 session interval', async ({ page }) => {
    const activeIntervalCount = await page.evaluate(async () => {
      ;(document.querySelector('#app') as any).__vue_app__?.unmount()
      document.querySelector('#app')!.innerHTML = ''

      const originalSetInterval = window.setInterval.bind(window)
      const originalClearInterval = window.clearInterval.bind(window)
      const activeIntervals = new Set<number>()

      window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: any[]) => {
        const id = originalSetInterval(handler, timeout, ...args)
        activeIntervals.add(Number(id))
        return id
      }) as typeof window.setInterval
      window.clearInterval = ((id?: number) => {
        if (id !== undefined) activeIntervals.delete(Number(id))
        return originalClearInterval(id)
      }) as typeof window.clearInterval

      const { createApp, nextTick } = await import('/node_modules/.vite/deps/vue.js')
      const { createPinia } = await import('/node_modules/.vite/deps/pinia.js')
      const { default: App } = await import('/src/App.vue')
      const fileSystemModuleUrl = performance
        .getEntriesByType('resource')
        .map(entry => entry.name)
        .find(name => name.includes('/src/services/fileSystem.ts'))
      if (!fileSystemModuleUrl) throw new Error('fileSystem module URL not found')
      const { fileSystem } = await import(fileSystemModuleUrl)
      const originalInit = fileSystem.init
      let resolveInit!: () => void
      let markInitStarted!: () => void
      const initStarted = new Promise<void>(resolve => {
        markInitStarted = resolve
      })
      fileSystem.init = (() => {
        markInitStarted()
        return new Promise<void>(resolve => {
          resolveInit = resolve
        })
      }) as typeof fileSystem.init

      const host = document.createElement('div')
      document.body.appendChild(host)
      const app = createApp(App)
      app.use(createPinia())
      app.mount(host)
      await nextTick()
      await initStarted

      app.unmount()
      resolveInit()
      await new Promise(resolve => window.setTimeout(resolve, 0))
      const count = activeIntervals.size

      fileSystem.init = originalInit
      window.setInterval = originalSetInterval as typeof window.setInterval
      window.clearInterval = originalClearInterval as typeof window.clearInterval
      host.remove()
      return count
    })

    expect(activeIntervalCount).toBe(0)
  })

  test('文件名搜索只保留最后一次查询结果', async ({ page }) => {
    await page.evaluate(async () => {
      localStorage.setItem('workspace_root_path', JSON.stringify('/workspace'))

      const { createApp, h, nextTick, ref } = await import('/node_modules/.vite/deps/vue.js')
      const { default: FileExplorer } = await import('/src/components/sidebar/FileExplorer.vue')
      const vaultServiceModuleUrl = performance
        .getEntriesByType('resource')
        .map(entry => entry.name)
        .find(name => name.includes('/src/services/vault/index.ts'))
      if (!vaultServiceModuleUrl) throw new Error('vaultService module URL not found')
      const { vaultService } = await import(vaultServiceModuleUrl)

      const originalReadDirectory = vaultService.readDirectory
      const originalGetAllMarkdownFiles = vaultService.getAllMarkdownFiles
      const pendingSearches: Array<(files: any[]) => void> = []
      const searchPromises: Promise<unknown>[] = []

      vaultService.readDirectory = async () => []
      vaultService.getAllMarkdownFiles = (() => new Promise(resolve => {
        pendingSearches.push(resolve)
      })) as typeof vaultService.getAllMarkdownFiles

      const host = document.createElement('div')
      host.id = 'file-explorer-search-regression-host'
      document.body.appendChild(host)

      const explorerRef = ref<any>(null)
      const app = createApp({
        setup() {
          return () => h(FileExplorer, {
            ref: explorerRef,
            onSelect: () => {},
            onSearchResultSelect: () => {},
            onRootPathChange: () => {},
            onRenamed: () => {},
            onDeleted: () => {},
          })
        },
      })
      app.mount(host)
      await nextTick()

      ;(window as any).__fileExplorerSearchRegression = {
        trigger(query: string) {
          const promise = explorerRef.value.focusSearch('name', query)
          searchPromises.push(promise)
        },
        resolve(index: number, files: any[]) {
          pendingSearches[index]?.(files)
        },
        pendingCount() {
          return pendingSearches.length
        },
        async settle() {
          await Promise.allSettled(searchPromises)
        },
        cleanup() {
          app.unmount()
          host.remove()
          vaultService.readDirectory = originalReadDirectory
          vaultService.getAllMarkdownFiles = originalGetAllMarkdownFiles
          localStorage.removeItem('workspace_root_path')
        },
      }
    })

    const regressionHost = page.locator('#file-explorer-search-regression-host')

    try {
      await page.evaluate(() => {
        ;(window as any).__fileExplorerSearchRegression.trigger('old')
        ;(window as any).__fileExplorerSearchRegression.trigger('new')
      })
      await expect.poll(() => page.evaluate(() => (window as any).__fileExplorerSearchRegression.pendingCount())).toBe(2)

      await page.evaluate(() => {
        ;(window as any).__fileExplorerSearchRegression.resolve(1, [
          { name: 'new-result.md', path: '/workspace/new-result.md' },
        ])
      })
      await expect(regressionHost.locator('.search-result-card')).toContainText('new-result.md')

      await page.evaluate(async () => {
        ;(window as any).__fileExplorerSearchRegression.resolve(0, [
          { name: 'old-result.md', path: '/workspace/old-result.md' },
        ])
        await (window as any).__fileExplorerSearchRegression.settle()
      })
      await expect(regressionHost.locator('.search-result-card')).toContainText('new-result.md')
      await expect(regressionHost.locator('.search-result-card').filter({ hasText: 'old-result.md' })).toHaveCount(0)
    } finally {
      await page.evaluate(() => (window as any).__fileExplorerSearchRegression?.cleanup())
    }
  })

  test('窄屏下页面不产生横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('.app-container')).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('移动端侧边栏以抽屉打开并可通过遮罩关闭', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await expect(page.locator('.sidebar')).toHaveCount(0)
    const mainBox = await page.locator('.editor-container-main').boundingBox()
    expect(mainBox?.x).toBeGreaterThanOrEqual(0)
    expect(mainBox?.width).toBeGreaterThanOrEqual(389)

    await page.getByRole('button', { name: '切换侧边栏' }).click()
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('.mobile-sidebar-backdrop')).toBeVisible()

    const drawerBox = await page.locator('.sidebar-aside').boundingBox()
    expect(drawerBox).not.toBeNull()
    expect(drawerBox!.width).toBeLessThanOrEqual(390 * 0.86 + 1)

    await page.mouse.click(385, 80)
    await expect(page.locator('.sidebar')).toHaveCount(0)
    await expect(page.locator('.mobile-sidebar-backdrop')).toHaveCount(0)
  })

  test('移动端侧边栏可通过 Escape 关闭', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await page.getByRole('button', { name: '切换侧边栏' }).click()
    await expect(page.locator('.sidebar')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('.sidebar')).toHaveCount(0)
    await expect(page.locator('.mobile-sidebar-backdrop')).toHaveCount(0)
  })

  test('移动端试用示例后自动打开文档并关闭侧边栏', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await expect(page.locator('.sidebar')).toHaveCount(0)
    await page.getByRole('button', { name: '试用示例', exact: true }).click()

    await expect(page.locator('.tabs-bar')).toContainText('README.md')
    await expect(page.locator('.preview-pane')).toBeVisible()
    await expect(page.locator('.preview-content')).toContainText('AI Markdown 示例工作区')
    await expect(page.locator('.preview-content')).toContainText('工作流图')
    await expect(page.locator('.cm-content')).toHaveCount(0)
    await expect(page.locator('.status-bar')).toContainText('阅读')
    await expect(page.locator('.status-bar .status-stats')).toBeHidden()
    await expect(page.locator('.status-bar .status-duration')).toBeHidden()
    await expect(page.locator('.sidebar')).toHaveCount(0)
    await expect(page.locator('.mobile-sidebar-backdrop')).toHaveCount(0)

    const editorBox = await page.locator('.editor-container-main').boundingBox()
    expect(editorBox?.x).toBeGreaterThanOrEqual(0)
    expect(editorBox?.width).toBeGreaterThanOrEqual(389)

    const viewModeButton = page.locator('.status-bar .view-mode-btn')
    const viewModeButtonBox = await viewModeButton.boundingBox()
    expect(viewModeButtonBox?.width).toBeGreaterThanOrEqual(44)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)

    await page.getByRole('button', { name: '切换视图模式' }).click()
    await expect(page.locator('.cm-content')).toBeVisible()
    await expect(page.locator('.preview-pane')).toHaveCount(0)
    await expect(page.locator('.status-bar')).toContainText('源码')

    await page.getByRole('button', { name: '切换视图模式' }).click()
    await expect(page.locator('.cm-content')).toBeVisible()
    await expect(page.locator('.preview-pane')).toHaveCount(0)
    await expect(page.locator('.status-bar')).toContainText('实时预览')
  })

  test('移动端从文件树选择文件后关闭侧边栏并显示编辑器', async ({ page }) => {
    await loadDemoWorkspace(page)
    await page.setViewportSize({ width: 390, height: 844 })

    await page.getByRole('button', { name: '切换侧边栏' }).click()
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('.el-tree')).toBeVisible()

    await page.locator('.tree-node').filter({ hasText: 'README.md' }).click()
    await expect(page.locator('.cm-content')).toBeVisible()
    await expect(page.locator('.sidebar')).toHaveCount(0)
    await expect(page.locator('.mobile-sidebar-backdrop')).toHaveCount(0)

    const editorBox = await page.locator('.editor-container-main').boundingBox()
    expect(editorBox?.x).toBeGreaterThanOrEqual(0)
    expect(editorBox?.width).toBeGreaterThanOrEqual(389)
  })
})
