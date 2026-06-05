import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export async function extractTextFromPDF(source: string | File | ArrayBuffer): Promise<string> {
  let data: ArrayBuffer
  if (source instanceof ArrayBuffer) {
    data = source
  } else if (source instanceof File) {
    data = await source.arrayBuffer()
  } else {
    const resp = await fetch(source)
    if (!resp.ok) throw new Error(`PDF fetch failed: HTTP ${resp.status}`)
    data = await resp.arrayBuffer()
  }

  const pdf = await pdfjsLib.getDocument({ data }).promise
  const texts: string[] = []

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      try {
        const content = await page.getTextContent()
        const pageText = content.items
          .map((item: any) => item.str)
          .join(' ')
        texts.push(pageText)
      } finally {
        page.cleanup()
      }
    }
  } finally {
    await pdf.destroy()
  }

  return texts.join('\n\n')
}
