import { expect, type Page } from '@playwright/test'

export async function openApp(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.app-container')).toBeVisible()
}

export async function resetBrowserState(page: Page) {
  await openApp(page)
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.app-container')).toBeVisible()
}

export async function loadDemoWorkspace(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  const demoButton = page.getByRole('button', { name: '试用示例工作区' })
  if (await demoButton.isVisible()) {
    await demoButton.click()
  }
  await expect(page.locator('.el-tree')).toBeVisible()
}

export async function openFirstMarkdownFile(page: Page) {
  const firstMarkdownFile = page.locator('.el-tree-node').filter({ hasText: '.md' }).first()
  await firstMarkdownFile.click()
  await expect(page.locator('.cm-content')).toBeVisible()
}

function visibleContentProbe(content: string): string {
  const token = content
    .split('\n')
    .map(part => part
      .replace(/^#{1,6}\s+/, '')
      .replace(/^```\w*$/, '')
      .trim()
      .match(/[A-Za-z0-9\u4e00-\u9fff][A-Za-z0-9\u4e00-\u9fff ]{1,}/)?.[0]
      ?.trim())
    .find(Boolean)

  return token || content.trim()
}

export async function setEditorContent(page: Page, content: string) {
  const editor = page.locator('.cm-content')
  await editor.click()
  const updatedViaCodeMirror = await page.locator('.cm-editor').evaluate((el, nextContent) => {
    const findView = (node: Element | null): any => {
      let current: any = node
      while (current) {
        const view = current.cmView?.view
        if (view) return view
        current = current.parentElement
      }

      const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT)
      while (walker.nextNode()) {
        const view = (walker.currentNode as any).cmView?.view
        if (view) return view
      }

      return null
    }

    const view = findView(el)
    if (!view) return false
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: nextContent },
      selection: { anchor: nextContent.length },
      scrollIntoView: true,
    })
    view.focus()
    return view.state.doc.toString() === nextContent
  }, content).catch(() => false)

  if (!updatedViaCodeMirror) {
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.insertText(content)
  }

  await expect(editor).toBeVisible()
  const probe = visibleContentProbe(content)
  if (probe) {
    await expect(editor).toContainText(probe)
  }
}

export async function moveEditorCursorToLine(page: Page, lineNumber: number) {
  await page.locator('.cm-line').nth(lineNumber - 1).click()
  await expect(page.locator('.status-bar')).toContainText(`行 ${lineNumber}`)
}

export async function selectTemplate(page: Page, name: string) {
  const option = page.getByRole('button', { name: `使用${name}模板` })
  await expect(option).toBeVisible()
  await option.click()
  await expect(page.getByRole('dialog', { name: '从模板创建' })).toHaveCount(0)
}

export async function createWorkspaceFile(page: Page, path: string, content: string) {
  await page.evaluate(
    async ({ path, content }) => {
      const { fileSystem } = await import('/src/services/fileSystem.ts')
      await fileSystem.init()
      await fileSystem.writeFile(path, content)
    },
    { path, content }
  )
}

export async function readWorkspaceFile(page: Page, path: string): Promise<string> {
  return page.evaluate(async (path) => {
    const { fileSystem } = await import('/src/services/fileSystem.ts')
    await fileSystem.init()
    return fileSystem.readFile(path)
  }, path)
}

export async function runCommand(page: Page, commandLabel: string) {
  await page.locator('.app-container').click({ position: { x: 20, y: 20 } })
  await page.keyboard.press('Control+P')
  await expect(page.locator('.command-palette')).toBeVisible()
  await page.getByPlaceholder('输入命令...').fill(commandLabel)
  await expect(page.locator('.command-item').filter({ hasText: commandLabel }).first()).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('.command-palette')).toHaveCount(0)
}
