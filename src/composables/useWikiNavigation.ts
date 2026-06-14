import { nextTick, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useEditorStore } from '@/stores/editor'
import { vaultService } from '@/services/vault'
import type { KnowledgeReference } from '@/services/knowledgeIndex'
import {
  createWikiLinkInitialContent,
  findMarkdownBlockLine,
  findMarkdownHeadingLine,
  getCreatableWikiLinkPath,
  linkFirstUnlinkedMention,
  parseWikiLinkTarget,
  resolveWikiLinkTarget,
} from '@/utils/wikiLinks'

export function useWikiNavigation(options: {
  editorStore: () => ReturnType<typeof useEditorStore>
  editorContent: () => string
  markdownPaths: () => Ref<string[]>
  sidebarRef: () => any
  editorRef: () => any
  handleFileSelect: (filePath: string, options?: any) => Promise<void>
  handleOutlineNavigate: (lineNumber: number) => Promise<void>
  refreshMarkdownPaths: () => Promise<void>
}) {
  const handleWikiNavigate = async (target: string) => {
    try {
      const markdownFiles = await vaultService.getAllMarkdownFiles()
      options.markdownPaths().value = markdownFiles.map(file => file.path)
      const parsedTarget = parseWikiLinkTarget(target)
      const currentPath = options.editorStore().currentFile
      const resolvedPath = resolveWikiLinkTarget(
        target,
        currentPath,
        markdownFiles.map(file => file.path)
      )
      if (!resolvedPath) {
        const creatablePath = getCreatableWikiLinkPath(target, currentPath)
        if (!creatablePath) {
          ElMessage.warning(`未找到链接目标: ${target}`)
          return
        }
        await vaultService.writeFile(creatablePath, createWikiLinkInitialContent(target))
        await options.refreshMarkdownPaths()
        await options.sidebarRef()?.refreshTree?.()
        await options.handleFileSelect(creatablePath)
        ElMessage.success(`已创建 ${creatablePath.split('/').pop()}`)
        return
      }
      const resolvedFile = markdownFiles.find(file => file.path === resolvedPath)
      const headingContent = resolvedPath === currentPath ? options.editorContent() : resolvedFile?.content
      if (resolvedPath !== currentPath) {
        await options.handleFileSelect(resolvedPath)
        await options.refreshMarkdownPaths()
      }
      const headingLine = parsedTarget.heading
        ? (parsedTarget.heading.startsWith('^')
            ? findMarkdownBlockLine(headingContent || '', parsedTarget.heading)
            : findMarkdownHeadingLine(headingContent || '', parsedTarget.heading))
        : null
      if (headingLine) {
        await options.handleOutlineNavigate(headingLine)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ElMessage.error(`打开链接失败: ${message}`)
    }
  }

  const handleKnowledgeReferenceSelect = async (reference: KnowledgeReference) => {
    await options.handleFileSelect(reference.filePath)
    if (reference.lineNumber && options.editorStore().currentFile === reference.filePath) {
      await nextTick()
      await options.handleOutlineNavigate(reference.lineNumber)
    }
  }

  const handleLinkMention = async (payload: { reference: KnowledgeReference; targetTitle: string; targetNames: string[] }) => {
    try {
      const store = options.editorStore()
      const sourceTab = store.openTabs.find(tab => tab.filePath === payload.reference.filePath)
      const sourceContent = sourceTab?.content ?? await vaultService.readFile(payload.reference.filePath)
      const updatedContent = linkFirstUnlinkedMention(
        sourceContent,
        payload.targetNames,
        payload.targetTitle,
        { lineNumber: payload.reference.lineNumber }
      )
      if (!updatedContent) {
        ElMessage.warning('没有找到可安全链接的提及')
        return
      }
      await vaultService.writeFile(payload.reference.filePath, updatedContent)
      if (sourceTab) {
        sourceTab.content = updatedContent
        sourceTab.isModified = false
      }
      if (store.currentFile === payload.reference.filePath) {
        store.setContentSilent(updatedContent)
        options.editorRef()?.setContent(updatedContent)
      }
      await options.refreshMarkdownPaths()
      ElMessage.success('已链接提及')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ElMessage.error(`链接提及失败: ${message}`)
    }
  }

  return {
    handleWikiNavigate,
    handleKnowledgeReferenceSelect,
    handleLinkMention,
  }
}
