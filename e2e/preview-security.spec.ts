import { expect, test } from '@playwright/test'
import { createWorkspaceFile, loadDemoWorkspace, moveEditorCursorToLine, openFirstMarkdownFile, readWorkspaceFile, resetBrowserState, runCommand, setEditorContent } from './helpers'

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
      '',
      '`[[README]]` stays literal inline code.',
      '',
      '```text',
      '[[README]] stays literal fenced code.',
      '```',
    ].join('\n'))

    await runCommand(page, '预览模式')
    const preview = page.locator('.preview-content')
    await expect(preview.locator('.katex')).toBeVisible()
    await expect(preview.locator('input[type="checkbox"]')).toBeChecked()
    await expect(preview.locator('.wiki-link')).toHaveCount(1)
    await expect(preview.locator('.wiki-link')).toHaveText('Read me')
    await expect(preview.locator('p code')).toContainText('[[README]]')
    await expect(preview.locator('pre code')).toContainText('[[README]] stays literal fenced code.')
  })

  test('预览依赖的文件列表变化后会刷新 Wiki Link 和行号映射', async ({ page }) => {
    await page.evaluate(async () => {
      const { createApp, h, ref } = await import('/node_modules/.vite/deps/vue.js')
      const { default: Preview } = await import('/src/components/Preview.vue')
      const host = document.createElement('div')
      host.id = 'preview-reactivity-regression-host'
      document.body.appendChild(host)

      const markdownPaths = ref<string[]>([])
      const cursorLine = ref(1)
      const app = createApp({
        render() {
          return h(Preview, {
            content: '# Source\n\n[[Later Note]]',
            cursorLine: cursorLine.value,
            currentFile: '/workspace/source.md',
            markdownPaths: markdownPaths.value,
          })
        },
      })
      app.mount(host)
      ;(window as any).__previewReactivityRegression = {
        app,
        markTargetExists() {
          markdownPaths.value = ['/workspace/Later Note.md']
          cursorLine.value = 3
        },
      }
    })

    const host = page.locator('#preview-reactivity-regression-host')
    const link = host.locator('.wiki-link', { hasText: 'Later Note' })
    await expect(link).toHaveClass(/wiki-link-missing/)

    await page.evaluate(() => {
      ;(window as any).__previewReactivityRegression.markTargetExists()
    })

    await expect(link).toHaveClass(/wiki-link-exists/)
    await expect(host.locator('.current-line .wiki-link', { hasText: 'Later Note' })).toBeVisible()

    await page.evaluate(() => {
      ;(window as any).__previewReactivityRegression.app.unmount()
      document.querySelector('#preview-reactivity-regression-host')?.remove()
    })
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

  test('快速替换 Mermaid 内容后预览只保留最新 Markdown', async ({ page }) => {
    await setEditorContent(page, '```mermaid\ngraph TD\n  Old[Old diagram] --> Done[Done]\n```')
    await runCommand(page, '分屏模式')
    await expect(page.locator('.preview-content .mermaid')).toBeVisible()

    await setEditorContent(page, '# Latest plain note\n\nThis content replaces the diagram.')

    const preview = page.locator('.preview-content')
    await expect(preview.locator('h1')).toContainText('Latest plain note')
    await expect.poll(async () => ({
      mermaidBlocks: await preview.locator('.mermaid').count(),
      svgs: await preview.locator('svg').count(),
      oldTextVisible: await preview.getByText('Old diagram').count(),
    })).toEqual({ mermaidBlocks: 0, svgs: 0, oldTextVisible: 0 })
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

  test('点击预览 Wiki Link 会打开目标文档', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/notes/wiki-target.md', '# Wiki Target\n\nopened from preview')
    await setEditorContent(page, [
      '# Source',
      '',
      'Open [[notes/wiki-target|Target Note]] from preview.',
    ].join('\n'))
    await runCommand(page, '预览模式')

    await page.locator('.preview-content .wiki-link', { hasText: 'Target Note' }).click()

    await expect(page.locator('.tabs-bar')).toContainText('wiki-target.md')
    await expect(page.locator('.preview-content')).toContainText('Wiki Target')
  })

  test('点击带标题片段的预览 Wiki Link 会打开文档并跳到标题', async ({ page }) => {
    await createWorkspaceFile(page, '/workspace/notes/wiki-heading.md', [
      '# Wiki Heading Target',
      '',
      'intro',
      '',
      '## Deep Heading',
      '',
      'heading body',
    ].join('\n'))
    await setEditorContent(page, [
      '# Source',
      '',
      'Open [[notes/wiki-heading#Deep Heading|Deep Link]] from preview.',
    ].join('\n'))
    await runCommand(page, '预览模式')

    await page.locator('.preview-content .wiki-link', { hasText: 'Deep Link' }).click()

    await expect(page.locator('.tabs-bar')).toContainText('wiki-heading.md')
    const highlighted = page.locator('.preview-content .current-line')
    await expect(highlighted).toContainText('Deep Heading')
    await expect(highlighted).toHaveAttribute('data-line', '5')
    await expect(page.locator('.status-bar')).toContainText('行 5')
  })

  test('点击当前文档标题 Wiki Link 会跳到未保存内容里的标题', async ({ page }) => {
    await setEditorContent(page, [
      '# Source',
      '',
      '```md',
      '## Deep Heading',
      '```',
      '',
      'Jump to [[#Deep Heading|Deep Link]] in this document.',
      '',
      '## Deep Heading',
      '',
      'unsaved body',
    ].join('\n'))
    await runCommand(page, '预览模式')

    await page.locator('.preview-content .wiki-link', { hasText: 'Deep Link' }).click()

    const highlighted = page.locator('.preview-content .current-line')
    await expect(highlighted).toContainText('Deep Heading')
    await expect(highlighted).toHaveAttribute('data-line', '9')
    await expect(page.locator('.status-bar')).toContainText('行 9')
  })

  test('点击缺失的预览 Wiki Link 会创建并打开新文档', async ({ page }) => {
    await setEditorContent(page, [
      '# Source',
      '',
      'Create [[New Idea]] from preview.',
    ].join('\n'))
    await runCommand(page, '预览模式')

    const missingLink = page.locator('.preview-content .wiki-link', { hasText: 'New Idea' })
    await expect(missingLink).toHaveClass(/wiki-link-missing/)

    await missingLink.click()

    await expect(page.locator('.tabs-bar')).toContainText('New Idea.md')
    await expect(page.locator('.preview-content')).toContainText('New Idea')
    await expect.poll(() => readWorkspaceFile(page, '/workspace/New Idea.md')).toContain('# New Idea')
  })
})
