import type { AgentTool, ToolResult } from '../types'
import { fileSystem } from '@/services/fileSystem'

export const listNotesTool: AgentTool = {
  name: 'list_notes',
  description: '列出工作区中的所有 Markdown 笔记',
  parameters: [
    {
      name: 'limit',
      type: 'number',
      description: '返回的最大文件数量，默认是 50',
      required: false
    },
    {
      name: 'prefix',
      type: 'string',
      description: '只列出以指定前缀开头的文件',
      required: false
    }
  ],
  riskLevel: 'low',
  execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
    try {
      let fileRecords = await fileSystem.getAllMarkdownFiles()
      let filePaths = fileRecords.map(f => f.path)
      if (params.prefix) {
        filePaths = filePaths.filter(file => file.startsWith(String(params.prefix)))
      }
      const limit = Number(params.limit) || 50
      filePaths = filePaths.slice(0, limit)
      return {
        success: true,
        data: filePaths,
        display: `找到 ${filePaths.length} 个文件:\n${filePaths.join('\n')}`
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  }
}
