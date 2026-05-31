import { extractTextFromImage as tesseractExtract } from '@/services/ocr'
import { aiService } from '@/services/ai'

export async function extractTextFromImage(imageSource: string): Promise<string> {
  const ocrText = await tesseractExtract(imageSource)

  const provider = aiService.getActiveProvider()
  if (!provider) return ocrText

  let refined = ''
  for await (const chunk of provider.streamChat([
    {
      role: 'user',
      content: `请校对以下 OCR 识别结果，修正其中的错误，只输出修正后的文字，不要加任何解释：\n\n${ocrText}`
    }
  ], { temperature: 0.1, maxTokens: 2000 })) {
    refined += chunk
  }

  return refined.trim() || ocrText
}

export async function extractTextFromPDF(pdfPath: string): Promise<string> {
  const provider = aiService.getActiveProvider()
  if (!provider) throw new Error('未配置 AI 服务')

  let result = ''
  for await (const chunk of provider.streamChat([
    {
      role: 'user',
      content: `请从以下 PDF 文件路径中提取关键文字内容：\n\n${pdfPath}`
    }
  ], { temperature: 0.1, maxTokens: 4000 })) {
    result += chunk
  }

  return result.trim()
}
