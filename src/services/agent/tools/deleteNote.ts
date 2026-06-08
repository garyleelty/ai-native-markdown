import type { AgentTool, ToolResult } from '../types'
import { fileSystem } from '@/services/fileSystem'

export const deleteNoteTool: AgentTool = {
  name: 'delete_note',
  description: '删除指定笔记文件。此操作不可逆，请谨慎使用。',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: '要删除的笔记文件路径',
      required: true
    }
  ],
  riskLevel: 'high',
  execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
    try {
      if (!params.path || typeof params.path !== 'string' || params.path.trim() === '') {
        return { success: false, error: 'path is required' }
      }
      const path = String(params.path)

      // Verify file exists before deleting
      const content = await fileSystem.readFileOrEmpty(path)
      if (content === '' && !path.endsWith('.md')) {
        return { success: false, error: `文件不存在: ${path}` }
      }

      await fileSystem.deleteFile(path)
      return {
        success: true,
        data: { path },
        display: `已删除笔记 ${path}`
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  }
}
