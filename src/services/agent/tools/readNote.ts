import type { AgentTool, ToolResult } from '../types'
import { fileSystem } from '@/services/fileSystem'

export const readNoteTool: AgentTool = {
  name: 'read_note',
  description: '读取指定笔记的完整内容',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: '要读取的笔记文件路径',
      required: true
    }
  ],
  riskLevel: 'low',
  execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
    try {
      if (!params.path || typeof params.path !== 'string' || params.path.trim() === '') {
        return {
          success: false,
          error: 'path is required'
        }
      }
      const path = String(params.path)
      const content = await fileSystem.readFileOrEmpty(path)
      return {
        success: true,
        data: { path, content },
        display: content
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  }
}
