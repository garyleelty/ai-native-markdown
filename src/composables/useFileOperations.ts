import { ref, watch, onUnmounted, type Ref } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { fileSystem } from '@/services/fileSystem'
import { versionHistory } from '@/services/versionHistory'
import { ragService } from '@/services/rag'

export function useFileOperations(editorRef: Ref<any>) {
  const editorStore = useEditorStore()
  const settingsStore = useSettingsStore()

  const saveStatusMessage = ref('')
  const saveStatusClass = ref('')

  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const saveCurrentFile = async (filePath?: string) => {
    const path = filePath || editorStore.currentFile
    if (!path) return
    saveStatusMessage.value = '正在保存...'
    saveStatusClass.value = 'text-info'
    try {
      await fileSystem.writeFile(path, editorStore.content)
      editorStore.markSaved()
      await versionHistory.saveSnapshot(path, editorStore.content, '自动保存').catch(() => {})
      if (settingsStore.enableRAG) {
        await ragService.indexDocument(path, editorStore.content).catch(() => {})
      }
      saveStatusMessage.value = '保存成功'
      saveStatusClass.value = 'text-success'
      setTimeout(() => { saveStatusMessage.value = ''; saveStatusClass.value = '' }, 3000)
    } catch (e: any) {
      saveStatusMessage.value = '保存失败'
      saveStatusClass.value = 'text-danger'
    }
  }

  const stopAutoSave = () => {
    if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null }
  }

  watch(() => editorStore.content, () => {
    const filePath = editorStore.currentFile
    if (!filePath) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      if (editorStore.currentFile === filePath) {
        await saveCurrentFile()
      }
    }, 2000)
  })

  const handleFileSelect = async (filePath: string) => {
    if (editorStore.isModified && editorStore.currentFile) {
      await saveCurrentFile()
    }
    try {
      const content = await fileSystem.readFile(filePath)
      editorStore.addTab(filePath, content)
      if (editorRef.value) {
        editorStore.setContentSilent(content)
        editorRef.value.setContent(content)
      }
    } catch (e: any) {
      ElMessage.error('读取文件失败: ' + e.message)
    }
  }

  const handleCloseTab = async (tabId: string) => {
    const tab = editorStore.openTabs.find(t => t.id === tabId)
    if (tab?.isModified) {
      try {
        await ElMessageBox.confirm(`文件 "${tab.fileName}" 有未保存的更改，确定要关闭吗？`, '关闭确认', { type: 'warning' })
      } catch { return }
    }
    editorStore.closeTab(tabId)
    const activeTab = editorStore.getActiveTab()
    if (activeTab && editorRef.value) {
      editorStore.setContentSilent(activeTab.content)
      editorRef.value.setContent(activeTab.content)
    }
  }

  const handleTabChange = (tabId: string | number) => {
    editorStore.switchTab(String(tabId))
    const tab = editorStore.getActiveTab()
    if (tab && editorRef.value) {
      editorStore.setContentSilent(tab.content)
      editorRef.value.setContent(tab.content)
    }
  }

  const handleTemplateSelect = async (content: string, name: string) => {
    try {
      const path = `/workspace/${name}`
      await fileSystem.writeFile(path, content)
      editorStore.addTab(path, content)
      if (editorRef.value) {
        editorStore.setContentSilent(content)
        editorRef.value.setContent(content)
      }
      ElMessage.success('模板已创建')
    } catch (e: any) {
      ElMessage.error('创建失败: ' + e.message)
    }
  }

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    const hasUnsaved = editorStore.openTabs.some(t => t.isModified)
    if (hasUnsaved) {
      e.preventDefault()
      e.returnValue = ''
    }
  }

  const handleSaveKeyDown = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.key === 's') {
      e.preventDefault()
      saveCurrentFile()
    }
  }

  onUnmounted(() => {
    stopAutoSave()
  })

  return {
    saveStatusMessage,
    saveStatusClass,
    saveCurrentFile,
    handleFileSelect,
    handleCloseTab,
    handleTabChange,
    handleTemplateSelect,
    handleBeforeUnload,
    handleSaveKeyDown,
  }
}
