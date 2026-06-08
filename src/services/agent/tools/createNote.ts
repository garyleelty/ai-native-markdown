import type { AgentTool, ToolResult } from '../types'
import { fileSystem } from '@/services/fileSystem'

export const createNoteTool: AgentTool = {
  name: 'create_note',
  description: '创建一个新笔记文件。如果文件已存在则返回错误。',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: '新笔记的文件路径，例如 /notes/new-note.md',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      description: '笔记的初始内容',
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
      const content = String(params.content)

      // Check if file already exists
      const existing = await fileSystem.readFileOrEmpty(path)
      if (existing !== '') {
        return { success: false, error: `文件已存在: ${path}，请使用 write_note 来覆盖` }
      }

      await fileSystem.writeFile(path, content)
      return {
        success: true,
        data: { path, content },
        display: `已创建笔记 ${path}`
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  }
}
