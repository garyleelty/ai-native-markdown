import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { vaultService } from '@/services/vault'
import { versionHistory } from '@/services/versionHistory'
import { useEditorStore } from '@/stores/editor'

type ExternalConflictDiskState = 'changed' | 'missing' | 'unreadable'

export interface ExternalConflictRecord {
  path: string
  localContent: string
  diskContent: string
  diskState: ExternalConflictDiskState
  changedAt: number
}

export interface ExternalConflictPreviewLine {
  type: 'local' | 'disk'
  lineNumber: number
  content: string
}

export function useConflictHandler(options: {
  editorRef: () => any
}) {
  const editorStore = useEditorStore()
  const externalConflicts = ref<ExternalConflictRecord[]>([])

  const currentExternalConflict = () => (
    editorStore.currentFile
      ? externalConflicts.value.find(conflict => conflict.path === editorStore.currentFile) || null
      : null
  )

  const otherExternalConflicts = () => (
    editorStore.currentFile
      ? externalConflicts.value.filter(conflict => conflict.path !== editorStore.currentFile)
      : externalConflicts.value
  )

  const clearExternalConflict = (path: string) => {
    externalConflicts.value = externalConflicts.value.filter(item => item.path !== path)
  }

  const markExternalConflict = (
    path: string,
    localContent: string,
    diskContent: string,
    diskState: ExternalConflictDiskState = 'changed'
  ) => {
    const record: ExternalConflictRecord = {
      path,
      localContent,
      diskContent,
      diskState,
      changedAt: Date.now(),
    }
    const index = externalConflicts.value.findIndex(item => item.path === path)
    if (index === -1) {
      externalConflicts.value = [...externalConflicts.value, record]
      return
    }
    externalConflicts.value = externalConflicts.value.map((item, itemIndex) => itemIndex === index ? record : item)
  }

  const changeTouchesFile = (event: any, filePath: string): boolean => {
    const changedPath = event?.path
    if (!changedPath || changedPath === '/workspace') return true
    return filePath === changedPath ||
      filePath.startsWith(`${changedPath}/`) ||
      changedPath.startsWith(`${filePath}/`)
  }

  function splitConflictLines(content: string): string[] {
    return content.split(/\r?\n/)
  }

  function countContentLines(content: string): number {
    if (!content) return 0
    return splitConflictLines(content).length
  }

  function countChangedLines(conflict: ExternalConflictRecord): { local: number; disk: number } {
    const localLines = splitConflictLines(conflict.localContent)
    const diskLines = splitConflictLines(conflict.diskContent)
    const maxLines = Math.max(localLines.length, diskLines.length)
    let local = 0
    let disk = 0
    for (let index = 0; index < maxLines; index += 1) {
      if ((localLines[index] ?? '') === (diskLines[index] ?? '')) continue
      if (localLines[index] !== undefined) local += 1
      if (diskLines[index] !== undefined) disk += 1
    }
    return { local, disk }
  }

  function formatConflictFileName(path: string): string {
    return path.split('/').pop() || path
  }

  function formatExternalConflictOverviewMessage(): string {
    return `${externalConflicts.value.length} 个文件存在外部冲突，本地未保存内容已保留。`
  }

  function formatExternalConflictMessage(conflict: ExternalConflictRecord): string {
    if (conflict.diskState === 'missing') {
      return '磁盘上的文件已被删除，本地未保存内容已保留。保存会重新创建该文件。'
    }
    if (conflict.diskState === 'unreadable') {
      return '磁盘版本暂时无法读取，本地未保存内容已保留。'
    }
    return '磁盘上的文件已更新，本地未保存内容已保留。'
  }

  function formatExternalConflictSummary(conflict: ExternalConflictRecord): string {
    const changedTime = new Date(conflict.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (conflict.diskState === 'missing') {
      return `删除预览：磁盘文件缺失，本地 ${countContentLines(conflict.localContent)} 行已保留 · ${changedTime}`
    }
    if (conflict.diskState === 'unreadable') {
      return `读取失败：暂时无法生成磁盘差异，本地 ${countContentLines(conflict.localContent)} 行已保留 · ${changedTime}`
    }
    const stats = countChangedLines(conflict)
    return `差异预览：本地 ${stats.local} 行，磁盘 ${stats.disk} 行不同 · ${changedTime}`
  }

  function buildUnavailableExternalConflictPreview(
    conflict: ExternalConflictRecord,
    diskMessage: string,
    maxRows: number
  ): ExternalConflictPreviewLine[] {
    const preview: ExternalConflictPreviewLine[] = [{ type: 'disk', lineNumber: 0, content: diskMessage }]
    const localLines = splitConflictLines(conflict.localContent)
    for (let index = 0; index < localLines.length && preview.length < maxRows; index += 1) {
      preview.push({ type: 'local', lineNumber: index + 1, content: localLines[index] })
    }
    return preview
  }

  function buildExternalConflictPreview(conflict: ExternalConflictRecord, maxRows = 8): ExternalConflictPreviewLine[] {
    if (conflict.diskState === 'missing') {
      return buildUnavailableExternalConflictPreview(conflict, '磁盘文件缺失', maxRows)
    }
    if (conflict.diskState === 'unreadable') {
      return buildUnavailableExternalConflictPreview(conflict, '磁盘版本暂时不可读取', maxRows)
    }

    const localLines = splitConflictLines(conflict.localContent)
    const diskLines = splitConflictLines(conflict.diskContent)
    const maxLines = Math.max(localLines.length, diskLines.length)
    const preview: ExternalConflictPreviewLine[] = []

    for (let index = 0; index < maxLines && preview.length < maxRows; index += 1) {
      const localLine = localLines[index]
      const diskLine = diskLines[index]
      if ((localLine ?? '') === (diskLine ?? '')) continue
      if (localLine !== undefined && preview.length < maxRows) {
        preview.push({ type: 'local', lineNumber: index + 1, content: localLine })
      }
      if (diskLine !== undefined && preview.length < maxRows) {
        preview.push({ type: 'disk', lineNumber: index + 1, content: diskLine })
      }
    }

    return preview
  }

  function formatConflictLineMarker(type: ExternalConflictPreviewLine['type']): string {
    return type === 'local' ? '本地' : '磁盘'
  }

  function isExternalConflictReloadable(conflict: ExternalConflictRecord): boolean {
    return conflict.diskState === 'changed'
  }

  async function resolveUnavailableConflictDiskState(
    filePath: string,
    event?: any
  ): Promise<ExternalConflictDiskState> {
    if (event?.reason?.toLowerCase() === 'delete') return 'missing'
    try {
      const files = await vaultService.getAllMarkdownFiles()
      return files.some(file => file.path === filePath) ? 'unreadable' : 'missing'
    } catch {
      return event?.reason?.toLowerCase() === 'rename' ? 'missing' : 'unreadable'
    }
  }

  const reloadCurrentConflictFromDisk = async () => {
    const path = editorStore.currentFile
    if (!path) return
    try {
      const diskContent = await vaultService.readFile(path)
      const activeTab = editorStore.getActiveTab()
      if (activeTab?.filePath === path) {
        activeTab.content = diskContent
        activeTab.isModified = false
      }
      editorStore.setContentSilent(diskContent)
      options.editorRef()?.setContent(diskContent)
      editorStore.setContentSilent(diskContent)
      clearExternalConflict(path)
      ElMessage.success('已重新载入磁盘版本')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ElMessage.error(`重新载入失败: ${message}`)
    }
  }

  const keepCurrentConflictLocal = () => {
    const path = editorStore.currentFile
    if (!path) return
    clearExternalConflict(path)
    ElMessage.success('已保留本地未保存内容')
  }

  const saveCurrentConflictSnapshot = async () => {
    const conflict = currentExternalConflict()
    if (!conflict) return
    try {
      await versionHistory.saveSnapshot(conflict.path, conflict.localContent, '外部冲突：本地未保存版本')
      ElMessage.success('已保存本地快照')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ElMessage.error(`保存本地快照失败: ${message}`)
    }
  }

  const syncOpenTabsFromVault = async (event?: any) => {
    for (const tab of [...editorStore.openTabs]) {
      if (!changeTouchesFile(event, tab.filePath)) continue
      if (tab.isModified) {
        try {
          const latestContent = await vaultService.readFile(tab.filePath)
          if (latestContent !== tab.content) markExternalConflict(tab.filePath, tab.content, latestContent)
          else clearExternalConflict(tab.filePath)
        } catch {
          const diskState = await resolveUnavailableConflictDiskState(tab.filePath, event)
          markExternalConflict(tab.filePath, tab.content, '', diskState)
        }
        continue
      }
      try {
        const latestContent = await vaultService.readFile(tab.filePath)
        tab.content = latestContent
        tab.isModified = false
        clearExternalConflict(tab.filePath)
      } catch {
        editorStore.removeOpenPath(tab.filePath, false)
        clearExternalConflict(tab.filePath)
      }
    }

    const activeTab = editorStore.getActiveTab()
    if (!activeTab) {
      editorStore.setContentSilent('')
      options.editorRef()?.setContent('')
      editorStore.setContentSilent('')
      return
    }
    if (!activeTab.isModified) {
      editorStore.setContentSilent(activeTab.content)
      options.editorRef()?.setContent(activeTab.content)
      editorStore.setContentSilent(activeTab.content)
    }
  }

  return {
    externalConflicts,
    currentExternalConflict,
    otherExternalConflicts,
    clearExternalConflict,
    markExternalConflict,
    changeTouchesFile,
    formatConflictFileName,
    formatExternalConflictOverviewMessage,
    formatExternalConflictMessage,
    formatExternalConflictSummary,
    buildExternalConflictPreview,
    formatConflictLineMarker,
    isExternalConflictReloadable,
    reloadCurrentConflictFromDisk,
    keepCurrentConflictLocal,
    saveCurrentConflictSnapshot,
    syncOpenTabsFromVault,
  }
}
