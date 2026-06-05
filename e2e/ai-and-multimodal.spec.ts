import { expect, test, type Page } from '@playwright/test'
import { loadDemoWorkspace, openFirstMarkdownFile, resetBrowserState, runCommand, setEditorContent } from './helpers'

async function persistSettingsAndReload(page: Page, settings: Record<string, unknown>) {
  await page.evaluate((nextSettings) => {
    for (const [key, value] of Object.entries(nextSettings)) {
      localStorage.setItem(key, JSON.stringify(value))
    }
  }, settings)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.app-container')).toBeVisible()
}

test.describe('AI 与多模态回归', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page)
  })

  test('新用户未打开 AI 配置也可以使用默认 Ollama 聊天', async ({ page }) => {
    let requestBody: any = null
    await page.route('http://localhost:11434/api/chat', async (route) => {
      requestBody = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: [
          JSON.stringify({ message: { content: 'default ollama answer' } }),
          JSON.stringify({ done: true }),
          '',
        ].join('\n'),
      })
    })

    await page.getByRole('button', { name: 'AI 助手' }).click()
    await expect(page.locator('.chat-header-left')).toContainText('qwen2.5:7b')
    await page.locator('.chat-input-area textarea').fill('直接使用默认配置')
    await page.getByRole('button', { name: '发送' }).click()
    await expect(page.locator('.message-text').filter({ hasText: 'default ollama answer' })).toBeVisible()

    expect(requestBody.model).toBe('qwen2.5:7b')
    expect(requestBody.stream).toBe(true)
    expect(requestBody.messages[0].role).toBe('system')
    expect(requestBody.messages.some((message: any) => message.role === 'user' && message.content.includes('默认配置'))).toBe(true)
  })

  test('停止 AI 生成不会把用户主动中断显示为错误', async ({ page }) => {
    let releaseResponse!: () => void
    const pendingResponse = new Promise<void>(resolve => {
      releaseResponse = resolve
    })

    await page.route('http://localhost:11434/api/chat', async (route) => {
      await pendingResponse
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: JSON.stringify({ done: true }) + '\n',
      }).catch(() => {})
    })

    await page.getByRole('button', { name: 'AI 助手' }).click()
    await page.locator('.chat-input-area textarea').fill('请生成一段长文本')
    await page.getByRole('button', { name: '发送' }).click()

    await expect(page.getByRole('button', { name: '停止' })).toBeVisible()
    await page.getByRole('button', { name: '停止' }).click()
    await expect(page.locator('.message-text').filter({ hasText: '已停止生成' })).toBeVisible()
    await expect(page.locator('.message-text').filter({ hasText: /错误|AI 请求失败/ })).toHaveCount(0)

    releaseResponse()
  })

  test('AI 服务模型列表支持外部取消信号', async ({ page }) => {
    const models = await page.evaluate(async () => {
      const { aiService } = await import('/src/services/ai.ts')
      const controller = new AbortController()
      controller.abort()
      return aiService.listOllamaModels('http://localhost:11434', controller.signal)
    })

    expect(models).toEqual([])
  })

  test('AI 请求在 fallback timeout 环境下完成后会清理定时器', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { aiService } = await import('/src/services/ai.ts')
      const timeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout')
      const originalSetTimeout = window.setTimeout
      const originalClearTimeout = window.clearTimeout
      const originalFetch = window.fetch
      const activeTimers = new Set<number>()
      const clearedTimers: number[] = []
      let nextTimerId = 1

      Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true })
      window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: any[]) => {
        const id = nextTimerId++
        activeTimers.add(id)
        return id
      }) as typeof window.setTimeout
      window.clearTimeout = ((id?: number) => {
        if (typeof id === 'number') {
          activeTimers.delete(id)
          clearedTimers.push(id)
        }
      }) as typeof window.clearTimeout
      window.fetch = (async () => new Response(JSON.stringify({ models: [{ name: 'qwen2.5:7b' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof window.fetch

      try {
        const models = await aiService.listOllamaModels('http://localhost:11434')
        return {
          models,
          activeTimerCount: activeTimers.size,
          clearedTimerCount: clearedTimers.length,
        }
      } finally {
        if (timeoutDescriptor) {
          Object.defineProperty(AbortSignal, 'timeout', timeoutDescriptor)
        } else {
          delete (AbortSignal as any).timeout
        }
        window.setTimeout = originalSetTimeout
        window.clearTimeout = originalClearTimeout
        window.fetch = originalFetch
      }
    })

    expect(result).toEqual({
      models: ['qwen2.5:7b'],
      activeTimerCount: 0,
      clearedTimerCount: 1,
    })
  })

  test('Ghost Text 取消后不会接收过期流结果', async ({ page }) => {
    let requestStarted = false
    await page.route('http://localhost:11434/api/chat', async (route) => {
      requestStarted = true
      await new Promise(resolve => setTimeout(resolve, 120))
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: [
          JSON.stringify({ message: { content: 'stale completion' } }),
          JSON.stringify({ done: true }),
          '',
        ].join('\n'),
      }).catch(() => {})
    })

    const outcome = await page.evaluate(async () => {
      const { requestCompletion, cancelCompletion } = await import('/src/extensions/ghost-text/completionService.ts')
      const events: string[] = []
      const unhandled: string[] = []

      const onUnhandled = (event: PromiseRejectionEvent) => {
        unhandled.push(String(event.reason?.message || event.reason || 'unhandled'))
        event.preventDefault()
      }
      window.addEventListener('unhandledrejection', onUnhandled)

      try {
        requestCompletion(
          'prefix text',
          {
            enabled: true,
            debounceMs: 0,
            maxPrefixChars: 100,
            maxCompletionChars: 50,
            triggerMode: 'pause',
          },
          () => events.push('result'),
          (error) => events.push(`error:${error}`)
        )
        await new Promise(resolve => window.setTimeout(resolve, 30))
        cancelCompletion()
        await new Promise(resolve => window.setTimeout(resolve, 180))
        return { events, unhandled }
      } finally {
        window.removeEventListener('unhandledrejection', onUnhandled)
        cancelCompletion()
      }
    })

    expect(requestStarted).toBe(true)
    expect(outcome).toEqual({ events: [], unhandled: [] })
  })

  test('图表组件多实例渲染且源码切换后能恢复图表', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.app-container')).toBeVisible()

    await page.evaluate(async () => {
      const { createApp, h } = await import('/node_modules/.vite/deps/vue.js')
      const { default: ChartRenderer } = await import('/src/extensions/multimodal/ChartRenderer.vue')
      const host = document.createElement('div')
      host.id = 'chart-renderer-regression-host'
      document.body.appendChild(host)

      const app = createApp({
        render() {
          return h('div', [
            h(ChartRenderer, { mermaidSource: 'graph TD\nA[Alpha] --> B[Beta]' }),
            h(ChartRenderer, { mermaidSource: 'graph TD\nC[Gamma] --> D[Delta]' }),
          ])
        },
      })
      app.mount(host)
      ;(window as any).__chartRendererRegressionApp = app
    })

    const host = page.locator('#chart-renderer-regression-host')
    await expect(host.locator('.chart-preview svg')).toHaveCount(2, { timeout: 15000 })

    const firstChart = host.locator('.chart-renderer').first()
    await firstChart.getByRole('button', { name: '查看图表源码' }).click()
    await expect(firstChart.locator('.chart-source')).toContainText('Alpha')
    await expect(firstChart.locator('.chart-preview svg')).toHaveCount(0)

    await firstChart.getByRole('button', { name: '隐藏图表源码' }).click()
    await expect(firstChart.locator('.chart-preview svg')).toHaveCount(1, { timeout: 15000 })

    await page.evaluate(() => {
      ;(window as any).__chartRendererRegressionApp?.unmount()
      document.querySelector('#chart-renderer-regression-host')?.remove()
    })
  })

  test('OpenAI-compatible 配置可以保存并用于聊天请求', async ({ page }) => {
    let requestBody: any = null
    await page.route('https://ai.test.local/v1/chat/completions', async (route) => {
      requestBody = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"choices":[{"delta":{"content":"mock answer"}}]}\n\ndata: [DONE]\n\n',
      })
    })

    await page.goto('/')
    await expect(page.locator('.app-container')).toBeVisible()
    await page.getByRole('menuitem', { name: 'AI 配置' }).click()
    await page.locator('.el-form-item').filter({ hasText: 'Provider' }).locator('.el-select').click()
    await page.getByRole('option', { name: 'OpenAI 兼容' }).click()
    await page.locator('.el-form-item').filter({ hasText: 'API Key' }).locator('input').fill('sk-playwright')
    await page.locator('.el-form-item').filter({ hasText: 'API 地址' }).locator('input').fill('https://ai.test.local/v1')
    await page.locator('.el-form-item').filter({ hasText: '模型' }).locator('input').fill('test-model')
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('配置已保存并激活')).toBeVisible()

    const savedConfig = await page.evaluate(() => JSON.parse(localStorage.getItem('ai_config') || '{}'))
    expect(savedConfig.provider).toBe('openai')
    expect(savedConfig.baseURL).toBe('https://ai.test.local/v1')
    expect(savedConfig.model).toBe('test-model')

    await page.evaluate(async () => {
      const { useSettingsStore } = await import('/src/stores/settings.ts')
      useSettingsStore().updateAIConfig({ systemPrompt: '自定义系统提示：回答要简洁。' })
    })

    await page.getByRole('button', { name: 'AI 助手' }).click()
    await page.locator('.chat-input-area textarea').fill('帮我总结当前文档')
    await page.getByRole('button', { name: '发送' }).click()
    await expect(page.locator('.message-text').filter({ hasText: 'mock answer' })).toBeVisible()

    expect(requestBody.model).toBe('test-model')
    expect(requestBody.messages[0].role).toBe('system')
    expect(requestBody.messages[0].content).toContain('自定义系统提示')
    expect(requestBody.messages.some((message: any) => message.role === 'user' && message.content.includes('帮我总结'))).toBe(true)
  })

  test('流式 AI 响应会处理末尾无换行的最后一段', async ({ page }) => {
    await page.route('http://localhost:11434/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: JSON.stringify({ message: { content: 'ollama tail' }, done: true }),
      })
    })
    await page.route('https://tail.test/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"choices":[{"delta":{"content":"openai tail"}}]}',
      })
    })

    const result = await page.evaluate(async () => {
      const { FetchAIProvider } = await import('/src/services/ai.ts')
      const messages = [{ role: 'user' as const, content: 'tail check' }]
      const ollamaProvider = new FetchAIProvider({
        provider: 'ollama',
        baseURL: 'http://localhost:11434',
        apiKey: '',
        model: 'qwen2.5:7b',
        temperature: 0.7,
        maxTokens: 128,
        systemPrompt: '',
      })
      const openAIProvider = new FetchAIProvider({
        provider: 'openai',
        baseURL: 'https://tail.test/v1',
        apiKey: 'sk-tail',
        model: 'tail-model',
        temperature: 0.7,
        maxTokens: 128,
        systemPrompt: '',
      })

      const collect = async (stream: AsyncGenerator<string>) => {
        let text = ''
        for await (const chunk of stream) text += chunk
        return text
      }

      return {
        ollama: await collect(ollamaProvider.streamChat(messages)),
        openai: await collect(openAIProvider.streamChat(messages)),
      }
    })

    expect(result).toEqual({
      ollama: 'ollama tail',
      openai: 'openai tail',
    })
  })

  test('AI 行内操作结果不会执行或注入危险 HTML', async ({ page }) => {
    await page.route('https://ai-action.test/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'data: {"choices":[{"delta":{"content":"安全结果 <img src=x onerror=window.__aiActionXss=1>"}}]}',
          'data: {"choices":[{"delta":{"content":" <script>window.__aiActionXss=1</script>"}}]}',
          'data: [DONE]',
          '',
        ].join('\n\n'),
      })
    })

    await persistSettingsAndReload(page, {
      ai_config: {
        provider: 'openai',
        baseURL: 'https://ai-action.test/v1',
        apiKey: 'sk-action',
        model: 'action-model',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: '',
      },
      ghost_text_config: {
        enabled: false,
        debounceMs: 1500,
        maxPrefixChars: 500,
        maxCompletionChars: 200,
        triggerMode: 'pause',
      },
    })

    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '需要解释的文本')
    await expect(page.locator('.cm-ghost-text')).toHaveCount(0)
    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+A')

    await expect(page.locator('.cm-ai-action-menu')).toBeVisible()
    await page.locator('.cm-ai-action-btn').filter({ hasText: '解释' }).click()

    const resultBody = page.locator('.cm-ai-result-body')
    await expect(resultBody).toContainText('安全结果 <img')
    await expect(resultBody).toContainText('<script>window.__aiActionXss=1</script>')
    await expect(resultBody.locator('script')).toHaveCount(0)
    await expect(resultBody.locator('img')).toHaveCount(0)

    const xssRan = await page.evaluate(() => Boolean((window as any).__aiActionXss))
    expect(xssRan).toBe(false)
  })

  test('AI 内联编辑可以接受结果并写回编辑器', async ({ page }) => {
    await page.route('https://inline-edit.test/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'data: {"choices":[{"delta":{"content":"润色后的段落"}}]}',
          'data: [DONE]',
          '',
        ].join('\n\n'),
      })
    })

    await persistSettingsAndReload(page, {
      ai_config: {
        provider: 'openai',
        baseURL: 'https://inline-edit.test/v1',
        apiKey: 'sk-inline',
        model: 'inline-model',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: '',
      },
      enable_ai_actions: false,
      ghost_text_config: {
        enabled: false,
        debounceMs: 1500,
        maxPrefixChars: 500,
        maxCompletionChars: 200,
        triggerMode: 'pause',
      },
    })

    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '原始段落')
    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.press('ControlOrMeta+Shift+E')

    await expect(page.locator('.cm-inline-edit-widget')).toBeVisible()
    await page.locator('.inline-edit-action.action-polish').click()
    await expect(page.locator('.diff-view')).toContainText('润色后的段落')
    await page.locator('.diff-btn.accept').click()

    await expect(page.locator('.cm-content')).toContainText('润色后的段落')
    await expect(page.locator('.cm-content')).not.toContainText('原始段落')
  })

  test('AI 内联编辑默认 Provider 请求失败时给出明确提示', async ({ page }) => {
    await page.route('http://localhost:11434/api/chat', async (route) => {
      await route.fulfill({ status: 503, body: 'ollama unavailable' })
    })

    await persistSettingsAndReload(page, {
      enable_ai_actions: false,
      ghost_text_config: {
        enabled: false,
        debounceMs: 1500,
        maxPrefixChars: 500,
        maxCompletionChars: 200,
        triggerMode: 'pause',
      },
    })

    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    await setEditorContent(page, '需要 AI 修改的段落')
    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.press('ControlOrMeta+Shift+E')

    await expect(page.locator('.cm-inline-edit-widget')).toBeVisible()
    await page.locator('.inline-edit-action.action-polish').click()
    await expect(page.locator('.inline-edit-status.error')).toContainText('处理失败: Ollama HTTP 503')
    await expect(page.locator('.cm-content')).toContainText('需要 AI 修改的段落')
  })

  test('命令面板可以清空 AI 对话历史', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ai_chat_history', JSON.stringify([{
        id: 'old-command-message',
        role: 'assistant',
        content: 'command clear target',
        timestamp: Date.now(),
      }]))
    })

    await page.getByRole('button', { name: 'AI 助手' }).click()
    await expect(page.locator('.message-text').filter({ hasText: 'command clear target' })).toBeVisible()

    await runCommand(page, '清空对话')

    await expect(page.locator('.message-text').filter({ hasText: 'command clear target' })).toHaveCount(0)
    const history = await page.evaluate(() => JSON.parse(localStorage.getItem('ai_chat_history') || '[]'))
    expect(history).toEqual([])
  })

  test('命令面板可以测试当前 AI 连接', async ({ page }) => {
    let modelsRequested = false
    await page.route('https://command-ai.test/v1/models', async (route) => {
      modelsRequested = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'command-model' }] }),
      })
    })

    await persistSettingsAndReload(page, {
      ai_config: {
        provider: 'openai',
        baseURL: 'https://command-ai.test/v1',
        apiKey: 'sk-command',
        model: 'command-model',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: '',
      },
    })

    await runCommand(page, '测试连接')

    await expect(page.getByText('AI 连接成功')).toBeVisible()
    expect(modelsRequested).toBe(true)
  })

  test('启用 RAG 时发送消息会先索引当前未保存文档', async ({ page }) => {
    let requestBody: any = null
    await page.route('https://rag-chat.test/v1/chat/completions', async (route) => {
      requestBody = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"choices":[{"delta":{"content":"rag answer"}}]}\n\ndata: [DONE]\n\n',
      })
    })

    await persistSettingsAndReload(page, {
      ai_config: {
        provider: 'openai',
        baseURL: 'https://rag-chat.test/v1',
        apiKey: 'sk-rag',
        model: 'rag-model',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: '',
      },
      enable_rag: true,
    })

    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)
    const tailToken = `rag-tail-token-${Date.now()}`
    const longContent = `# RAG Send Index\n\n${'filler context '.repeat(180)}\n\nTail knowledge: ${tailToken}`
    await setEditorContent(page, longContent)

    await page.getByRole('button', { name: 'AI 助手' }).click()
    await page.locator('.chat-input-area textarea').fill(`解释 ${tailToken}`)
    await page.getByRole('button', { name: '发送' }).click()
    await expect(page.locator('.message-text').filter({ hasText: 'rag answer' })).toBeVisible()

    const systemPrompt = requestBody.messages[0].content
    expect(systemPrompt).toContain('以下是相关的文档上下文')
    expect(systemPrompt).toContain(tailToken)
    expect(systemPrompt).toContain('[/workspace/')
  })

  test('RAG 搜索会命中文件名和路径里的项目关键词', async ({ page }) => {
    const projectToken = `rag-title-${Date.now()}`
    const result = await page.evaluate(async (token) => {
      const { ragService } = await import('/src/services/rag.ts')
      const targetPath = `/workspace/projects/${token}-roadmap.md`
      await ragService.indexDocument(targetPath, 'Launch milestones and owner notes without the project token in body.')
      return ragService.search(token, 5)
    }, projectToken)

    expect(result[0]?.filePath).toContain(projectToken)
    expect(result[0]?.relevance).toBeGreaterThan(0)
  })

  test('AI 请求失败时显示错误消息且历史不会超过上限', async ({ page }) => {
    await page.route('https://ai-error.test/v1/chat/completions', route => route.fulfill({ status: 500, body: 'failed' }))

    await persistSettingsAndReload(page, {
      ai_config: {
        provider: 'openai',
        baseURL: 'https://ai-error.test/v1',
        apiKey: 'sk-error',
        model: 'error-model',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: '',
      },
      ai_chat_history: Array.from({ length: 60 }, (_, index) => ({
        id: `old-${index}`,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `old message ${index}`,
        timestamp: Date.now() + index,
      })),
    })

    await page.getByRole('button', { name: 'AI 助手' }).click()
    await page.locator('.chat-input-area textarea').fill('trigger error')
    await page.getByRole('button', { name: '发送' }).click()
    await expect(page.locator('.message-text').filter({ hasText: '错误: HTTP 500' })).toBeVisible()

    const historyLength = await page.evaluate(() => JSON.parse(localStorage.getItem('ai_chat_history') || '[]').length)
    expect(historyLength).toBeLessThanOrEqual(50)
  })

  test('AI 聊天历史渲染会清理危险 HTML', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.app-container')).toBeVisible()
    await page.evaluate(() => {
      localStorage.setItem('ai_chat_history', JSON.stringify([{
        id: 'malicious-assistant',
        role: 'assistant',
        content: '<img src=x onerror="window.__aiXss = true"><script>window.__aiXss = true</script>**safe**',
        timestamp: Date.now(),
      }]))
    })

    await page.getByRole('button', { name: 'AI 助手' }).click()
    const message = page.locator('.message-text').filter({ hasText: 'safe' })
    await expect(message).toBeVisible()

    const rendered = await message.evaluate((node) => ({
      rawImages: node.querySelectorAll('img').length,
      dangerousImages: node.querySelectorAll('img[onerror]').length,
      scripts: node.querySelectorAll('script').length,
      xssRan: Boolean((window as any).__aiXss),
    }))

    expect(rendered.rawImages).toBe(0)
    expect(rendered.dangerousImages).toBe(0)
    expect(rendered.scripts).toBe(0)
    expect(rendered.xssRan).toBe(false)
  })

  test('语音输入在不支持 SpeechRecognition 时显示禁用状态', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true })
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true })
    })
    await page.goto('/')
    await expect(page.locator('.app-container')).toBeVisible()
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)

    const voiceButton = page.locator('.editor-toolbar .voice-input-btn').first()
    await expect(voiceButton).toHaveClass(/is-unsupported/)
    await expect(voiceButton).toBeDisabled()
    await expect(voiceButton).toHaveAttribute('title', '当前浏览器不支持语音输入')
  })

  test('语音输入 disabled 属性会真实禁用按钮', async ({ page }) => {
    const state = await page.evaluate(async () => {
      class MockSpeechRecognition extends EventTarget {
        lang = 'zh-CN'
        continuous = false
        interimResults = true
        maxAlternatives = 1
        onresult = null
        onerror = null
        onend = null
        onstart = null
        start() {}
        stop() {}
        abort() {}
      }

      ;(window as any).SpeechRecognition = MockSpeechRecognition
      const { createApp, h, nextTick } = await import('/node_modules/.vite/deps/vue.js')
      const { default: VoiceInputButton } = await import('/src/components/ui/VoiceInputButton.vue')
      const host = document.createElement('div')
      document.body.appendChild(host)
      const app = createApp({
        render: () => h(VoiceInputButton, { mode: 'toggle', disabled: true }),
      })
      app.mount(host)
      await nextTick()

      const button = host.querySelector('button') as HTMLButtonElement
      const result = {
        disabled: button.disabled,
        title: button.getAttribute('title'),
        ariaLabel: button.getAttribute('aria-label'),
      }
      app.unmount()
      host.remove()
      delete (window as any).SpeechRecognition
      return result
    })

    expect(state).toEqual({
      disabled: true,
      title: '语音输入已禁用',
      ariaLabel: '语音输入已禁用',
    })
  })

  test('语音输入只提交最终片段且不会重复累计文本', async ({ page }) => {
    const emitted = await page.evaluate(async () => {
      const instances: any[] = []
      class MockSpeechRecognition extends EventTarget {
        lang = 'zh-CN'
        continuous = false
        interimResults = true
        maxAlternatives = 1
        onresult: ((event: any) => void) | null = null
        onerror = null
        onend = null
        onstart: ((event: Event) => void) | null = null
        constructor() {
          super()
          instances.push(this)
        }
        start() { this.onstart?.(new Event('start')) }
        stop() { this.onend?.(new Event('end')) }
        abort() {}
      }

      const result = (text: string, isFinal: boolean) => ({ isFinal, 0: { transcript: text } })
      const recognitionEvent = (...items: Array<ReturnType<typeof result>>) => ({
        resultIndex: 0,
        results: items,
      })

      ;(window as any).SpeechRecognition = MockSpeechRecognition
      const { createApp, h, nextTick } = await import('/node_modules/.vite/deps/vue.js')
      const { default: VoiceInputButton } = await import('/src/components/ui/VoiceInputButton.vue')
      const host = document.createElement('div')
      document.body.appendChild(host)
      const received: string[] = []
      const app = createApp({
        render: () => h(VoiceInputButton, { mode: 'toggle', onResult: (text: string) => received.push(text) }),
      })
      app.mount(host)
      await nextTick()

      const button = host.querySelector('button') as HTMLButtonElement
      button.click()
      instances[0].onresult?.(recognitionEvent(result('临时文本', false)))
      instances[0].onresult?.(recognitionEvent(result('第一段', true)))
      instances[0].onresult?.(recognitionEvent(result('第二段', true)))
      await nextTick()

      app.unmount()
      host.remove()
      delete (window as any).SpeechRecognition
      return received
    })

    expect(emitted).toEqual(['第一段', '第二段'])
  })

  test('语音输入卸载后会中断识别并忽略迟到结果', async ({ page }) => {
    const state = await page.evaluate(async () => {
      const instances: any[] = []
      class MockSpeechRecognition extends EventTarget {
        lang = 'zh-CN'
        continuous = false
        interimResults = true
        maxAlternatives = 1
        onresult: ((event: any) => void) | null = null
        onerror = null
        onend = null
        onstart: ((event: Event) => void) | null = null
        abortCalls = 0
        constructor() {
          super()
          instances.push(this)
        }
        start() { this.onstart?.(new Event('start')) }
        stop() { this.onend?.(new Event('end')) }
        abort() { this.abortCalls += 1 }
      }

      ;(window as any).SpeechRecognition = MockSpeechRecognition
      const { createApp, h, nextTick } = await import('/node_modules/.vite/deps/vue.js')
      const { default: VoiceInputButton } = await import('/src/components/ui/VoiceInputButton.vue')
      const host = document.createElement('div')
      document.body.appendChild(host)
      const received: string[] = []
      const app = createApp({
        render: () => h(VoiceInputButton, { mode: 'toggle', onResult: (text: string) => received.push(text) }),
      })
      app.mount(host)
      await nextTick()

      const button = host.querySelector('button') as HTMLButtonElement
      button.click()
      const instance = instances[0]
      app.unmount()
      host.remove()
      instance.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: '迟到文本' } }],
      })
      delete (window as any).SpeechRecognition
      return { received, abortCalls: instance.abortCalls, hasResultHandler: Boolean(instance.onresult) }
    })

    expect(state).toEqual({ received: [], abortCalls: 1, hasResultHandler: false })
  })

  test('智能粘贴会清理文本并把富文本转换为 Markdown', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.app-container')).toBeVisible()
    const result = await page.evaluate(async () => {
      const { cleanPastedContent, convertHTMLToMarkdown } = await import('/src/extensions/smart-paste/pasteHandler.ts')
      return {
        markdown: convertHTMLToMarkdown('<h1>Paste Title</h1><p><strong>Bold</strong> text</p><a href="https://example.com">Link</a>'),
        cleaned: cleanPastedContent('smart\u201Cquote\u201D\u00A0text\u200B\n\n\nnext  '),
      }
    })

    expect(result.markdown).toContain('# Paste Title')
    expect(result.markdown).toContain('**Bold** text')
    expect(result.markdown).toContain('[Link](https://example.com)')
    expect(result.cleaned).toBe('smart"quote" text\n\nnext')
  })

  test('OCR/PDF 拖拽处理服务会生成预期 Markdown 片段', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.app-container')).toBeVisible()
    const result = await page.evaluate(async () => {
      const { insertDroppedFiles } = await import('/src/extensions/multimodal/dropHandler.ts')
      const dispatched: Array<{ from: number, insert: string }> = []
      const mockView = {
        dispatch(update: { changes: { from: number, insert: string } }) {
          dispatched.push(update.changes)
        },
      }
      const image = new File(['image-bytes'], 'scan.png', { type: 'image/png' })
      const pdf = new File(['pdf-bytes'], 'notes.pdf', { type: 'application/pdf' })
      const unsupported = new File(['data'], 'archive.zip', { type: 'application/zip' })

      await insertDroppedFiles([image, pdf, unsupported], 5, mockView as any, {
        image: async (source) => source instanceof File ? 'OCR line one\nOCR line two' : '',
        pdf: async (source) => source instanceof File ? 'PDF extracted text' : '',
      })

      return dispatched
    })

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ from: 5, insert: '\n![scan.png](scan.png)\n' })
    expect(result[1].insert).toContain('OCR 提取文字')
    expect(result[1].insert).toContain('OCR line two')
    expect(result[2].insert).toContain('PDF extracted text')
  })
})
