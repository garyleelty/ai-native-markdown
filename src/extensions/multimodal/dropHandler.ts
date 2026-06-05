import { EditorView } from '@codemirror/view'
import { ElMessage } from 'element-plus'
import { extractTextFromImage, extractTextFromPDF } from './ocrService'

const SUPPORTED_IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
const PDF_EXT = '.pdf'

type Extractors = {
  image: typeof extractTextFromImage
  pdf: typeof extractTextFromPDF
}

type DispatchingView = Pick<EditorView, 'dispatch'>

const defaultExtractors: Extractors = {
  image: extractTextFromImage,
  pdf: extractTextFromPDF,
}

function getFileExt(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : ''
}

export const dropHandlerExtension = EditorView.domEventHandlers({
  drop(event, view) {
    event.preventDefault()
    event.stopPropagation()

    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return false

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) return false

    void insertDroppedFiles(Array.from(files), pos, view)

    return true
  },

  dragover(event) {
    event.preventDefault()
    event.stopPropagation()
    return true
  }
})

function getFileSource(file: File): string | File {
  return (file as any).path || file
}

function advancePosition(pos: number, inserted: string): number {
  return pos + inserted.length
}

export async function insertDroppedFiles(
  files: File[],
  startPos: number,
  view: DispatchingView,
  extractors: Extractors = defaultExtractors
) {
  let insertPos = startPos

  for (const file of files) {
    const ext = getFileExt(file.name)

    if (SUPPORTED_IMAGE_EXTS.includes(ext)) {
      const imageSource = getFileSource(file)
      const imageTarget = typeof imageSource === 'string' ? imageSource : file.name
      const imageMarkdown = `\n![${file.name}](${imageTarget})\n`
      view.dispatch({
        changes: { from: insertPos, insert: imageMarkdown }
      })
      insertPos = advancePosition(insertPos, imageMarkdown)

      try {
        const text = await extractors.image(imageSource)
        if (text) {
          const ocrMarkdown = `\n> OCR 提取文字:\n> ${text.split('\n').join('\n> ')}\n`
          view.dispatch({
            changes: { from: insertPos, insert: ocrMarkdown }
          })
          insertPos = advancePosition(insertPos, ocrMarkdown)
        }
      } catch (e) {
        ElMessage.error('OCR 提取失败，请检查图片内容后重试')
      }
    } else if (ext === PDF_EXT) {
      const pdfSource = getFileSource(file)

      try {
        const text = await extractors.pdf(pdfSource)
        if (text) {
          const pdfMarkdown = `\n---\n${text}\n---\n`
          view.dispatch({
            changes: { from: insertPos, insert: pdfMarkdown }
          })
          insertPos = advancePosition(insertPos, pdfMarkdown)
        }
      } catch (e) {
        ElMessage.error('PDF 提取失败，请检查文件内容后重试')
      }
    }
  }
}
