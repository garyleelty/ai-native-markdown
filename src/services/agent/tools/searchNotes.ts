import type { AgentTool, ToolResult } from '../types'
import { knowledgeIndex } from '@/services/knowledgeIndex'

function makeSimpleExcerpt(text: string, needle: string): string {
  const index = text.toLowerCase().indexOf(needle.toLowerCase())
  if (index === -1) return text.slice(0, 140)
  const start = Math.max(0, index - 50)
  const end = Math.min(text.length, index + needle.length + 70)
  return `${start > 0 ? '...' : ''}${text.slice(start, end).trim()}${end < text.length ? '...' : ''}`
}

export const searchNotesTool: AgentTool = {
  name: 'search_notes',
  description: '全文搜索笔记内容，返回匹配的文件路径和上下文片段',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: '搜索关键词',
      required: true
    },
    {
      name: 'limit',
      type: 'number',
      description: '返回结果数量上限，默认 10',
      required: false
    }
  ],
  riskLevel: 'low',
  execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const query = String(params.query)
      const limit = Number(params.limit) || 10
      const allRecords = await knowledgeIndex.getAll()
      const results: Array<{ filePath: string; title: string; excerpt: string }> = []
      const lowerQuery = query.toLowerCase()

      for (const record of allRecords) {
        if (results.length >= limit) break
        if (record.searchableText.toLowerCase().includes(lowerQuery)) {
          results.push({
            filePath: record.filePath,
            title: record.title,
            excerpt: makeSimpleExcerpt(record.searchableText, query)
          })
        }
      }

      return {
        success: true,
        data: results,
        display: results
          .map(r => `[${r.filePath}]\n  ${r.excerpt}`)
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
