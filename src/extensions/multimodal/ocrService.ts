const isTauri = '__TAURI_INTERNALS__' in window

async function tauriInvoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  if (!isTauri) throw new Error('Tauri 环境不可用')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(cmd, args)
}

export async function extractTextFromImage(imagePath: string): Promise<string> {
  const dataUri = await tauriInvoke('ocr_extract_text', { imagePath }) as string

  const { aiService } = await import('@/services/ai')
  const provider = aiService.getActiveProvider()
  if (!provider) throw new Error('未配置 AI 服务')

  let result = ''
  for await (const chunk of provider.streamChat([
    {
      role: 'user',
      content: `请提取这张图片中的所有文字内容，只输出提取的文字，不要加任何解释：\n\n![图片](${dataUri})`
    }
  ], { temperature: 0.1, maxTokens: 2000 })) {
    result += chunk
  }

  return result.trim()
}

export async function extractTextFromPDF(pdfPath: string): Promise<string> {
  const placeholder = await tauriInvoke('pdf_extract_text', { pdfPath }) as string

  const { aiService } = await import('@/services/ai')
  const provider = aiService.getActiveProvider()
  if (!provider) throw new Error('未配置 AI 服务')

  let result = ''
  for await (const chunk of provider.streamChat([
    {
      role: 'user',
      content: `请从以下 PDF 文件引用中提取关键文字内容：\n\n${placeholder}`
    }
  ], { temperature: 0.1, maxTokens: 4000 })) {
    result += chunk
  }

  return result.trim()
}
