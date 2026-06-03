import { expect, type Page } from '@playwright/test'

export async function openApp(page: Page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
}

export async function resetBrowserState(page: Page) {
  await openApp(page)
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload()
  await page.waitForLoadState('networkidle')
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

export async function setEditorContent(page: Page, content: string) {
  const editor = page.locator('.cm-content')
  await editor.click()
  const updatedViaCodeMirror = await editor.evaluate((el, nextContent) => {
    let node: any = el
    while (node) {
      const view = node.cmView?.view
      if (view) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: nextContent },
          selection: { anchor: nextContent.length },
        })
        view.focus()
        return true
      }
      node = node.parentElement
    }
    return false
  }, content).catch(() => false)

  if (!updatedViaCodeMirror) {
    await editor.fill(content)
  }
  await expect(editor).toBeVisible()
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
  await page.keyboard.press('Control+Shift+P')
  await expect(page.locator('.command-palette')).toBeVisible()
  await page.getByPlaceholder('输入命令...').fill(commandLabel)
  await page.locator('.command-item').filter({ hasText: commandLabel }).first().click()
}
