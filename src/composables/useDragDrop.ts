import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { vaultService } from '@/services/vault'
import { useEditorStore } from '@/stores/editor'

export function useDragDrop(options: {
  editorRef: () => any
  preferReadableMobileView: () => void
  refreshMarkdownPaths: () => Promise<void>
}) {
  const editorStore = useEditorStore()
  const isDragging = ref(false)
  const dragCounter = ref(0)

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    dragCounter.value++
    isDragging.value = true
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    dragCounter.value--
    if (dragCounter.value === 0) isDragging.value = false
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    isDragging.value = false
    dragCounter.value = 0
    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    let importedCount = 0
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
        try {
          const content = await file.text()
          const path = `/workspace/${file.name}`
          await vaultService.writeFile(path, content)
          editorStore.addTab(path, content)
          if (options.editorRef()) {
            editorStore.setContentSilent(content)
            options.editorRef().setContent(content)
          }
          options.preferReadableMobileView()
          importedCount++
        } catch {
          ElMessage.error(`导入 ${file.name} 失败`)
        }
      }
    }
    await options.refreshMarkdownPaths()
    if (importedCount > 0) {
      ElMessage.success(`已导入 ${importedCount} 个 Markdown 文件`)
    } else {
      ElMessage.warning('未导入文件：仅支持 Markdown 文件')
    }
  }

  return {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  }
}
