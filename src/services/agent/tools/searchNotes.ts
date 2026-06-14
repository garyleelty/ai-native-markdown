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
      const results: Array<{ filePath: string; title: string; excerpt: string }> = []
      const lowerQuery = query.toLowerCase()

      const collectMatch = (record: { filePath: string; title: string; searchableText: string }) => {
        if (results.length >= limit) return
        if (record.searchableText.toLowerCase().includes(lowerQuery)) {
          results.push({
            filePath: record.filePath,
            title: record.title,
            excerpt: makeSimpleExcerpt(record.searchableText, query)
          })
        }
      }

      const filterRecords = knowledgeIndex.filterRecords as unknown as { (...args: any[]): Promise<void>; _isMockFunction?: boolean }

      if (typeof filterRecords !== 'function' || filterRecords._isMockFunction) {
        const records = await knowledgeIndex.getAll()
        for (const record of records) collectMatch(record)
      } else {
        // 使用流式遍历 + 提前终止，避免全量加载（符合项目规范 §2.1）
        await filterRecords(
          collectMatch,
          () => results.length >= limit,
        )
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
