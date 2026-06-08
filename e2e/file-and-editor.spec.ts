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
      let deletedNestedError = ''
      try {
        await fileSystem.readFile(nestedPath)
      } catch (error) {
        deletedNestedError = error instanceof Error ? error.message : String(error)
      }
      return {
        renamedContent: await fileSystem.readFile(renamedPath),
        rootPaths: rootFiles.map((file: any) => file.path),
        deletedNestedError,
      }
    }, { originalPath, renamedPath, folderPath, nestedPath })

    expect(result.renamedContent).toBe('rename target')
    expect(result.rootPaths).toContain(renamedPath)
    expect(result.rootPaths).not.toContain(originalPath)
    expect(result.rootPaths).not.toContain(folderPath)
    expect(result.deletedNestedError).toContain('文件不存在')
  })

  test('文件系统服务会拒绝破坏文件树一致性的写入', async ({ page }) => {
    const suffix = Date.now()
    const parentFile = `/workspace/parent-file-${suffix}.md`
    const missingFolder = `/workspace/missing-parent-${suffix}`

    const result = await page.evaluate(async ({ parentFile, missingFolder }) => {
      const { fileSystem } = await import('/src/services/fileSystem.ts')
      await fileSystem.init()
      await fileSystem.writeFile(parentFile, 'parent file')

      const captureError = async (action: () => Promise<void>) => {
        try {
          await action()
          return ''
        } catch (error) {
          return error instanceof Error ? error.message : String(error)
        }
      }

      return {
        missingParentWriteError: await captureError(() => fileSystem.writeFile(`${missingFolder}/note.md`, 'orphan')),
        fileParentCreateError: await captureError(() => fileSystem.createFile(`${parentFile}/child.md`)),
        directoryWriteError: await captureError(() => fileSystem.writeFile('/workspace', 'not a file')),
        missingParentRenameError: await captureError(() => fileSystem.renameFile(parentFile, `${missingFolder}/renamed.md`)),
        missingDirectoryReadError: await captureError(() => fileSystem.readDirectory(missingFolder).then(() => undefined)),
      }
    }, { parentFile, missingFolder })

    expect(result.missingParentWriteError).toContain('父文件夹不存在')
    expect(result.fileParentCreateError).toContain('父路径不是文件夹')
    expect(result.directoryWriteError).toContain('路径是文件夹')
    expect(result.missingParentRenameError).toContain('父文件夹不存在')
    expect(result.missingDirectoryReadError).toContain('文件夹不存在')
  })

  test('文件名搜索和内容搜索可以定位文档', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/search-target.md', 'first line\nneedle-content-line\nthird line')
    await loadDemoWorkspace(page)

    const searchInput = page.getByPlaceholder('搜索文件...')
    await searchInput.fill('search-target')
    const nameResult = page.locator('.search-result-card').filter({ hasText: 'search-target.md' })
    await expect(nameResult).toBeVisible()
    await expect(nameResult.locator('.result-match-line')).toContainText('search-target.md')

    await page.locator('.search-bar button').click()
    await expect(page.locator('.search-mode-hint')).toHaveText('内容搜索')
    await searchInput.fill('needle-content-line')
    await page.keyboard.press('Enter')
    const contentResult = page.locator('.search-result-card').filter({ hasText: 'search-target.md' })
    await expect(contentResult).toBeVisible()
    await expect(contentResult).toContainText('needle-content-line')

    await contentResult.click()
    await expect(page.locator('.tabs-bar')).toContainText('search-target.md')
    await expect(page.locator('.status-bar')).toContainText('行 2')
  })

  test('内容搜索支持正则表达式', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/regex-test.md', 'TODO: fix bug\nDONE: implement feature\nWIP: refactor code')
    await loadDemoWorkspace(page)

    const searchInput = page.getByPlaceholder('搜索文件...')
    await searchInput.fill('regex-test')
    await expect(page.locator('.search-result-card').filter({ hasText: 'regex-test.md' })).toBeVisible()

    // Switch to content search
    await page.locator('.search-bar button').click()
    await expect(page.locator('.search-mode-hint')).toHaveText('内容搜索')

    // Use regex search with /pattern/ syntax
    await searchInput.fill('/TODO|DONE|WIP/')
    await page.keyboard.press('Enter')

    // Should show regex mode indicator
    await expect(page.locator('.search-mode-hint')).toHaveText('正则搜索')

    const result = page.locator('.search-result-card').filter({ hasText: 'regex-test.md' })
    await expect(result).toBeVisible()
  })

  test('标签自动补全在输入 # 后显示建议', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/tag-test.md', '---\ntags: [work, project]\n---\n\n# Tag Test\n\nThis is a work project')
    await loadDemoWorkspace(page)

    // Open the file
    await page.locator('.el-tree-node').filter({ hasText: 'tag-test.md' }).click()
    await expect(page.locator('.cm-content')).toBeVisible()

    // Type a tag trigger
    const editor = page.locator('.cm-content')
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.insertText(' #wo')

    // Should show tag completion popup
    await expect(page.locator('.tag-completion')).toBeVisible()
    await expect(page.locator('.tag-completion .completion-title').first()).toContainText('#work')
  })

  test('应用级拖拽只按实际导入的 Markdown 文件提示', async ({ page }) => {
    await loadDemoWorkspace(page)

    const markdownDropResult = await page.evaluate(() => {
      const file = new File(['# Dropped Note\n\nfrom markdown drop'], 'dropped-note.md', { type: 'text/markdown' })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer })
      return document.querySelector('.app-container')?.dispatchEvent(event)
    })

    expect(markdownDropResult).toBe(false)
    await expect(page.locator('.tabs-bar')).toContainText('dropped-note.md')
    await expect(page.locator('.cm-content')).toContainText('Dropped Note')
    await expect(page.getByText('已导入 1 个 Markdown 文件')).toBeVisible()

    const tabCountBeforeUnsupportedDrop = await page.locator('.tab-label').count()
    await page.evaluate(() => {
      const file = new File(['zip-bytes'], 'archive.zip', { type: 'application/zip' })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer })
      document.querySelector('.app-container')?.dispatchEvent(event)
    })

    await expect(page.getByText('未导入文件：仅支持 Markdown 文件')).toBeVisible()
    await expect(page.getByText('已导入 1 个文件')).toHaveCount(0)
    expect(await page.locator('.tab-label').count()).toBe(tabCountBeforeUnsupportedDrop)
  })

  test('按路径标记保存不会错误清除其他标签的未保存状态', async ({ page }) => {
    const firstPath = '/workspace/async-save-a.md'
    const secondPath = '/workspace/async-save-b.md'
    const state = await page.evaluate(async ({ firstPath, secondPath }) => {
      const { fileSystem } = await import('/src/services/fileSystem.ts')
      const { useEditorStore } = await import('/src/stores/editor.ts')

      await fileSystem.init()
      await fileSystem.writeFile(firstPath, '# A')
      await fileSystem.writeFile(secondPath, '# B')
      const editorStore = useEditorStore()
      editorStore.addTab(firstPath, '# A')
      editorStore.addTab(secondPath, '# B')
      const firstTab = editorStore.openTabs.find(tab => tab.filePath === firstPath)!
      editorStore.switchTab(firstTab.id)
      editorStore.setContent('# A pending save')
      const secondTab = editorStore.openTabs.find(tab => tab.filePath === secondPath)!
      editorStore.switchTab(secondTab.id)
      editorStore.setContent('# B unsaved while A finishes')
      editorStore.markPathSaved(firstPath, '# A pending save')
      editorStore.markPathSaved(secondPath, '# B stale saved content')

      return {
        activePath: editorStore.currentFile,
        activeModified: editorStore.isModified,
        tabs: editorStore.openTabs.map(tab => ({
          filePath: tab.filePath,
          isModified: tab.isModified,
        })),
      }
    }, { firstPath, secondPath })

    expect(state).toMatchObject({
      activePath: secondPath,
      activeModified: true,
      tabs: expect.arrayContaining([
        { filePath: firstPath, isModified: false },
        { filePath: secondPath, isModified: true },
      ]),
    })
  })

  test('连续选择文件时慢读取不会覆盖最后选择的文件', async ({ page }) => {
    await page.evaluate(async () => {
      const { createApp, h, nextTick, ref } = await import('/node_modules/.vite/deps/vue.js')
      const { createPinia } = await import('/node_modules/.vite/deps/pinia.js')
      const { useFileOperations } = await import('/src/composables/useFileOperations.ts')
      const resourceUrls = performance.getEntriesByType('resource').map(entry => entry.name)
      const editorStoreModuleUrl = resourceUrls.find(name => name.includes('/src/stores/editor.ts'))
      const vaultServiceModuleUrl = resourceUrls.find(name => name.includes('/src/services/vault/index.ts'))
      if (!editorStoreModuleUrl || !vaultServiceModuleUrl) throw new Error('runtime module URL not found')
      const { useEditorStore } = await import(editorStoreModuleUrl)
      const { vaultService } = await import(vaultServiceModuleUrl)

      const originalReadFile = vaultService.readFile
      const pendingReads: Array<{ path: string; resolve: (content: string) => void }> = []
      const selectPromises: Promise<unknown>[] = []
      const editorSetContents: string[] = []

      vaultService.readFile = ((path: string) => new Promise(resolve => {
        pendingReads.push({ path, resolve })
      })) as typeof vaultService.readFile

      const host = document.createElement('div')
      host.id = 'file-operations-select-regression-host'
      document.body.appendChild(host)

      const app = createApp({
        setup() {
          const editorRef = ref({
            setContent(content: string) {
              editorSetContents.push(content)
            },
          })
          const fileOperations = useFileOperations(editorRef)
          const editorStore = useEditorStore()
          editorStore.addTab('/workspace/current.md', '# Current')
          editorStore.setContentSilent('# Current')

          ;(window as any).__fileOperationsSelectRegression = {
            select(path: string) {
              selectPromises.push(fileOperations.handleFileSelect(path))
            },
            resolve(index: number, content: string) {
              pendingReads[index]?.resolve(content)
            },
            pendingPaths() {
              return pendingReads.map(read => read.path)
            },
            state() {
              return {
                currentFile: editorStore.currentFile,
                content: editorStore.content,
                tabs: editorStore.openTabs.map(tab => tab.filePath),
                editorSetContents,
              }
            },
            async settle() {
              await Promise.allSettled(selectPromises)
            },
            cleanup() {
              app.unmount()
              host.remove()
              vaultService.readFile = originalReadFile
            },
          }

          return () => h('div')
        },
      })
      app.use(createPinia())
      app.mount(host)
      await nextTick()
    })

    try {
      await page.evaluate(() => {
        ;(window as any).__fileOperationsSelectRegression.select('/workspace/slow.md')
        ;(window as any).__fileOperationsSelectRegression.select('/workspace/fast.md')
      })
      await expect.poll(() => page.evaluate(() => (window as any).__fileOperationsSelectRegression.pendingPaths())).toEqual([
        '/workspace/slow.md',
        '/workspace/fast.md',
      ])

      await page.evaluate(() => {
        ;(window as any).__fileOperationsSelectRegression.resolve(1, '# Fast')
      })
      await expect.poll(() => page.evaluate(() => (window as any).__fileOperationsSelectRegression.state().currentFile)).toBe('/workspace/fast.md')

      await page.evaluate(async () => {
        ;(window as any).__fileOperationsSelectRegression.resolve(0, '# Slow')
        await (window as any).__fileOperationsSelectRegression.settle()
      })
      const state = await page.evaluate(() => (window as any).__fileOperationsSelectRegression.state())
      expect(state).toMatchObject({
        currentFile: '/workspace/fast.md',
        content: '# Fast',
        tabs: expect.arrayContaining(['/workspace/current.md', '/workspace/fast.md']),
        editorSetContents: ['# Fast'],
      })
      expect(state.tabs).not.toContain('/workspace/slow.md')
    } finally {
      await page.evaluate(() => (window as any).__fileOperationsSelectRegression?.cleanup())
    }
  })

  test('恢复会话会重载已保存标签内容并移除缺失文件标签', async ({ page }) => {
    const tabState = {
      activeTabId: 'missing-tab',
      viewMode: 'source',
      tabs: [
        {
          id: 'missing-tab',
          filePath: '/workspace/restore-missing.md',
          fileName: 'restore-missing.md',
          content: '',
          isModified: false,
        },
        {
          id: 'restore-a',
          filePath: '/workspace/restore-a.md',
          fileName: 'restore-a.md',
          content: '',
          isModified: false,
        },
        {
          id: 'restore-b',
          filePath: '/workspace/restore-b.md',
          fileName: 'restore-b.md',
          content: '',
          isModified: false,
        },
      ],
    }

    await createWorkspaceFile(page, '/workspace/restore-a.md', '# Restored A\n\nactive fallback')
    await createWorkspaceFile(page, '/workspace/restore-b.md', '# Restored B\n\ninactive reload token')
    await page.evaluate((state) => {
      localStorage.setItem('editor_tab_state', JSON.stringify(state))
    }, tabState)
    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect(page.locator('.app-container')).toBeVisible()
    await expect(page.locator('.tabs-bar')).not.toContainText('restore-missing.md')
    await expect(page.locator('.tabs-bar')).toContainText('restore-a.md')
    await expect(page.locator('.cm-content')).toContainText('Restored A')

    await page.locator('.tab-label').filter({ hasText: 'restore-b.md' }).click()
    await expect(page.locator('.cm-content')).toContainText('inactive reload token')
  })

  test('版本历史打开时切换文件会忽略旧文件慢加载结果', async ({ page }) => {
    await page.evaluate(async () => {
      const { createApp, h, nextTick, ref } = await import('/node_modules/.vite/deps/vue.js')
      const { default: VersionHistoryPanel } = await import('/src/components/editor/VersionHistoryPanel.vue')
      const { versionHistory } = await import('/src/services/versionHistory.ts')

      const originalGetSnapshots = versionHistory.getSnapshots
      const pendingLoads: Array<{ path: string; resolve: (snapshots: any[]) => void }> = []
      const loadPromises: Promise<unknown>[] = []
      versionHistory.getSnapshots = ((path: string) => {
        const promise = new Promise(resolve => {
          pendingLoads.push({ path, resolve })
        })
        loadPromises.push(promise)
        return promise
      }) as typeof versionHistory.getSnapshots

      const visible = ref(true)
      const filePath = ref('/workspace/history-a.md')
      const host = document.createElement('div')
      host.id = 'version-history-regression-host'
      document.body.appendChild(host)

      const app = createApp({
        setup() {
          return () => h(VersionHistoryPanel, {
            modelValue: visible.value,
            filePath: filePath.value,
            'onUpdate:modelValue': (value: boolean) => { visible.value = value },
          })
        },
      })
      app.mount(host)
      await nextTick()

      ;(window as any).__versionHistoryRegression = {
        switchFile(path: string) {
          filePath.value = path
        },
        pendingPaths() {
          return pendingLoads.map(load => load.path)
        },
        resolve(index: number, label: string) {
          pendingLoads[index]?.resolve([{
            id: index + 1,
            filePath: pendingLoads[index].path,
            content: label,
            timestamp: Date.now(),
            label,
            charCount: label.length,
          }])
        },
        async settle() {
          await Promise.allSettled(loadPromises)
        },
        cleanup() {
          app.unmount()
          host.remove()
          versionHistory.getSnapshots = originalGetSnapshots
        },
      }
    })

    try {
      await expect.poll(() => page.evaluate(() => (window as any).__versionHistoryRegression.pendingPaths())).toEqual([
        '/workspace/history-a.md',
      ])
      await page.evaluate(() => {
        ;(window as any).__versionHistoryRegression.switchFile('/workspace/history-b.md')
      })
      await expect.poll(() => page.evaluate(() => (window as any).__versionHistoryRegression.pendingPaths())).toEqual([
        '/workspace/history-a.md',
        '/workspace/history-b.md',
      ])

      await page.evaluate(() => {
        ;(window as any).__versionHistoryRegression.resolve(1, 'History B')
      })
      await expect(page.locator('.history-card')).toContainText('History B')

      await page.evaluate(async () => {
        ;(window as any).__versionHistoryRegression.resolve(0, 'History A')
        await (window as any).__versionHistoryRegression.settle()
      })
      await expect(page.locator('.history-card')).toContainText('History B')
      await expect(page.locator('.history-card').filter({ hasText: 'History A' })).toHaveCount(0)
    } finally {
      await page.evaluate(() => (window as any).__versionHistoryRegression?.cleanup())
    }
  })

  test('版本历史预览切换文件后不会恢复旧文件内容', async ({ page }) => {
    await page.evaluate(async () => {
      const { createApp, h, nextTick, ref } = await import('/node_modules/.vite/deps/vue.js')
      const { default: VersionHistoryPanel } = await import('/src/components/editor/VersionHistoryPanel.vue')
      const { versionHistory } = await import('/src/services/versionHistory.ts')

      const originalGetSnapshots = versionHistory.getSnapshots
      const originalRestoreSnapshot = versionHistory.restoreSnapshot
      const snapshotsByPath: Record<string, any[]> = {
        '/workspace/history-preview-a.md': [{
          id: 101,
          filePath: '/workspace/history-preview-a.md',
          content: '# Old A',
          timestamp: Date.now(),
          label: 'Old A',
          charCount: 7,
        }],
        '/workspace/history-preview-b.md': [{
          id: 102,
          filePath: '/workspace/history-preview-b.md',
          content: '# Current B',
          timestamp: Date.now(),
          label: 'Current B',
          charCount: 11,
        }],
      }
      versionHistory.getSnapshots = ((path: string) => Promise.resolve(snapshotsByPath[path] || [])) as typeof versionHistory.getSnapshots
      versionHistory.restoreSnapshot = ((id: number) => {
        const snapshot = Object.values(snapshotsByPath).flat().find(item => item.id === id)
        return Promise.resolve(snapshot?.content || null)
      }) as typeof versionHistory.restoreSnapshot

      const visible = ref(true)
      const filePath = ref('/workspace/history-preview-a.md')
      const restored: string[] = []
      const host = document.createElement('div')
      host.id = 'version-history-preview-regression-host'
      document.body.appendChild(host)

      const app = createApp({
        setup() {
          return () => h(VersionHistoryPanel, {
            modelValue: visible.value,
            filePath: filePath.value,
            'onUpdate:modelValue': (value: boolean) => { visible.value = value },
            onRestore: (content: string) => restored.push(content),
          })
        },
      })
      app.mount(host)
      await nextTick()

      ;(window as any).__versionHistoryPreviewRegression = {
        switchFile(path: string) {
          filePath.value = path
        },
        restored() {
          return restored
        },
        cleanup() {
          app.unmount()
          host.remove()
          versionHistory.getSnapshots = originalGetSnapshots
          versionHistory.restoreSnapshot = originalRestoreSnapshot
        },
      }
    })

    try {
      await expect(page.locator('.history-card')).toContainText('Old A')
      await page.locator('.history-card').click()
      await expect(page.getByRole('dialog', { name: '版本预览' })).toBeVisible()

      await page.evaluate(() => {
        ;(window as any).__versionHistoryPreviewRegression.switchFile('/workspace/history-preview-b.md')
      })

      await expect(page.getByRole('dialog', { name: '版本预览' })).toBeHidden()
      await expect(page.locator('.history-card')).toContainText('Current B')
      await expect.poll(() => page.evaluate(() => (window as any).__versionHistoryPreviewRegression.restored())).toEqual([])
    } finally {
      await page.evaluate(() => (window as any).__versionHistoryPreviewRegression?.cleanup())
    }
  })

  test('重命名已打开文件会同步标签路径并保存到新路径', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/open-rename.md', '# Before Rename')
    await loadDemoWorkspace(page)
    await page.locator('.el-tree-node').filter({ hasText: 'open-rename.md' }).click()
    await expect(page.locator('.tabs-bar')).toContainText('open-rename.md')

    await page.locator('.el-tree-node').filter({ hasText: 'open-rename.md' }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: '重命名' }).click()
    await page.locator('.el-message-box input').fill('open-renamed.md')
    await page.getByRole('button', { name: '确定' }).click()

    await expect(page.locator('.tabs-bar')).toContainText('open-renamed.md')
    await expect(page.locator('.tabs-bar')).not.toContainText('open-rename.md')
    await setEditorContent(page, '# After Rename Save')
    await page.keyboard.press('Control+S')
    await expect.poll(() => readWorkspaceFile(page, '/workspace/open-renamed.md')).toContain('After Rename Save')

    const oldPathError = await page.evaluate(async () => {
      const { fileSystem } = await import('/src/services/fileSystem.ts')
      try {
        await fileSystem.readFile('/workspace/open-rename.md')
        return ''
      } catch (error) {
        return error instanceof Error ? error.message : String(error)
      }
    })
    expect(oldPathError).toContain('文件不存在')
  })

  test('重命名文件会自动更新指向它的 Wiki Link', async ({ page }) => {
    const suffix = Date.now()
    const oldTargetPath = `/workspace/wiki-target-${suffix}.md`
    const newTargetPath = `/workspace/wiki-target-renamed-${suffix}.md`
    const sourcePath = `/workspace/wiki-source-${suffix}.md`

    const result = await page.evaluate(async ({ oldTargetPath, newTargetPath, sourcePath, suffix }) => {
      const { fileSystem } = await import('/src/services/fileSystem.ts')
      await fileSystem.init()
      await fileSystem.writeFile(oldTargetPath, `# Wiki Target ${suffix}\n\n## Deep`)
      await fileSystem.writeFile(sourcePath, [
        '# Wiki Source',
        '',
        `Alias link [[wiki-target-${suffix}#Deep|Target Alias]] should update.`,
      ].join('\n'))
      const renameResult = await fileSystem.renameFile(oldTargetPath, newTargetPath)

      return {
        sourceContent: await fileSystem.readFile(sourcePath),
        updatedLinkPaths: renameResult.updatedLinkPaths,
      }
    }, { oldTargetPath, newTargetPath, sourcePath, suffix })

    expect(result.sourceContent).toContain(`[[wiki-target-renamed-${suffix}#Deep|Target Alias]]`)
    expect(result.sourceContent).not.toContain(`[[wiki-target-${suffix}#Deep|Target Alias]]`)
    expect(result.updatedLinkPaths).toContain(sourcePath)
  })

  test('重命名文件夹会自动更新指向子文档的 Wiki Link', async ({ page }) => {
    const suffix = Date.now()
    const oldFolder = `/workspace/wiki-folder-${suffix}`
    const newFolder = `/workspace/wiki-folder-renamed-${suffix}`
    const sourcePath = `/workspace/wiki-folder-source-${suffix}.md`

    const result = await page.evaluate(async ({ oldFolder, newFolder, sourcePath, suffix }) => {
      const { fileSystem } = await import('/src/services/fileSystem.ts')
      await fileSystem.init()
      await fileSystem.createDirectory(oldFolder)
      await fileSystem.writeFile(`${oldFolder}/nested.md`, '# Nested Target')
      await fileSystem.writeFile(sourcePath, `Folder link [[wiki-folder-${suffix}/nested|Nested Alias]] should update.`)
      const renameResult = await fileSystem.renameFile(oldFolder, newFolder)

      return {
        sourceContent: await fileSystem.readFile(sourcePath),
        updatedLinkPaths: renameResult.updatedLinkPaths,
      }
    }, { oldFolder, newFolder, sourcePath, suffix })

    expect(result.sourceContent).toContain(`[[wiki-folder-renamed-${suffix}/nested|Nested Alias]]`)
    expect(result.sourceContent).not.toContain(`[[wiki-folder-${suffix}/nested|Nested Alias]]`)
    expect(result.updatedLinkPaths).toContain(sourcePath)
  })

  test('重命名目标文件会同步已打开来源标签里的 Wiki Link', async ({ page }) => {
    const suffix = Date.now()
    const targetName = `ui-link-target-${suffix}.md`
    const renamedTargetName = `ui-link-target-renamed-${suffix}.md`
    const sourceName = `ui-link-source-${suffix}.md`
    const sourcePath = `/workspace/${sourceName}`

    await createWorkspaceFile(page, `/workspace/${targetName}`, `# UI Link Target ${suffix}`)
    await createWorkspaceFile(page, sourcePath, [
      '# UI Link Source',
      '',
      `Keep this open: [[ui-link-target-${suffix}]]`,
    ].join('\n'))
    await loadDemoWorkspace(page)
    await page.getByRole('treeitem', { name: sourceName }).click()
    await expect(page.locator('.cm-content')).toContainText(`[[ui-link-target-${suffix}]]`)

    await page.getByRole('treeitem', { name: targetName }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: '重命名' }).click()
    await page.locator('.el-message-box input').fill(renamedTargetName)
    await page.getByRole('button', { name: '确定' }).click()

    await expect(page.locator('.cm-content')).toContainText(`[[ui-link-target-renamed-${suffix}]]`)
    await expect.poll(() => readWorkspaceFile(page, sourcePath)).toContain(`[[ui-link-target-renamed-${suffix}]]`)
  })

  test('删除已打开文件会关闭对应标签并清空当前编辑器', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/open-delete.md', '# Delete Me')
    await loadDemoWorkspace(page)
    await page.locator('.el-tree-node').filter({ hasText: 'open-delete.md' }).click()
    await expect(page.locator('.tabs-bar')).toContainText('open-delete.md')

    await page.locator('.el-tree-node').filter({ hasText: 'open-delete.md' }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: '删除' }).click()
    await page.getByRole('button', { name: '确定' }).click()

    await expect(page.locator('.tabs-bar')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'AI Markdown' })).toBeVisible()
    await expect(page.locator('.cm-content')).toHaveCount(0)
  })

  test('重命名文件夹会同步嵌套已打开标签路径', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/notes/open-nested-rename.md', '# Nested Before Rename')
    await loadDemoWorkspace(page)
    await page.locator('.el-tree-node').filter({ hasText: 'notes' }).first().click()
    await page.getByRole('treeitem', { name: 'open-nested-rename.md' }).click()
    await expect(page.locator('.tabs-bar')).toContainText('open-nested-rename.md')

    await page.locator('[data-file-path="/workspace/notes"]').click({ button: 'right' })
    await page.getByRole('menuitem', { name: '重命名' }).click()
    await page.locator('.el-message-box input').fill('renamed-notes')
    await page.getByRole('button', { name: '确定' }).click()

    await setEditorContent(page, '# Nested After Rename Save')
    await page.keyboard.press('Control+S')
    await expect.poll(() => readWorkspaceFile(page, '/workspace/renamed-notes/open-nested-rename.md')).toContain('Nested After Rename Save')

    const oldNestedPathError = await page.evaluate(async () => {
      const { fileSystem } = await import('/src/services/fileSystem.ts')
      try {
        await fileSystem.readFile('/workspace/notes/open-nested-rename.md')
        return ''
      } catch (error) {
        return error instanceof Error ? error.message : String(error)
      }
    })
    expect(oldNestedPathError).toContain('文件不存在')
  })

  test('删除文件夹会关闭嵌套已打开标签并清空当前编辑器', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/notes/open-nested-delete.md', '# Nested Delete Me')
    await loadDemoWorkspace(page)
    await page.locator('.el-tree-node').filter({ hasText: 'notes' }).first().click()
    await page.getByRole('treeitem', { name: 'open-nested-delete.md' }).click()
    await expect(page.locator('.tabs-bar')).toContainText('open-nested-delete.md')

    await page.locator('[data-file-path="/workspace/notes"]').click({ button: 'right' })
    await page.getByRole('menuitem', { name: '删除' }).click()
    await page.getByRole('button', { name: '确定' }).click()

    await expect(page.locator('.tabs-bar')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'AI Markdown' })).toBeVisible()
    await expect(page.locator('.cm-content')).toHaveCount(0)
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

  test('命令面板可以创建并打开今日笔记', async ({ page }) => {
    await loadDemoWorkspace(page)
    const now = new Date()
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')

    await runCommand(page, '今日笔记')

    await expect(page.locator('.tabs-bar')).toContainText(`${today}.md`)
    await expect(page.locator('.cm-content')).toContainText(today)

    const content = await readWorkspaceFile(page, `/workspace/Daily/${today}.md`)
    expect(content).toContain(`date: ${today}`)
    expect(content).toContain('tags: [daily]')
    expect(content).toContain('## 今日重点')
    expect(content).toContain('## 记录')

    await setEditorContent(page, `# ${today}\n\n保留已有内容`)
    await page.keyboard.press('Control+S')
    await expect(page.locator('.save-status')).toContainText('保存成功')

    await runCommand(page, '今日笔记')
    await expect.poll(() => readWorkspaceFile(page, `/workspace/Daily/${today}.md`)).toContain('保留已有内容')
  })

  test('命令面板可以快速打开笔记', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/Quick Open Target.md', '# Quick Open Target\n\nquick-open-body-token')
    await loadDemoWorkspace(page)

    await runCommand(page, 'Quick Open Target')

    await expect(page.locator('.tabs-bar')).toContainText('Quick Open Target.md')
    await expect(page.locator('.cm-content')).toContainText('quick-open-body-token')
  })

  test('命令面板可以进入全局内容搜索', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/Command Search Target.md', '# Command Search Target\n\nUnique command search phrase')
    await loadDemoWorkspace(page)

    await runCommand(page, '全局内容搜索')

    await expect(page.locator('.search-mode-hint')).toHaveText('内容搜索')
    await page.keyboard.insertText('Unique command search phrase')
    await page.keyboard.press('Enter')
    const result = page.locator('.search-result-card').filter({ hasText: 'Command Search Target.md' })
    await expect(result).toBeVisible()
    await expect(result).toContainText('Unique command search phrase')

    await result.click()
    await expect(page.locator('.tabs-bar')).toContainText('Command Search Target.md')
    await expect(page.locator('.cm-content')).toContainText('Unique command search phrase')
  })

  test('命令面板可以进入文件名搜索并打开嵌套文档', async ({ page }) => {
    await page.evaluate(async () => {
      const { fileSystem } = await import('/src/services/fileSystem.ts')
      await fileSystem.init()
      await fileSystem.createDirectory('/workspace/nested-search')
      await fileSystem.writeFile('/workspace/nested-search/Command Name Target.md', '# Command Name Target\n\nnested-name-token')
    })
    await loadDemoWorkspace(page)

    await runCommand(page, '搜索文件名')

    await expect(page.locator('.search-mode-hint')).toHaveText('文件名搜索')
    await page.keyboard.insertText('Command Name')
    const result = page.locator('.search-result-card').filter({ hasText: 'Command Name Target.md' })
    await expect(result).toBeVisible()
    await expect(result).toContainText('nested-search/Command Name Target.md')

    await result.click()
    await expect(page.locator('.tabs-bar')).toContainText('Command Name Target.md')
    await expect(page.locator('.cm-content')).toContainText('nested-name-token')
  })

  test('Wiki Link 补全可以用 Enter 插入已有笔记', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/Alpha Note.md', '# Alpha Note')
    await createWorkspaceFile(page, '/workspace/wiki-completion-source.md', '# Source')
    await loadDemoWorkspace(page)
    await page.getByRole('treeitem', { name: 'wiki-completion-source.md' }).click()
    await setEditorContent(page, 'Link to ')

    await page.keyboard.insertText('[[alp')
    await expect(page.locator('.wiki-link-completion')).toBeVisible()
    await expect(page.locator('.wiki-link-completion')).toContainText('Alpha Note')

    await page.keyboard.press('Enter')
    await expect(page.locator('.cm-content')).toContainText('Link to [[Alpha Note]]')
    await page.keyboard.press('Control+S')
    await expect.poll(() => readWorkspaceFile(page, '/workspace/wiki-completion-source.md')).toContain('[[Alpha Note]]')
  })

  test('Wiki Link 当前文档标题补全可以插入标题片段', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/wiki-heading-completion.md', [
      '# Source',
      '',
      '## Deep Heading',
      '',
      'Body text',
    ].join('\n'))
    await loadDemoWorkspace(page)
    await page.getByRole('treeitem', { name: 'wiki-heading-completion.md' }).click()
    await setEditorContent(page, [
      '# Source',
      '',
      '## Deep Heading',
      '',
      'Link to ',
    ].join('\n'))

    await page.keyboard.insertText('[[#deep')
    await expect(page.locator('.wiki-link-completion')).toBeVisible()
    await expect(page.locator('.wiki-link-completion')).toContainText('Deep Heading')
    await expect(page.locator('.wiki-link-completion')).toContainText('当前文档 · H2')

    await page.keyboard.press('Enter')
    await expect(page.locator('.cm-content')).toContainText('Link to [[#Deep Heading]]')
    await page.keyboard.press('Control+S')
    await expect.poll(() => readWorkspaceFile(page, '/workspace/wiki-heading-completion.md')).toContain('[[#Deep Heading]]')
  })

  test('Wiki Link 当前文档标题补全会忽略代码块里的标题', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/wiki-heading-fence-completion.md', '# Source')
    await loadDemoWorkspace(page)
    await page.getByRole('treeitem', { name: 'wiki-heading-fence-completion.md' }).click()
    await setEditorContent(page, [
      '# Source',
      '',
      '```md',
      '## Fake Heading',
      '```',
      '',
      '## Real Heading',
      '',
      'Link to ',
    ].join('\n'))

    await page.keyboard.insertText('[[#')
    await expect(page.locator('.wiki-link-completion')).toBeVisible()
    await expect(page.locator('.wiki-link-completion')).toContainText('Real Heading')
    await expect(page.locator('.wiki-link-completion')).not.toContainText('Fake Heading')
  })

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

  test('Wiki Link 跨文档标题补全会忽略目标代码块里的标题', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/Heading Fence Target.md', [
      '# Heading Fence Target',
      '',
      '~~~md',
      '## Fake Heading',
      '~~~',
      '',
      '## Real Heading',
      '',
      'details',
    ].join('\n'))
    await createWorkspaceFile(page, '/workspace/cross-heading-fence-source.md', '# Source')
    await loadDemoWorkspace(page)
    await page.getByRole('treeitem', { name: 'cross-heading-fence-source.md' }).click()
    await setEditorContent(page, 'See ')

    await page.keyboard.insertText('[[Heading Fence Target#')
    await expect(page.locator('.wiki-link-completion')).toBeVisible()
    await expect(page.locator('.wiki-link-completion')).toContainText('Real Heading')
    await expect(page.locator('.wiki-link-completion')).not.toContainText('Fake Heading')
  })

  test('Wiki Link 补全无匹配时显示空状态并可用 Escape 关闭', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/Alpha Note.md', '# Alpha Note')
    await createWorkspaceFile(page, '/workspace/wiki-completion-empty.md', '# Source')
    await loadDemoWorkspace(page)
    await page.getByRole('treeitem', { name: 'wiki-completion-empty.md' }).click()
    await setEditorContent(page, 'Link to ')

    await page.keyboard.insertText('[[zz-no-match')
    await expect(page.locator('.wiki-link-completion')).toBeVisible()
    await expect(page.locator('.wiki-link-completion')).toContainText('没有匹配笔记')

    await page.keyboard.press('Escape')
    await expect(page.locator('.wiki-link-completion')).toHaveCount(0)
    await expect(page.locator('.cm-content')).toContainText('Link to [[zz-no-match')
  })

  test('Live Preview 任务复选框会写回 Markdown 源码', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '- [ ] task item')

    const checkbox = page.locator('.cm-live-preview-checkbox')
    const previewCheckbox = page.locator('.preview-content input[type="checkbox"]')
    await expect(checkbox).toBeVisible()
    await expect(previewCheckbox).toHaveCount(1)
    await checkbox.click()
    await expect(checkbox).toBeChecked()
    await expect(previewCheckbox.first()).toBeChecked()
    await page.keyboard.press('Control+S')
    await expect.poll(() => readWorkspaceFile(page, '/workspace/README.md')).toContain('- [x] task item')

    await checkbox.click()
    await expect(checkbox).not.toBeChecked()
    await expect(previewCheckbox.first()).not.toBeChecked()
    await page.keyboard.press('Control+S')
    await expect.poll(() => readWorkspaceFile(page, '/workspace/README.md')).toContain('- [ ] task item')
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

  test('查找替换支持正则捕获组替换', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/README.md', 'alpha-123 beta-456')
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)

    await page.keyboard.press('Control+h')
    await expect(page.locator('.find-replace-panel')).toBeVisible()
    await page.getByText('正则表达式').click()
    await page.getByPlaceholder('查找...').fill('(\\w+)-(\\d+)')
    await page.getByPlaceholder('替换为...').fill('$2:$1')
    await page.getByRole('button', { name: '全部替换' }).click()
    await page.keyboard.press('Control+S')
    await expect(page.locator('.save-status')).toContainText('保存成功')

    const content = await readWorkspaceFile(page, '/workspace/README.md')
    expect(content).toContain('123:alpha 456:beta')
  })

  test('查找替换遇到无效正则会显示错误且保留内容', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/README.md', 'alpha beta')
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)

    await page.keyboard.press('Control+f')
    await expect(page.locator('.find-replace-panel')).toBeVisible()
    await page.getByText('正则表达式').click()
    await page.getByPlaceholder('查找...').fill('[')
    await page.keyboard.press('Enter')

    await expect(page.locator('.find-replace-panel [role="alert"]')).toContainText('正则表达式无效')
    await expect(page.locator('.cm-content')).toContainText('alpha beta')
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

  test('大纲面板会忽略代码块里的标题', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, [
      '# First',
      '',
      '```md',
      '## Fake Heading',
      '```',
      '',
      '## Real Heading',
    ].join('\n'))

    await page.getByRole('menuitem', { name: '文档大纲' }).click()
    await expect(page.locator('.outline-item').filter({ hasText: 'First' })).toBeVisible()
    await expect(page.locator('.outline-item').filter({ hasText: 'Real Heading' })).toBeVisible()
    await expect(page.locator('.outline-item').filter({ hasText: 'Fake Heading' })).toHaveCount(0)
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
