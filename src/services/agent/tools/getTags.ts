import type { AgentTool, ToolResult } from '../types'
import { fileSystem } from '@/services/fileSystem'
import { parseMarkdownMetadata } from '@/utils/metadata'

export const getTagsTool: AgentTool = {
  name: 'get_tags',
  description: '获取工作区中所有使用的标签，或者单个笔记中的标签',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: '如果指定，只获取该笔记中的标签；否则获取所有标签',
      required: false
    }
  ],
  riskLevel: 'low',
  execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
    try {
      if (params.path) {
        const path = String(params.path)
        const content = await fileSystem.readFileOrEmpty(path)
        const metadata = parseMarkdownMetadata(path, content)
        return {
          success: true,
          data: { path, tags: metadata.tags },
          display: `标签: ${metadata.tags.join(', ')}`
        }
      }

      // 获取所有标签
      const fileRecords = await fileSystem.getAllMarkdownFiles()
      const tagCount = new Map<string, number>()
      for (const fileRecord of fileRecords) {
        const content = await fileSystem.readFileOrEmpty(fileRecord.path)
        const metadata = parseMarkdownMetadata(fileRecord.path, content)
        for (const tag of metadata.tags) {
          tagCount.set(tag, (tagCount.get(tag) || 0) + 1)
        }
      }

      const sortedTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1])
      return {
        success: true,
        data: sortedTags,
        display: sortedTags.map(([tag, count]) => `#${tag} (${count})`).join('\n')
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  }
}
