import type { AgentTool, ToolResult } from '../types'
import { knowledgeIndex } from '@/services/knowledgeIndex'

export const getBacklinksTool: AgentTool = {
  name: 'get_backlinks',
  description: '获取指向指定笔记的所有反向链接',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: '要查询反向链接的笔记文件路径',
      required: true
    }
  ],
  riskLevel: 'low',
  execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const path = String(params.path)
      const backlinks = await knowledgeIndex.getBacklinks(path)
      return {
        success: true,
        data: backlinks,
        display: backlinks
          .map(bl => `[${bl.filePath}]\n  ${bl.excerpt}`)
          .join('\n\n')
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  }
}
