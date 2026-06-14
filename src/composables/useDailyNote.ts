import { ElMessage } from 'element-plus'
import { vaultService } from '@/services/vault'

export const getLocalDateStamp = (date = new Date()): string => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')

export const createDailyNoteContent = (dateStamp: string): string => [
  '---',
  `date: ${dateStamp}`,
  'tags: [daily]',
  '---',
  '',
  `# ${dateStamp}`,
  '',
  '## 今日重点',
  '',
  '- ',
  '',
  '## 记录',
  '',
].join('\n')

const ensureDailyDirectory = async (): Promise<void> => {
  try {
    await vaultService.createDirectory('/workspace/Daily')
  } catch {
    await vaultService.readDirectory('/workspace/Daily')
  }
}

export function useDailyNote(options: {
  sidebarRef: () => any
  handleFileSelect: (filePath: string, options?: any) => Promise<void>
  refreshMarkdownPaths: () => Promise<void>
}) {
  const openDailyNote = async () => {
    try {
      const dateStamp = getLocalDateStamp()
      const path = `/workspace/Daily/${dateStamp}.md`
      let created = false

      await ensureDailyDirectory()
      try {
        await vaultService.readFile(path)
      } catch {
        await vaultService.writeFile(path, createDailyNoteContent(dateStamp))
        created = true
      }

      await options.refreshMarkdownPaths()
      await options.sidebarRef()?.refreshTree?.()
      await options.handleFileSelect(path)
      ElMessage.success(created ? '已创建今日笔记' : '已打开今日笔记')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ElMessage.error(`打开今日笔记失败: ${message}`)
    }
  }

  return { openDailyNote }
}
