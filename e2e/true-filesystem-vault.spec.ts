import { expect, test, type Page } from '@playwright/test'
import { openApp, runCommand, setEditorContent } from './helpers'

async function installMockElectronVault(page: Page) {
  await page.addInitScript(() => {
    type MockRecord = {
      path: string
      name: string
      content: string
      isDirectory: boolean
      parentPath: string
      createdAt: number
      updatedAt: number
      size: number
    }

    const ROOT = '/workspace'
    const OPENED_STORAGE_KEY = 'mock-electron-vault-opened'
    let opened = window.localStorage.getItem(OPENED_STORAGE_KEY) === 'true'
    const changeListeners = new Set<(event: { rootPath: string; path?: string; reason?: string; at?: number }) => void>()
    const directories = new Set([ROOT, `${ROOT}/docs`])
    const fileContents = new Map<string, string>([
      [`${ROOT}/README.md`, '# Native Vault\n\n[[docs/Alpha]] links into docs.'],
      [`${ROOT}/docs/Alpha.md`, '# Alpha\n\nnative-search-token'],
    ])

    const now = () => 1_782_000_000_000
    const nameOf = (path: string) => path.split('/').pop() || 'workspace'
    const parentOf = (path: string) => path.substring(0, path.lastIndexOf('/')) || '/'
    const isMarkdown = (path: string) => /\.(md|markdown)$/i.test(path)
    const mimeFor = (path: string) => {
      const lower = path.toLowerCase()
      if (lower.endsWith('.svg')) return 'image/svg+xml'
      if (lower.endsWith('.mp3')) return 'audio/mpeg'
      if (lower.endsWith('.mp4')) return 'video/mp4'
      if (lower.endsWith('.pdf')) return 'application/pdf'
      return 'image/png'
    }

    const assertOpened = () => {
      if (!opened) throw new Error('Mock vault is not open')
    }

    const recordForDirectory = (path: string): MockRecord => ({
      path,
      name: nameOf(path),
      content: '',
      isDirectory: true,
      parentPath: parentOf(path),
      createdAt: now(),
      updatedAt: now(),
      size: 0,
    })

    const recordForFile = (path: string, content: string): MockRecord => ({
      path,
      name: nameOf(path),
      content,
      isDirectory: false,
      parentPath: parentOf(path),
      createdAt: now(),
      updatedAt: now(),
      size: content.length,
    })

    const ensureParentDirectory = (path: string) => {
      const parentPath = parentOf(path)
      if (!directories.has(parentPath)) throw new Error(`Parent directory does not exist: ${parentPath}`)
    }

    const emitChange = (path: string, reason = 'change') => {
      const event = { rootPath: ROOT, path, reason, at: Date.now() }
      for (const listener of changeListeners) listener(event)
    }

    ;(window as any).__mockElectronVaultExternalWrite = (path: string, content: string) => {
      assertOpened()
      ensureParentDirectory(path)
      fileContents.set(path, content)
      emitChange(path, 'change')
    }
    ;(window as any).__mockElectronVaultExternalBatchWrite = (entries: Array<[string, string]>) => {
      assertOpened()
      for (const [path, content] of entries) {
        ensureParentDirectory(path)
        fileContents.set(path, content)
      }
      emitChange(ROOT, 'change')
    }
    ;(window as any).__mockElectronVaultExternalDelete = (path: string) => {
      assertOpened()
      fileContents.delete(path)
      emitChange(path, 'delete')
    }
    ;(window as any).__mockElectronVaultListenerCount = () => changeListeners.size

    ;(window as any).aiNativeVault = {
      async openDirectory() {
        opened = true
        window.localStorage.setItem(OPENED_STORAGE_KEY, 'true')
        return { rootPath: ROOT, nativePath: '/tmp/mock-native-vault' }
      },

      async getState() {
        return opened
          ? { rootPath: ROOT, nativePath: '/tmp/mock-native-vault' }
          : { rootPath: '' }
      },

      async readDirectory(path: string) {
        assertOpened()
        if (!directories.has(path)) throw new Error(`Directory does not exist: ${path}`)

        const childDirectories = [...directories]
          .filter(childPath => childPath !== path && parentOf(childPath) === path)
          .map(recordForDirectory)
        const childFiles = [...fileContents.entries()]
          .filter(([childPath]) => parentOf(childPath) === path)
          .map(([childPath, content]) => recordForFile(childPath, content))

        return [...childDirectories, ...childFiles]
      },

      async getAllMarkdownFiles() {
        assertOpened()
        return [...fileContents.entries()]
          .filter(([path]) => isMarkdown(path))
          .map(([path, content]) => recordForFile(path, content))
      },

      async readFile(path: string) {
        assertOpened()
        const content = fileContents.get(path)
        if (content === undefined) throw new Error(`File does not exist: ${path}`)
        return content
      },

      async readAsset(path: string) {
        assertOpened()
        const content = fileContents.get(path)
        if (content === undefined) throw new Error(`File does not exist: ${path}`)
        return content.startsWith('data:') ? content : `data:${mimeFor(path)};base64,${content}`
      },

      async writeFile(path: string, content: string) {
        assertOpened()
        ensureParentDirectory(path)
        if (directories.has(path)) throw new Error(`Path is a directory: ${path}`)
        fileContents.set(path, content)
      },

      async createFile(path: string) {
        assertOpened()
        ensureParentDirectory(path)
        if (fileContents.has(path) || directories.has(path)) throw new Error(`Path already exists: ${path}`)
        fileContents.set(path, '')
      },

      async createDirectory(path: string) {
        assertOpened()
        ensureParentDirectory(path)
        if (fileContents.has(path) || directories.has(path)) throw new Error(`Path already exists: ${path}`)
        directories.add(path)
      },

      async deletePath(path: string) {
        assertOpened()
        if (directories.has(path)) {
          for (const dirPath of [...directories]) {
            if (dirPath === path || dirPath.startsWith(`${path}/`)) directories.delete(dirPath)
          }
          for (const filePath of [...fileContents.keys()]) {
            if (filePath.startsWith(`${path}/`)) fileContents.delete(filePath)
          }
          return
        }
        fileContents.delete(path)
      },

      async renamePath(oldPath: string, newPath: string) {
        assertOpened()
        ensureParentDirectory(newPath)

        const renamedPaths: Array<{ oldPath: string; newPath: string; isDirectory: boolean }> = []
        if (directories.has(oldPath)) {
          const directoryPaths = [...directories]
            .filter(path => path === oldPath || path.startsWith(`${oldPath}/`))
            .sort((a, b) => a.length - b.length)
          for (const path of directoryPaths) {
            const renamedPath = path === oldPath ? newPath : `${newPath}${path.slice(oldPath.length)}`
            directories.delete(path)
            directories.add(renamedPath)
            renamedPaths.push({ oldPath: path, newPath: renamedPath, isDirectory: true })
          }
          for (const [path, content] of [...fileContents.entries()]) {
            if (!path.startsWith(`${oldPath}/`)) continue
            const renamedPath = `${newPath}${path.slice(oldPath.length)}`
            fileContents.delete(path)
            fileContents.set(renamedPath, content)
            renamedPaths.push({ oldPath: path, newPath: renamedPath, isDirectory: false })
          }
        } else {
          const content = fileContents.get(oldPath)
          if (content === undefined) throw new Error(`Path does not exist: ${oldPath}`)
          fileContents.delete(oldPath)
          fileContents.set(newPath, content)
          renamedPaths.push({ oldPath, newPath, isDirectory: false })
        }

        return { renamedPaths, updatedLinkPaths: [] }
      },

      onDidChange(listener: (event: { rootPath: string; path?: string; reason?: string; at?: number }) => void) {
        changeListeners.add(listener)
        return () => changeListeners.delete(listener)
      },
    }
  })
}

async function openMockNativeVault(page: Page) {
  await page.getByRole('complementary').getByRole('button', { name: /^打开文件夹$/ }).click()
  await expect(page.locator('.tree-node').filter({ hasText: 'README.md' })).toBeVisible()
}

async function enableLivePreview(page: Page) {
  const livePreviewButton = page.locator('.editor-toolbar').getByRole('button', { name: '实时预览' })
  const isEnabled = await livePreviewButton.evaluate(el => el.classList.contains('el-button--primary'))
  if (!isEnabled) await livePreviewButton.click()
}

test.describe('true filesystem vault backend', () => {
  test('vaultService switches to the Electron filesystem bridge', async ({ page }) => {
    await installMockElectronVault(page)
    await openApp(page)

    const result = await page.evaluate(async () => {
      const { vaultService } = await import('/src/services/vault/index.ts')

      await vaultService.useIndexedDbWorkspace()
      const kindBeforeOpen = vaultService.kind
      const opened = await vaultService.openDirectory()
      const kindAfterOpen = vaultService.kind
      const rootEntries = await vaultService.readDirectory('/workspace')

      await vaultService.writeFile('/workspace/docs/New.md', '# New\n\nnative-search-token in new file')
      await vaultService.createDirectory('/workspace/drafts')
      await vaultService.createFile('/workspace/drafts/empty.md')

      const searchResults = await vaultService.searchFiles('native-search-token')
      const renameResult = await vaultService.renamePath('/workspace/docs', '/workspace/renamed-docs')
      const renamedContent = await vaultService.readFile('/workspace/renamed-docs/New.md')
      const oldPathContent = await vaultService.readFileOrEmpty('/workspace/docs/New.md')
      const allMarkdownPaths = (await vaultService.getAllMarkdownFiles()).map(file => file.path).sort()
      const importCount = await vaultService.importFromPicker()

      return {
        kindBeforeOpen,
        kindAfterOpen,
        opened,
        rootEntryNames: rootEntries.map(entry => entry.name).sort(),
        searchFilePaths: searchResults.map(result => result.filePath).sort(),
        renameResult,
        renamedContent,
        oldPathContent,
        allMarkdownPaths,
        importCount,
      }
    })

    expect(result.kindBeforeOpen).toBe('indexeddb')
    expect(result.kindAfterOpen).toBe('electron-fs')
    expect(result.opened).toEqual({ rootPath: '/workspace', nativePath: '/tmp/mock-native-vault' })
    expect(result.rootEntryNames).toEqual(['README.md', 'docs'])
    expect(result.searchFilePaths).toContain('/workspace/docs/Alpha.md')
    expect(result.searchFilePaths).toContain('/workspace/docs/New.md')
    expect(result.renameResult.renamedPaths).toEqual(expect.arrayContaining([
      { oldPath: '/workspace/docs', newPath: '/workspace/renamed-docs', isDirectory: true },
      { oldPath: '/workspace/docs/New.md', newPath: '/workspace/renamed-docs/New.md', isDirectory: false },
    ]))
    expect(result.renamedContent).toContain('native-search-token in new file')
    expect(result.oldPathContent).toBe('')
    expect(result.allMarkdownPaths).toContain('/workspace/renamed-docs/New.md')
    expect(result.allMarkdownPaths).toContain('/workspace/drafts/empty.md')
    expect(result.importCount).toBe(result.allMarkdownPaths.length)
  })

  test('demo workspace explicitly falls back to IndexedDB even when the bridge exists', async ({ page }) => {
    await installMockElectronVault(page)
    await openApp(page)

    await page.getByRole('button', { name: /^试用示例工作区$/ }).click()
    await expect(page.locator('.el-tree')).toBeVisible()

    const state = await page.evaluate(async () => {
      const { vaultService } = await import('/src/services/vault/index.ts')
      return {
        kind: vaultService.kind,
        paths: (await vaultService.getAllMarkdownFiles()).map(file => file.path).sort(),
      }
    })

    expect(state.kind).toBe('indexeddb')
    expect(state.paths).toContain('/workspace/README.md')
    expect(state.paths).toContain('/workspace/notes/Research Map.md')
  })

  test('external native vault changes refresh the file tree and unmodified open tabs', async ({ page }) => {
    await installMockElectronVault(page)
    await openApp(page)

    await openMockNativeVault(page)
    await page.locator('.tree-node').filter({ hasText: 'README.md' }).click()
    await expect(page.locator('.cm-content')).toContainText('Native Vault')
    await expect.poll(() => page.evaluate(() => (window as any).__mockElectronVaultListenerCount())).toBeGreaterThan(0)

    await page.evaluate(() => {
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/README.md', '# Native Vault Updated\n\nexternal-sync-token')
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/Outside.md', '# Outside\n\nexternal tree update')
    })
    await expect.poll(() => page.evaluate(async () => {
      const { vaultService } = await import('/src/services/vault/index.ts')
      return (await vaultService.readDirectory('/workspace')).map(file => file.name)
    })).toContain('Outside.md')

    await expect(page.locator('.tree-node').filter({ hasText: 'Outside.md' })).toBeVisible()
    await expect(page.locator('.cm-content')).toContainText('external-sync-token')
    await expect(page.locator('.vault-conflict-banner')).toHaveCount(0)

    await setEditorContent(page, '# Unsaved Local\n\nkeep-local-token')
    await page.evaluate(() => {
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/README.md', '# Native Vault Remote\n\nshould-not-overwrite-unsaved')
    })

    await expect(page.locator('.vault-conflict-banner')).toContainText('磁盘上的文件已更新')
    await expect(page.locator('.vault-conflict-banner')).toContainText('差异预览')
    await expect(page.locator('.vault-conflict-banner')).toContainText('本地')
    await expect(page.locator('.vault-conflict-banner')).toContainText('keep-local-token')
    await expect(page.locator('.vault-conflict-banner')).toContainText('磁盘')
    await expect(page.locator('.vault-conflict-banner')).toContainText('should-not-overwrite-unsaved')
    await expect(page.locator('.cm-content')).toContainText('keep-local-token')
    await expect(page.locator('.cm-content')).not.toContainText('should-not-overwrite-unsaved')

    await page.getByRole('button', { name: '保留本地版本' }).click()
    await expect(page.locator('.vault-conflict-banner')).toHaveCount(0)
    await expect(page.locator('.cm-content')).toContainText('keep-local-token')

    await page.evaluate(() => {
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/README.md', '# Native Vault Reloaded\n\nreload-disk-token')
    })
    await expect(page.locator('.vault-conflict-banner')).toContainText('磁盘上的文件已更新')
    await page.getByRole('button', { name: '重新载入磁盘版本' }).click()
    await expect(page.locator('.vault-conflict-banner')).toHaveCount(0)
    await expect(page.locator('.cm-content')).toContainText('reload-disk-token')
    await expect(page.locator('.cm-content')).not.toContainText('keep-local-token')
  })

  test('external native vault deletion preserves modified open tabs with explicit missing-file conflict', async ({ page }) => {
    await installMockElectronVault(page)
    await openApp(page)

    await openMockNativeVault(page)
    await page.locator('.tree-node').filter({ hasText: 'README.md' }).click()
    await expect(page.locator('.cm-content')).toContainText('Native Vault')

    await setEditorContent(page, '# Unsaved Local\n\nkeep-local-after-delete-token')
    await page.evaluate(() => {
      ;(window as any).__mockElectronVaultExternalDelete('/workspace/README.md')
    })

    const conflictBanner = page.locator('.vault-conflict-banner')
    await expect(conflictBanner).toContainText('磁盘上的文件已被删除')
    await expect(conflictBanner).toContainText('删除预览')
    await expect(conflictBanner).toContainText('磁盘文件缺失')
    await expect(conflictBanner).toContainText('本地')
    await expect(conflictBanner).toContainText('keep-local-after-delete-token')
    await expect(page.getByRole('button', { name: '重新载入磁盘版本' })).toHaveCount(0)
    await expect(page.locator('.cm-content')).toContainText('keep-local-after-delete-token')

    await page.getByRole('button', { name: '保留本地版本' }).click()
    await expect(conflictBanner).toHaveCount(0)
    await expect(page.locator('.cm-content')).toContainText('keep-local-after-delete-token')
  })

  test('external native vault conflicts can save local content to version history', async ({ page }) => {
    await installMockElectronVault(page)
    await openApp(page)

    await openMockNativeVault(page)
    await page.locator('.tree-node').filter({ hasText: 'README.md' }).click()
    await expect(page.locator('.cm-content')).toContainText('Native Vault')

    await setEditorContent(page, '# Unsaved Local\n\nsnapshot-local-conflict-token')
    await page.evaluate(() => {
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/README.md', '# Remote Update\n\nsnapshot-remote-conflict-token')
    })

    const conflictBanner = page.locator('.vault-conflict-banner')
    await expect(conflictBanner).toContainText('磁盘上的文件已更新')
    await conflictBanner.getByRole('button', { name: '保存本地快照' }).click()

    await expect.poll(() => page.evaluate(async () => {
      const { versionHistory } = await import('/src/services/versionHistory.ts')
      const snapshots = await versionHistory.getSnapshots('/workspace/README.md')
      return snapshots.at(-1)?.label || ''
    })).toBe('外部冲突：本地未保存版本')

    const snapshots = await page.evaluate(async () => {
      const { versionHistory } = await import('/src/services/versionHistory.ts')
      return versionHistory.getSnapshots('/workspace/README.md')
    })
    const latestSnapshot = snapshots.at(-1)
    expect(latestSnapshot?.label).toBe('外部冲突：本地未保存版本')
    expect(latestSnapshot?.content).toContain('snapshot-local-conflict-token')
    expect(latestSnapshot?.content).not.toContain('snapshot-remote-conflict-token')

    await conflictBanner.getByRole('button', { name: '版本历史' }).click()
    const historyDrawer = page.locator('.el-drawer').filter({ hasText: '版本历史' })
    await expect(historyDrawer.getByText('外部冲突：本地未保存版本')).toBeVisible()
    await expect(historyDrawer.getByText(/snapshot-remote-conflict-token/)).toHaveCount(0)
  })

  test('background native vault conflicts stay visible and can navigate to conflicted tabs', async ({ page }) => {
    await installMockElectronVault(page)
    await openApp(page)

    await openMockNativeVault(page)
    await page.evaluate(async () => {
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/Outside.md', '# Outside\n\nsafe-active-token')
      const { useEditorStore } = await import('/src/stores/editor.ts')
      const editorStore = useEditorStore()
      editorStore.addTab('/workspace/README.md', '# Native Vault\n\n[[docs/Alpha]] links into docs.')
      editorStore.setContent('# Local README\n\nlocal-readme-conflict-token')
      editorStore.addTab('/workspace/docs/Alpha.md', '# Alpha\n\nnative-search-token')
      editorStore.setContent('# Local Alpha\n\nlocal-alpha-conflict-token')
      editorStore.addTab('/workspace/Outside.md', '# Outside\n\nsafe-active-token')
    })
    await expect(page.locator('.cm-content')).toContainText('safe-active-token')

    await page.evaluate(() => {
      ;(window as any).__mockElectronVaultExternalBatchWrite([
        ['/workspace/README.md', '# Remote README\n\nremote-readme-conflict-token'],
        ['/workspace/docs/Alpha.md', '# Remote Alpha\n\nremote-alpha-conflict-token'],
      ])
    })

    const conflictOverview = page.locator('.vault-conflict-overview')
    await expect(conflictOverview).toContainText('2 个文件存在外部冲突')
    await expect(conflictOverview).toContainText('README.md')
    await expect(conflictOverview).toContainText('Alpha.md')
    await expect(page.locator('.vault-conflict-banner')).toHaveCount(0)
    await expect(page.locator('.cm-content')).toContainText('safe-active-token')

    await page.getByRole('button', { name: '查看冲突 README.md' }).click()
    const conflictBanner = page.locator('.vault-conflict-banner')
    await expect(conflictBanner).toContainText('磁盘上的文件已更新')
    await expect(conflictBanner).toContainText('local-readme-conflict-token')
    await expect(conflictBanner).toContainText('remote-readme-conflict-token')
    await expect(conflictBanner).toContainText('另有 1 个冲突')
    await expect(conflictBanner).toContainText('Alpha.md')
    await expect(page.locator('.cm-content')).toContainText('local-readme-conflict-token')

    await conflictBanner.getByRole('button', { name: '查看冲突 Alpha.md' }).click()
    await expect(conflictBanner).toContainText('local-alpha-conflict-token')
    await expect(conflictBanner).toContainText('remote-alpha-conflict-token')
    await expect(page.locator('.cm-content')).toContainText('local-alpha-conflict-token')
  })

  test('external source edits refresh embeds in preview and live preview without changing the host', async ({ page }) => {
    await installMockElectronVault(page)
    await openApp(page)
    await openMockNativeVault(page)

    await page.evaluate(() => {
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/README.md', '# Embed Host\n\n![[docs/Alpha]]')
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/docs/Alpha.md', '# Alpha\n\ninitial-embed-token')
    })

    await page.locator('.tree-node').filter({ hasText: 'README.md' }).click()
    await expect(page.locator('.cm-content')).toContainText('Embed Host')
    await enableLivePreview(page)

    const livePreviewEmbed = page.locator('.cm-live-preview-embed-note').first()
    await expect(livePreviewEmbed).toContainText('initial-embed-token')

    await runCommand(page, '阅读模式')
    const previewEmbed = page.locator('.preview-content .embed-note').first()
    await expect(previewEmbed).toContainText('initial-embed-token')

    await page.evaluate(() => {
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/docs/Alpha.md', '# Alpha\n\nupdated-embed-token')
    })

    await expect(previewEmbed).toContainText('updated-embed-token')
    await expect(previewEmbed).not.toContainText('initial-embed-token')
    await runCommand(page, '实时预览模式')
    const updatedLivePreviewEmbed = page.locator('.cm-live-preview-embed-note').first()
    await expect(updatedLivePreviewEmbed).toContainText('updated-embed-token')
    await expect(updatedLivePreviewEmbed).not.toContainText('initial-embed-token')
    await expect(page.locator('.cm-content')).toContainText('Embed Host')
  })

  test('native vault image embeds render as assets and refresh when the asset changes', async ({ page }) => {
    await installMockElectronVault(page)
    await openApp(page)
    await openMockNativeVault(page)

    const firstSvg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="red"/></svg>').toString('base64')}`
    const secondSvg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="green"/></svg>').toString('base64')}`

    await page.evaluate(({ firstSvg }) => {
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/README.md', '# Image Host\n\n![[docs/pixel.svg]]')
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/docs/pixel.svg', firstSvg)
    }, { firstSvg })

    await page.locator('.tree-node').filter({ hasText: 'README.md' }).click()
    await expect(page.locator('.cm-content')).toContainText('Image Host')
    await enableLivePreview(page)

    const livePreviewImage = page.locator('.cm-live-preview-embed-image img').first()
    await expect(livePreviewImage).toHaveAttribute('src', firstSvg)

    await runCommand(page, '阅读模式')
    const previewImage = page.locator('.preview-content .embed-image img').first()
    await expect(previewImage).toHaveAttribute('src', firstSvg)

    await page.evaluate(({ secondSvg }) => {
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/docs/pixel.svg', secondSvg)
    }, { secondSvg })

    await expect(previewImage).toHaveAttribute('src', secondSvg)
    await runCommand(page, '实时预览模式')
    await expect(page.locator('.cm-live-preview-embed-image img').first()).toHaveAttribute('src', secondSvg)
  })

  test('native vault audio video and PDF embeds render as media attachments', async ({ page }) => {
    await installMockElectronVault(page)
    await openApp(page)
    await openMockNativeVault(page)

    const audio = `data:audio/mpeg;base64,${Buffer.from('audio-bytes').toString('base64')}`
    const video = `data:video/mp4;base64,${Buffer.from('video-bytes').toString('base64')}`
    const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.4 mock').toString('base64')}`

    await page.evaluate(({ audio, video, pdf }) => {
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/README.md', [
        '# Media Host',
        '',
        '![[docs/audio.mp3]]',
        '',
        '![[docs/clip.mp4]]',
        '',
        '![[docs/paper.pdf]]',
      ].join('\n'))
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/docs/audio.mp3', audio)
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/docs/clip.mp4', video)
      ;(window as any).__mockElectronVaultExternalWrite('/workspace/docs/paper.pdf', pdf)
    }, { audio, video, pdf })

    await page.locator('.tree-node').filter({ hasText: 'README.md' }).click()
    await expect(page.locator('.cm-content')).toContainText('Media Host')
    await enableLivePreview(page)

    await expect(page.locator('.cm-live-preview-embed-audio audio')).toHaveAttribute('src', audio)
    await expect(page.locator('.cm-live-preview-embed-video video')).toHaveAttribute('src', video)
    await expect(page.locator('.cm-live-preview-embed-pdf iframe')).toHaveAttribute('src', pdf)

    await runCommand(page, '阅读模式')
    await expect(page.locator('.preview-content .embed-audio audio')).toHaveAttribute('src', audio)
    await expect(page.locator('.preview-content .embed-video video')).toHaveAttribute('src', video)
    await expect(page.locator('.preview-content .embed-pdf iframe')).toHaveAttribute('src', pdf)
  })

  test('restores saved tabs from the active native vault after reload', async ({ page }) => {
    await installMockElectronVault(page)
    await openApp(page)

    await openMockNativeVault(page)
    await page.locator('.tree-node').filter({ hasText: 'README.md' }).click()
    await expect(page.locator('.cm-content')).toContainText('Native Vault')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('.app-container')).toBeVisible()
    await expect(page.locator('.cm-content')).toContainText('Native Vault')

    const state = await page.evaluate(async () => {
      const { vaultService } = await import('/src/services/vault/index.ts')
      const { useEditorStore } = await import('/src/stores/editor.ts')
      const editorStore = useEditorStore()
      return {
        kind: vaultService.kind,
        currentFile: editorStore.currentFile,
        content: editorStore.content,
      }
    })

    expect(state.kind).toBe('electron-fs')
    expect(state.currentFile).toBe('/workspace/README.md')
    expect(state.content).toContain('Native Vault')
  })
})
