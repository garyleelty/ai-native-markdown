/**
 * 推荐连接工具
 * 基于当前笔记和知识图谱，推荐可以创建的新连接
 */
import { knowledgeIndex } from '@/services/knowledgeIndex'
import type { AgentTool, ToolResult } from '../types'

interface RecommendConnectionsParams {
  currentPath: string
  limit?: number
}

export const recommendConnectionsTool: AgentTool = {
  name: 'recommend_connections',
  description: '基于当前笔记和知识图谱，推荐可以创建的新连接。支持三种推荐类型：1) connect-orphan: 孤立笔记连接建议；2) similar-topic: 相似主题建议；3) missing-link: 缺失链接建议。返回最多 limit 条推荐。',
  parameters: [
    {
      name: 'currentPath',
      type: 'string',
      description: '当前笔记的路径',
      required: true,
    },
    {
      name: 'limit',
      type: 'number',
      description: '返回的推荐数量上限，默认 10',
      required: false,
    },
  ],
  riskLevel: 'low',
  execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
    const p = params as unknown as RecommendConnectionsParams
    const currentPath = p.currentPath
    const limit = p.limit ?? 10

    try {
      const graphData = await knowledgeIndex.buildGraphData()
      const currentRecord = await knowledgeIndex.getByPath(currentPath)

      if (!currentRecord) {
        return {
          success: false,
          error: `找不到笔记: ${currentPath}`,
        }
      }

      // 获取当前笔记的反链
      const backlinks = await knowledgeIndex.getBacklinks(currentPath)
      const linkedPaths = new Set<string>(backlinks.map(b => b.filePath))
      linkedPaths.add(currentPath) // 排除自己

      const suggestions: Array<{
        type: string
        note: string
        path: string
        reason: string
        priority: number
      }> = []

      // 1. 孤立笔记建议
      const orphans = graphData.nodes.filter(n => n.isOrphan && !linkedPaths.has(n.path))
      if (orphans.length > 0) {
        orphans.slice(0, 3).forEach(orphan => {
          suggestions.push({
            type: 'connect-orphan',
            note: orphan.label,
            path: orphan.path,
            reason: `发现 ${graphData.stats.orphanCount} 个孤立笔记，建议连接以构建知识网络`,
            priority: 3,
          })
        })
      }

      // 2. 基于标签的相似主题建议
      const currentTags = new Set(currentRecord.tags)
      if (currentTags.size > 0) {
        const taggedNodes = graphData.nodes.filter(n =>
          n.tags.some(tag => currentTags.has(tag)) && !linkedPaths.has(n.path)
        )
        taggedNodes.slice(0, 5).forEach(node => {
          const sharedTags = node.tags.filter(t => currentTags.has(t))
          suggestions.push({
            type: 'similar-topic',
            note: node.label,
            path: node.path,
            reason: `与当前笔记共享标签: ${sharedTags.join(', ')}`,
            priority: 2,
          })
        })
      }

      // 3. 高连接度但未链接的笔记
      const highConnectivity = graphData.nodes
        .filter(n => n.linkCount >= 3 && !linkedPaths.has(n.path))
        .sort((a, b) => b.linkCount - a.linkCount)
      
      highConnectivity.slice(0, 3).forEach(node => {
        suggestions.push({
          type: 'missing-link',
          note: node.label,
          path: node.path,
          reason: `这篇热门笔记有 ${node.linkCount} 个连接，值得参考`,
          priority: 1,
        })
      })

      // 按优先级排序并限制数量
      const sorted = suggestions
        .sort((a, b) => b.priority - a.priority)
        .slice(0, limit)

      const display = [
        `📊 知识图谱分析结果`,
        ``,
        `**当前笔记**: ${currentRecord.title}`,
        `**总笔记数**: ${graphData.stats.totalNodes}`,
        `**总连接数**: ${graphData.stats.totalEdges}`,
        `**孤立笔记**: ${graphData.stats.orphanCount}`,
        `**当前连接**: ${backlinks.length}`,
        ``,
        `**推荐连接** (${sorted.length}):`,
        ...sorted.map((s, i) => {
          const icon = s.type === 'connect-orphan' ? '🔗' : s.type === 'similar-topic' ? '🏷️' : '⭐'
          return `${i + 1}. ${icon} **${s.note}**\n   ${s.reason}\n   路径: ${s.path}`
        }),
        ``,
        `💡 要创建连接，在当前笔记中添加: [[${sorted[0]?.note || '目标笔记'}]]`,
      ].join('\n')

      return {
        success: true,
        data: sorted,
        display,
      }
    } catch (e) {
      return {
        success: false,
        error: `分析失败: ${e instanceof Error ? e.message : String(e)}`,
      }
    }
  },
}
