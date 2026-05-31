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
    data = await resp.arrayBuffer()
  }

  const pdf = await pdfjsLib.getDocument({ data }).promise
  const texts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ')
    texts.push(pageText)
  }

  return texts.join('\n\n')
}
