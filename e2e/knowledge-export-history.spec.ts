import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import {
  createWorkspaceFile,
  loadDemoWorkspace,
  openFirstMarkdownFile,
  readWorkspaceFile,
  resetBrowserState,
  runCommand,
  selectTemplate,
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
    await page.getByRole('button', { name: '使用README模板' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: '从模板创建' })).toHaveCount(0)

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

  test('HTML 导出会规范文件名并净化危险内容', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, [
      '# Export Safety',
      '',
      '<script>alert(1)</script>',
      '',
      '<img src=x onerror=alert(1)>',
    ].join('\n'))

    await page.getByLabel('导出', { exact: true }).click()
    await page.getByRole('menuitem', { name: '导出...' }).click()
    await expect(page.getByRole('dialog', { name: '导出文档' })).toBeVisible()
    await expect(page.locator('.el-dialog').filter({ hasText: '导出文档' }).locator('input').last()).toHaveValue('README')
    await page.locator('.el-radio-button').filter({ hasText: 'HTML' }).click()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('dialog', { name: '导出文档' }).getByRole('button', { name: '导出' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('README.html')
    const downloadedPath = await download.path()
    expect(downloadedPath).toBeTruthy()
    const html = await readFile(downloadedPath!, 'utf8')
    expect(html).not.toContain('<script')
    expect(html).not.toMatch(/<[^>]+\sonerror=/i)
    expect(html).toContain('Export Safety')
  })

  test('HTML 导出包含目录时目录链接指向正文标题锚点', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, [
      '# Export Heading',
      '',
      '## Export Heading',
      '',
      '### 标题 特殊字符 & Link',
      '',
      '正文内容。',
    ].join('\n'))

    await page.getByLabel('导出', { exact: true }).click()
    await page.getByRole('menuitem', { name: '导出...' }).click()
    await expect(page.getByRole('dialog', { name: '导出文档' })).toBeVisible()
    await page.locator('.el-radio-button').filter({ hasText: 'HTML' }).click()
    await page.locator('.el-form-item').filter({ hasText: '包含目录' }).locator('.el-switch').click()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('dialog', { name: '导出文档' }).getByRole('button', { name: '导出' }).click()
    const download = await downloadPromise
    const downloadedPath = await download.path()
    expect(downloadedPath).toBeTruthy()
    const html = await readFile(downloadedPath!, 'utf8')

    expect(html).toContain('<nav class="export-toc"')
    expect(html).toContain('href="#export-heading"')
    expect(html).toContain('id="export-heading"')
    expect(html).toContain('href="#export-heading-1"')
    expect(html).toContain('id="export-heading-1"')
    expect(html).toContain('href="#%E6%A0%87%E9%A2%98-%E7%89%B9%E6%AE%8A%E5%AD%97%E7%AC%A6-%26-link"')
    expect(html).toContain('id="%E6%A0%87%E9%A2%98-%E7%89%B9%E6%AE%8A%E5%AD%97%E7%AC%A6-%26-link"')
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

  test('文件重命名会同步迁移版本历史和 RAG 文档索引', async ({ page }) => {
    await loadDemoWorkspace(page)
    const suffix = Date.now()
    const oldPath = `/workspace/Lifecycle-${suffix}.md`
    const newPath = `/workspace/Lifecycle-Renamed-${suffix}.md`
    const token = `rename-token-${suffix}`

    const result = await page.evaluate(async ({ oldPath, newPath, token }) => {
      const { fileSystem } = await import('/src/services/fileSystem.ts')
      const { versionHistory } = await import('/src/services/versionHistory.ts')
      const { ragService } = await import('/src/services/rag.ts')
      await fileSystem.init()
      await fileSystem.writeFile(oldPath, `# Lifecycle\n\n${token}`)
      await versionHistory.saveSnapshot(oldPath, `# Snapshot\n\n${token}`, 'rename snapshot')
      await ragService.indexDocument(oldPath, `RAG content ${token}`)

      await fileSystem.renameFile(oldPath, newPath)

      return {
        oldSnapshots: await versionHistory.getSnapshots(oldPath),
        newSnapshots: await versionHistory.getSnapshots(newPath),
        documents: await ragService.listDocuments(),
        searchResults: await ragService.search(token, 10),
      }
    }, { oldPath, newPath, token })

    expect(result.oldSnapshots).toHaveLength(0)
    expect(result.newSnapshots).toHaveLength(1)
    expect(result.documents.some(doc => doc.filePath === oldPath)).toBe(false)
    expect(result.documents.some(doc => doc.filePath === newPath)).toBe(true)
    expect(result.searchResults.map(item => item.filePath)).toContain(newPath)
    expect(result.searchResults.map(item => item.filePath)).not.toContain(oldPath)
  })

  test('文件删除会清理版本历史和 RAG 文档索引', async ({ page }) => {
    await loadDemoWorkspace(page)
    const suffix = Date.now()
    const path = `/workspace/RemoveMe-${suffix}.md`
    const token = `delete-token-${suffix}`

    const result = await page.evaluate(async ({ path, token }) => {
      const { fileSystem } = await import('/src/services/fileSystem.ts')
      const { versionHistory } = await import('/src/services/versionHistory.ts')
      const { ragService } = await import('/src/services/rag.ts')
      await fileSystem.init()
      await fileSystem.writeFile(path, `# Remove Me\n\n${token}`)
      await versionHistory.saveSnapshot(path, `# Snapshot\n\n${token}`, 'delete snapshot')
      await ragService.indexDocument(path, `RAG content ${token}`)

      await fileSystem.deleteFile(path)

      return {
        snapshots: await versionHistory.getSnapshots(path),
        documents: await ragService.listDocuments(),
        searchResults: await ragService.search(token, 10),
      }
    }, { path, token })

    expect(result.snapshots).toHaveLength(0)
    expect(result.documents.some(doc => doc.filePath === path)).toBe(false)
    expect(result.searchResults.map(item => item.filePath)).not.toContain(path)
  })

  test('文件夹重命名会同步迁移子文件的版本历史和 RAG 文档索引', async ({ page }) => {
    await loadDemoWorkspace(page)
    const suffix = Date.now()
    const oldFolder = `/workspace/FolderA-${suffix}`
    const newFolder = `/workspace/FolderB-${suffix}`
    const oldPath = `${oldFolder}/Nested.md`
    const newPath = `${newFolder}/Nested.md`
    const token = `folder-rename-token-${suffix}`

    const result = await page.evaluate(async ({ oldFolder, newFolder, oldPath, newPath, token }) => {
      const { fileSystem } = await import('/src/services/fileSystem.ts')
      const { versionHistory } = await import('/src/services/versionHistory.ts')
      const { ragService } = await import('/src/services/rag.ts')
      await fileSystem.init()
      await fileSystem.createDirectory(oldFolder)
      await fileSystem.writeFile(oldPath, `# Nested\n\n${token}`)
      await versionHistory.saveSnapshot(oldPath, `# Snapshot\n\n${token}`, 'folder rename snapshot')
      await ragService.indexDocument(oldPath, `RAG content ${token}`)

      await fileSystem.renameFile(oldFolder, newFolder)

      return {
        oldSnapshots: await versionHistory.getSnapshots(oldPath),
        newSnapshots: await versionHistory.getSnapshots(newPath),
        documents: await ragService.listDocuments(),
        searchResults: await ragService.search(token, 10),
      }
    }, { oldFolder, newFolder, oldPath, newPath, token })

    expect(result.oldSnapshots).toHaveLength(0)
    expect(result.newSnapshots).toHaveLength(1)
    expect(result.documents.some(doc => doc.filePath === oldPath)).toBe(false)
    expect(result.documents.some(doc => doc.filePath === newPath)).toBe(true)
    expect(result.searchResults.map(item => item.filePath)).toContain(newPath)
    expect(result.searchResults.map(item => item.filePath)).not.toContain(oldPath)
  })

  test('文件夹删除会清理子文件的版本历史和 RAG 文档索引', async ({ page }) => {
    await loadDemoWorkspace(page)
    const suffix = Date.now()
    const folder = `/workspace/DeleteFolder-${suffix}`
    const path = `${folder}/Nested.md`
    const token = `folder-delete-token-${suffix}`

    const result = await page.evaluate(async ({ folder, path, token }) => {
      const { fileSystem } = await import('/src/services/fileSystem.ts')
      const { versionHistory } = await import('/src/services/versionHistory.ts')
      const { ragService } = await import('/src/services/rag.ts')
      await fileSystem.init()
      await fileSystem.createDirectory(folder)
      await fileSystem.writeFile(path, `# Nested\n\n${token}`)
      await versionHistory.saveSnapshot(path, `# Snapshot\n\n${token}`, 'folder delete snapshot')
      await ragService.indexDocument(path, `RAG content ${token}`)

      await fileSystem.deleteFile(folder)

      return {
        snapshots: await versionHistory.getSnapshots(path),
        documents: await ragService.listDocuments(),
        searchResults: await ragService.search(token, 10),
      }
    }, { folder, path, token })

    expect(result.snapshots).toHaveLength(0)
    expect(result.documents.some(doc => doc.filePath === path)).toBe(false)
    expect(result.searchResults.map(item => item.filePath)).not.toContain(path)
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

  test('知识图谱搜索结果可以打开对应笔记', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/Graph Alpha.md', [
      '# Graph Alpha',
      '',
      'Linked to [[Graph Beta]].',
    ].join('\n'))
    await createWorkspaceFile(page, '/workspace/Graph Beta.md', '# Graph Beta\n\nGraph search target body.')
    await loadDemoWorkspace(page)
    await page.locator('.tree-node-label').filter({ hasText: 'Graph Alpha.md' }).click()
    await page.getByRole('menuitem', { name: '知识图谱' }).click()
    await page.getByRole('button', { name: '刷新知识索引' }).click()
    await page.getByRole('tab', { name: '图谱' }).click()

    await page.getByPlaceholder('搜索笔记...').fill('Graph Beta')
    const result = page.getByRole('button', { name: /打开图谱节点 Graph Beta/ })
    await expect(result).toBeVisible()
    await result.click()

    await expect(page.locator('.tabs-bar')).toContainText('Graph Beta.md')
    await expect(page.locator('.cm-content')).toContainText('Graph search target body.')
  })

  test('知识图谱当前笔记模式只展示一跳邻域并限制搜索范围', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/Graph Focus Alpha.md', '# Graph Focus Alpha\n\n[[Graph Focus Beta]]')
    await createWorkspaceFile(page, '/workspace/Graph Focus Beta.md', '# Graph Focus Beta')
    await createWorkspaceFile(page, '/workspace/Graph Focus Isolated.md', '# Graph Focus Isolated')
    await loadDemoWorkspace(page)
    await page.locator('.tree-node-label').filter({ hasText: 'Graph Focus Alpha.md' }).click()
    await page.getByRole('menuitem', { name: '知识图谱' }).click()
    await page.getByRole('button', { name: '刷新知识索引' }).click()
    await page.getByRole('tab', { name: '图谱' }).click()

    await page.getByRole('button', { name: '当前笔记图谱' }).click()
    await expect(page.locator('.graph-focus-summary')).toContainText('Graph Focus Alpha')
    await expect(page.locator('.graph-focus-summary')).toContainText('1 个邻居')
    await expect(page.locator('.graph-stats')).toContainText('节点: 2')
    await expect(page.locator('.graph-stats')).toContainText('链接: 1')

    await page.getByPlaceholder('搜索笔记...').fill('Isolated')
    await expect(page.locator('.graph-search-empty')).toContainText('没有匹配笔记')

    await page.getByRole('button', { name: '全局图谱' }).click()
    await expect(page.getByRole('button', { name: /打开图谱节点 Graph Focus Isolated/ })).toBeVisible()
  })

  test('知识图谱卸载时会清理鼠标监听', async ({ page }) => {
    await page.addInitScript(() => {
      const counters = { added: 0, removed: 0, active: 0 }
      const listeners = new WeakMap<Element, Set<EventListenerOrEventListenerObject>>()
      const originalAddEventListener = Element.prototype.addEventListener
      const originalRemoveEventListener = Element.prototype.removeEventListener

      Object.defineProperty(window, '__graphMouseCounters', {
        configurable: true,
        value: counters,
      })

      Element.prototype.addEventListener = function addEventListenerWithGraphCounter(type, listener, options) {
        if (type === 'mousemove' && listener && this.classList.contains('graph-canvas')) {
          let elementListeners = listeners.get(this)
          if (!elementListeners) {
            elementListeners = new Set()
            listeners.set(this, elementListeners)
          }
          if (!elementListeners.has(listener)) {
            elementListeners.add(listener)
            counters.added += 1
            counters.active += 1
          }
        }
        return originalAddEventListener.call(this, type, listener, options)
      }

      Element.prototype.removeEventListener = function removeEventListenerWithGraphCounter(type, listener, options) {
        if (type === 'mousemove' && listener && this.classList.contains('graph-canvas')) {
          const elementListeners = listeners.get(this)
          if (elementListeners?.has(listener)) {
            elementListeners.delete(listener)
            counters.removed += 1
            counters.active -= 1
          }
        }
        return originalRemoveEventListener.call(this, type, listener, options)
      }
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.app-container')).toBeVisible()

    await createWorkspaceFile(page, '/workspace/Graph Listener Alpha.md', '# Graph Listener Alpha\n\n[[Graph Listener Beta]]')
    await createWorkspaceFile(page, '/workspace/Graph Listener Beta.md', '# Graph Listener Beta')
    await loadDemoWorkspace(page)
    await page.locator('.tree-node-label').filter({ hasText: 'Graph Listener Alpha.md' }).click()
    await page.getByRole('menuitem', { name: '知识图谱' }).click()
    await page.getByRole('button', { name: '刷新知识索引' }).click()
    await page.getByRole('tab', { name: '图谱' }).click()
    await expect(page.locator('.graph-canvas svg')).toBeVisible()

    await expect.poll(() => page.evaluate(() => (window as any).__graphMouseCounters.active)).toBe(1)
    await page.getByRole('menuitem', { name: '设置' }).click()
    await expect(page.locator('.panel-title')).toContainText('设置')
    await expect.poll(() => page.evaluate(() => (window as any).__graphMouseCounters.active)).toBe(0)
    const counters = await page.evaluate(() => (window as any).__graphMouseCounters)
    expect(counters.added).toBe(counters.removed)
  })

  test('知识面板点击反链会打开来源并定位到 Wiki Link 行', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/Target.md', '# Target Note\n\nReference target.')
    await createWorkspaceFile(page, '/workspace/Source.md', [
      '# Source Note',
      '',
      'Intro paragraph.',
      '',
      'The backlink to [[Target Note]] lives here.',
    ].join('\n'))
    await loadDemoWorkspace(page)
    await page.locator('.tree-node-label').filter({ hasText: 'Target.md' }).click()
    await page.getByRole('menuitem', { name: '知识图谱' }).click()
    await page.getByRole('button', { name: '刷新知识索引' }).click()

    await page.getByRole('tab', { name: /反链/ }).click()
    const backlink = page.locator('.reference-item').filter({ hasText: 'Source Note' })
    await expect(backlink).toContainText('L5')
    await backlink.click()

    await expect(page.locator('.tabs-bar')).toContainText('Source.md')
    await expect(page.locator('.status-bar')).toContainText('行 5')
    await expect(page.locator('.cm-line').nth(4)).toContainText('The backlink to [[Target Note]] lives here.')
  })

  test('知识面板点击未链接提及会打开来源并定位到提及行', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/MentionTarget.md', [
      '---',
      'title: Mention Target',
      'aliases: [FocusTerm]',
      '---',
      '',
      '# Mention Target',
    ].join('\n'))
    await createWorkspaceFile(page, '/workspace/MentionSource.md', [
      '# Mention Source',
      '',
      'Opening context.',
      '',
      'FocusTerm appears here without a wiki link.',
    ].join('\n'))
    await loadDemoWorkspace(page)
    await page.locator('.tree-node-label').filter({ hasText: 'MentionTarget.md' }).click()
    await page.getByRole('menuitem', { name: '知识图谱' }).click()
    await page.getByRole('button', { name: '刷新知识索引' }).click()

    await page.getByRole('tab', { name: /提及/ }).click()
    const mention = page.locator('.reference-item').filter({ hasText: 'Mention Source' })
    await expect(mention).toContainText('L5')
    await mention.click()

    await expect(page.locator('.tabs-bar')).toContainText('MentionSource.md')
    await expect(page.locator('.status-bar')).toContainText('行 5')
    await expect(page.locator('.cm-line').nth(4)).toContainText('FocusTerm appears here without a wiki link.')
  })

  test('知识面板 Outgoing Link 点击会打开已有目标文档', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/Outgoing Source.md', [
      '# Outgoing Source',
      '',
      'Jump to [[Outgoing Target]].',
    ].join('\n'))
    await createWorkspaceFile(page, '/workspace/Outgoing Target.md', '# Outgoing Target\n\nTarget body.')
    await loadDemoWorkspace(page)
    await page.locator('.tree-node-label').filter({ hasText: 'Outgoing Source.md' }).click()
    await page.getByRole('menuitem', { name: '知识图谱' }).click()
    await page.getByRole('button', { name: '刷新知识索引' }).click()

    await page.locator('.link-chip').filter({ hasText: '[[Outgoing Target]]' }).click()

    await expect(page.locator('.tabs-bar')).toContainText('Outgoing Target.md')
    await expect(page.locator('.cm-content')).toContainText('Target body.')
  })

  test('知识面板 Outgoing Link 点击缺失目标会创建并打开文档', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/Idea Source.md', [
      '# Idea Source',
      '',
      'Capture [[Knowledge Missing]] later.',
    ].join('\n'))
    await loadDemoWorkspace(page)
    await page.locator('.tree-node-label').filter({ hasText: 'Idea Source.md' }).click()
    await page.getByRole('menuitem', { name: '知识图谱' }).click()
    await page.getByRole('button', { name: '刷新知识索引' }).click()

    await page.locator('.link-chip').filter({ hasText: '[[Knowledge Missing]]' }).click()

    await expect(page.locator('.tabs-bar')).toContainText('Knowledge Missing.md')
    const content = await readWorkspaceFile(page, '/workspace/Knowledge Missing.md')
    expect(content).toBe('# Knowledge Missing\n')
  })

  test('知识面板一键链接未链接提及会写回 Wiki Link', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/Link Target.md', [
      '---',
      'title: Link Target',
      'aliases: [LinkMe]',
      '---',
      '',
      '# Link Target',
    ].join('\n'))
    await createWorkspaceFile(page, '/workspace/Link Source.md', [
      '# Link Source',
      '',
      'LinkMe deserves a direct note link.',
    ].join('\n'))
    await loadDemoWorkspace(page)
    await page.locator('.tree-node-label').filter({ hasText: 'Link Target.md' }).click()
    await page.getByRole('menuitem', { name: '知识图谱' }).click()
    await page.getByRole('button', { name: '刷新知识索引' }).click()
    await page.getByRole('tab', { name: /提及/ }).click()

    const mention = page.locator('.reference-item').filter({ hasText: 'Link Source' })
    await expect(mention).toContainText('L3')
    await mention.getByRole('button', { name: '链接' }).click()

    await expect(page.getByText('已链接提及')).toBeVisible()
    const updated = await readWorkspaceFile(page, '/workspace/Link Source.md')
    expect(updated).toContain('[[Link Target]] deserves a direct note link.')

    await page.getByRole('button', { name: '刷新知识索引' }).click()
    await expect(page.getByText('暂无未链接提及')).toBeVisible()
    await expect(page.locator('.reference-item:visible').filter({ hasText: 'Link Source' })).toHaveCount(0)
  })

  test('窄屏下导出弹窗、模板弹窗、语法参考和 AI 面板不产生横向溢出', async ({ page }) => {
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await page.setViewportSize({ width: 390, height: 740 })

    const expectNoOverflow = async () => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(1)
    }
    const expectDialogWithinViewport = async (name: string) => {
      await expect(page.getByRole('dialog', { name })).toBeVisible()
      const dialog = page.locator('.el-dialog').filter({ hasText: name }).last()
      const box = await dialog.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(390)
      await expectNoOverflow()
    }

    await page.getByRole('button', { name: 'AI 助手' }).click()
    await expect(page.locator('.ai-panel-section')).toBeVisible()
    await page.getByRole('button', { name: '导出' }).click()
    await page.getByRole('menuitem', { name: '导出...' }).click()
    await expectDialogWithinViewport('导出文档')
    await page.keyboard.press('Escape')

    await runCommand(page, '从模板新建')
    await expectDialogWithinViewport('从模板创建')
    await page.keyboard.press('Escape')

    await runCommand(page, 'Markdown 速查表')
    await expectDialogWithinViewport('Markdown 语法参考')
  })

  test('模板创建后的内容可以保存到工作区', async ({ page }) => {
    await loadDemoWorkspace(page)
    await runCommand(page, '从模板新建')
    await selectTemplate(page, '博客文章')
    await page.keyboard.press('Control+S')
    await expect(page.locator('.save-status')).toContainText('保存成功')

    const content = await readWorkspaceFile(page, '/workspace/博客文章.md')
    expect(content).toContain('一句话描述')
  })
})
