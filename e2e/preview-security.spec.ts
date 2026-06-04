import { expect, test } from '@playwright/test'
import { loadDemoWorkspace, moveEditorCursorToLine, openFirstMarkdownFile, resetBrowserState, runCommand, setEditorContent } from './helpers'

test.describe('预览渲染与安全补充', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page)
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
  })

  test('KaTeX、任务列表和 Wiki Link 会在预览中渲染', async ({ page }) => {
    await setEditorContent(page, [
      '# Preview Features',
      '',
      '$$E = mc^2$$',
      '',
      '- [x] shipped',
      '',
      '[[README|Read me]]',
    ].join('\n'))

    await runCommand(page, '预览模式')
    const preview = page.locator('.preview-content')
    await expect(preview.locator('.katex')).toBeVisible()
    await expect(preview.locator('input[type="checkbox"]')).toBeChecked()
    await expect(preview.locator('.wiki-link')).toHaveText('Read me')
  })

  test('Mermaid 图表成功渲染或显示安全错误文本', async ({ page }) => {
    await setEditorContent(page, '```mermaid\ngraph TD\n  A[Start] --> B[Done]\n```')
    await runCommand(page, '预览模式')

    const mermaid = page.locator('.preview-content .mermaid').first()
    await expect(mermaid).toBeVisible()
    await expect.poll(async () => {
      const html = await mermaid.innerHTML()
      const text = await mermaid.textContent()
      return html.includes('<svg') || text?.includes('Mermaid diagram error')
    }).toBeTruthy()
  })

  test('javascript 链接和事件属性不会进入预览 DOM', async ({ page }) => {
    await setEditorContent(page, [
      '[bad](javascript:alert(1))',
      '',
      '<img src=x onerror=alert(1)>',
    ].join('\n'))
    await runCommand(page, '预览模式')

    const unsafeDom = await page.locator('.preview-content').evaluate((el) => ({
      javascriptLinks: el.querySelectorAll('a[href^="javascript:"]').length,
      eventHandlers: Array.from(el.querySelectorAll('*')).filter(node =>
        Array.from(node.attributes).some(attr => attr.name.toLowerCase().startsWith('on'))
      ).length,
      scripts: el.querySelectorAll('script').length,
    }))
    expect(unsafeDom.javascriptLinks).toBe(0)
    expect(unsafeDom.eventHandlers).toBe(0)
    expect(unsafeDom.scripts).toBe(0)
  })

  test('预览块会保留真实源码行号', async ({ page }) => {
    await setEditorContent(page, [
      '# First',
      '',
      'paragraph line',
      '',
      '## Second',
      '',
      '```js',
      'console.log("line map")',
      '```',
    ].join('\n'))
    await runCommand(page, '预览模式')

    const preview = page.locator('.preview-content')
    await expect(preview.locator('h1[data-line="1"]')).toContainText('First')
    await expect(preview.locator('p[data-line="3"]')).toContainText('paragraph line')
    await expect(preview.locator('h2[data-line="5"]')).toContainText('Second')
    await expect(preview.locator('[data-line="7"][data-line-end="9"]')).toBeVisible()
  })

  test('分屏模式下编辑器光标会高亮对应预览标题', async ({ page }) => {
    await setEditorContent(page, [
      '# First',
      '',
      'body',
      '',
      '## Second',
      '',
      'target',
    ].join('\n'))
    await runCommand(page, '分屏模式')
    await moveEditorCursorToLine(page, 5)

    const highlighted = page.locator('.preview-content .current-line')
    await expect(highlighted).toContainText('Second')
    await expect(highlighted).toHaveAttribute('data-line', '5')
  })

  test('点击预览标题锚点会跳转到编辑器源码行', async ({ page }) => {
    await setEditorContent(page, [
      '# First',
      '',
      'body',
      '',
      '## Second',
      '',
      'target',
    ].join('\n'))
    await runCommand(page, '分屏模式')
    await page.locator('.preview-content h2 .header-anchor').click()

    await expect(page.locator('.status-bar')).toContainText('行 5')
    await expect(page.locator('.cm-activeLine')).toContainText('Second')
  })
})
