import type { AgentTool, ToolResult } from '../types'
import { fileSystem } from '@/services/fileSystem'

export const appendToNoteTool: AgentTool = {
  name: 'append_to_note',
  description: '在笔记末尾追加内容，不会覆盖已有内容',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: '笔记文件路径',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      description: '要追加到末尾的内容',
      required: true
    }
  ],
  riskLevel: 'low',
  execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
    try {
      if (!params.path || typeof params.path !== 'string' || params.path.trim() === '') {
        return { success: false, error: 'path is required' }
      }
      if (!params.content || typeof params.content !== 'string') {
        return { success: false, error: 'content is required' }
      }
      const path = String(params.path)
      const appendContent = String(params.content)

      const existing = await fileSystem.readFileOrEmpty(path)
      const separator = existing && !existing.endsWith('\n') ? '\n' : ''
      const newContent = existing + separator + appendContent

      await fileSystem.writeFile(path, newContent)
      return {
        success: true,
        data: { path, appendedLength: appendContent.length },
        display: `已追加内容到 ${path}（+${appendContent.length} 字符）`
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  }
}
