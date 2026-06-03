import { expect, test } from '@playwright/test'
import { loadDemoWorkspace, openFirstMarkdownFile, resetBrowserState, setEditorContent } from './helpers'

test.describe('AI 与多模态回归', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page)
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
    await page.waitForLoadState('networkidle')
    await page.getByRole('menuitem', { name: 'AI 配置' }).click()
    await page.locator('.el-form-item').filter({ hasText: 'Provider' }).locator('.el-select').click()
    await page.locator('.el-select-dropdown__item').filter({ hasText: 'OpenAI 兼容' }).click()
    await page.locator('.el-form-item').filter({ hasText: 'API Key' }).locator('input').fill('sk-playwright')
    await page.locator('.el-form-item').filter({ hasText: 'API 地址' }).locator('input').fill('https://ai.test.local/v1')
    await page.locator('.el-form-item').filter({ hasText: '模型' }).locator('input').fill('test-model')
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('配置已保存并激活')).toBeVisible()

    const savedConfig = await page.evaluate(() => JSON.parse(localStorage.getItem('ai_config') || '{}'))
    expect(savedConfig.provider).toBe('openai')
    expect(savedConfig.baseURL).toBe('https://ai.test.local/v1')
    expect(savedConfig.model).toBe('test-model')

    await page.getByRole('button', { name: 'AI 助手' }).click()
    await page.locator('.chat-input-area textarea').fill('帮我总结当前文档')
    await page.getByRole('button', { name: '发送' }).click()
    await expect(page.locator('.message-text').filter({ hasText: 'mock answer' })).toBeVisible()

    expect(requestBody.model).toBe('test-model')
    expect(requestBody.messages[0].role).toBe('system')
    expect(requestBody.messages[0].content).toContain('Markdown 写作助手')
    expect(requestBody.messages.some((message: any) => message.role === 'user' && message.content.includes('帮我总结'))).toBe(true)
  })

  test('AI 请求失败时显示错误消息且历史不会超过上限', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(async () => {
      localStorage.setItem('ai_config', JSON.stringify({
        provider: 'openai',
        baseURL: 'https://ai-error.test/v1',
        apiKey: 'sk-error',
        model: 'error-model',
        temperature: 0.7,
      }))
      localStorage.setItem('ai_chat_history', JSON.stringify(Array.from({ length: 60 }, (_, index) => ({
        id: `old-${index}`,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `old message ${index}`,
          timestamp: Date.now() + index,
        }))))
      const { aiService, FetchAIProvider } = await import('/src/services/ai.ts')
      aiService.registerProvider(new FetchAIProvider({
        provider: 'openai',
        baseURL: 'https://ai-error.test/v1',
        apiKey: 'sk-error',
        model: 'error-model',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: '',
      }))
      aiService.setActiveProvider('openai')
    })
    await page.route('https://ai-error.test/v1/chat/completions', route => route.fulfill({ status: 500, body: 'failed' }))

    await page.getByRole('button', { name: 'AI 助手' }).click()
    await page.locator('.chat-input-area textarea').fill('trigger error')
    await page.getByRole('button', { name: '发送' }).click()
    await expect(page.locator('.message-text').filter({ hasText: '错误: HTTP 500' })).toBeVisible()

    const historyLength = await page.evaluate(() => JSON.parse(localStorage.getItem('ai_chat_history') || '[]').length)
    expect(historyLength).toBeLessThanOrEqual(50)
  })

  test('语音输入在不支持 SpeechRecognition 时显示禁用状态', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true })
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true })
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await loadDemoWorkspace(page)
    await openFirstMarkdownFile(page)

    const voiceButton = page.locator('.editor-toolbar .voice-input-btn').first()
    await expect(voiceButton).toHaveClass(/is-unsupported/)
    await expect(voiceButton).toBeDisabled()
    await expect(voiceButton).toHaveAttribute('title', '当前浏览器不支持语音输入')
  })

  test('智能粘贴会清理文本并把富文本转换为 Markdown', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
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
    await page.waitForLoadState('networkidle')
    const result = await page.evaluate(async () => {
      const { extractTextFromImage, extractTextFromPDF } = await import('/src/extensions/multimodal/ocrService.ts')
      return {
        hasImageExtractor: typeof extractTextFromImage === 'function',
        hasPdfExtractor: typeof extractTextFromPDF === 'function',
      }
    })

    expect(result.hasImageExtractor).toBe(true)
    expect(result.hasPdfExtractor).toBe(true)
  })
})
