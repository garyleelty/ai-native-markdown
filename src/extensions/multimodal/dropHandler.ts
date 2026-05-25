import { EditorView } from '@codemirror/view'
import { extractTextFromImage } from './ocrService'

const SUPPORTED_IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
const PDF_EXT = '.pdf'

function getFileExt(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : ''
}

export const dropHandlerExtension = EditorView.domEventHandlers({
  drop(event, view) {
    event.preventDefault()

    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return false

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) return false

    // 异步处理文件，不阻塞事件处理
    handleDroppedFiles(files, pos, view)

    return true
  },

  dragover(event) {
    event.preventDefault()
    return true
  }
})

async function handleDroppedFiles(files: FileList, pos: number, view: EditorView) {
  for (const file of Array.from(files)) {
    const ext = getFileExt(file.name)

    if (SUPPORTED_IMAGE_EXTS.includes(ext)) {
      const imagePath = (file as any).path as string
      if (imagePath) {
        view.dispatch({
          changes: { from: pos, insert: `\n![${file.name}](${imagePath})\n` }
        })

        try {
          const text = await extractTextFromImage(imagePath)
          if (text) {
            view.dispatch({
              changes: { from: pos, insert: `\n> 📷 OCR 提取文字:\n> ${text.split('\n').join('\n> ')}\n` }
            })
          }
        } catch (e) {
          console.error('OCR 提取失败:', e)
        }
      }
    } else if (ext === PDF_EXT) {
      const pdfPath = (file as any).path as string
      if (pdfPath) {
        view.dispatch({
          changes: { from: pos, insert: `\n📄 正在提取 PDF 文字...\n` }
        })

        try {
          const { extractTextFromPDF } = await import('./ocrService')
          const text = await extractTextFromPDF(pdfPath)
          if (text) {
            view.dispatch({
              changes: { from: pos, insert: `\n---\n${text}\n---\n` }
            })
          }
        } catch (e) {
          console.error('PDF 提取失败:', e)
        }
      }
    }
  }
}
