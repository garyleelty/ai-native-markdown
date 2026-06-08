import type { AgentTool, ToolResult } from '../types'
import { fileSystem } from '@/services/fileSystem'

export const moveNoteTool: AgentTool = {
  name: 'move_note',
  description: '移动或重命名笔记文件',
  parameters: [
    {
      name: 'old_path',
      type: 'string',
      description: '原文件路径',
      required: true
    },
    {
      name: 'new_path',
      type: 'string',
      description: '新文件路径',
      required: true
    }
  ],
  riskLevel: 'high',
  execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
    try {
      if (!params.old_path || typeof params.old_path !== 'string' || params.old_path.trim() === '') {
        return { success: false, error: 'old_path is required' }
      }
      if (!params.new_path || typeof params.new_path !== 'string' || params.new_path.trim() === '') {
        return { success: false, error: 'new_path is required' }
      }
      const oldPath = String(params.old_path)
      const newPath = String(params.new_path)

      if (oldPath === newPath) {
        return { success: false, error: 'old_path 和 new_path 不能相同' }
      }

      const result = await fileSystem.renameFile(oldPath, newPath)
      return {
        success: true,
        data: { oldPath, newPath, renamedCount: result.renamedPaths.length },
        display: `已将 ${oldPath} 移动到 ${newPath}`
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  }
}
