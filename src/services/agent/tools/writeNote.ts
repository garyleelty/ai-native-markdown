import type { AgentTool, ToolResult } from '../types'
import { fileSystem } from '@/services/fileSystem'

export const writeNoteTool: AgentTool = {
  name: 'write_note',
  description: '创建或更新笔记内容',
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
      description: '要写入的内容',
      required: true
    }
  ],
  riskLevel: 'high',
  execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
    try {
      if (!params.path || typeof params.path !== 'string' || params.path.trim() === '') {
        return {
          success: false,
          error: 'path is required'
        }
      }
      if (!params.content || typeof params.content !== 'string') {
        return {
          success: false,
          error: 'content is required'
        }
      }
      const path = String(params.path)
      const content = String(params.content)
      await fileSystem.writeFile(path, content)
      return {
        success: true,
        data: { path, content },
        display: `已保存到 ${path}`
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  }
}
