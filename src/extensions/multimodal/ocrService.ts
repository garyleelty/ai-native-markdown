import { aiService } from '@/services/ai'

export async function extractTextFromImage(imageSource: string | File): Promise<string> {
  const { extractTextFromImage: tesseractExtract } = await import('@/services/ocr')
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

export async function extractTextFromPDF(pdfSource: string | File | ArrayBuffer): Promise<string> {
  const { extractTextFromPDF: extractPDFText } = await import('@/services/pdf')
  return extractPDFText(pdfSource)
}
