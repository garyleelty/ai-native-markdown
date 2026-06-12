import type { AgentContext, GraphInsights } from './types'
import { parseFrontmatter } from '@/utils/metadata'
import { fileSystem } from '@/services/fileSystem'
import { knowledgeIndex } from '@/services/knowledgeIndex'

class ContextBuilderImpl {
  async build(options?: {
    currentFile?: { path: string; content: string }
    recentFiles?: string[]
    withRag?: boolean
    withGraphInsights?: boolean
  }): Promise<AgentContext> {
    let currentFile: AgentContext['currentFile'] = null

    if (options?.currentFile) {
      const { frontmatter, body } = parseFrontmatter(options.currentFile.content)
      const tags: string[] = Array.isArray(frontmatter.tags) 
        ? frontmatter.tags 
        : typeof frontmatter.tags === 'string'
        ? frontmatter.tags.split(',').map(t => t.trim())
        : []
      currentFile = {
        path: options.currentFile.path,
        content: options.currentFile.content,
        frontmatter,
        tags
      }
    }

    let backlinks: AgentContext['backlinks'] = []
    let mentions: AgentContext['mentions'] = []

    if (currentFile) {
      try {
        const refs = await knowledgeIndex.getBacklinks(currentFile.path)
        backlinks = refs.map(r => ({ path: r.filePath, context: r.excerpt }))
      } catch {
        // ignore errors
      }
      try {
        const refs = await knowledgeIndex.getUnlinkedMentions(currentFile.path)
        mentions = refs.map(r => ({ path: r.filePath, context: r.excerpt }))
      } catch {
        // ignore errors
      }
    }

    let recentFiles: string[] = []
    if (options?.recentFiles) {
      recentFiles = options.recentFiles
    } else {
      try {
        const fileRecords = await fileSystem.getAllMarkdownFiles()
        recentFiles = fileRecords.map(f => f.path).slice(0, 10)
      } catch {
        // ignore errors
      }
    }

    let ragContext: string | undefined
    if (options?.withRag && currentFile) {
      ragContext = await this.buildRagContext(currentFile)
    }

    // 构建图谱洞察
    let graphInsights: GraphInsights | undefined
    if (options?.withGraphInsights) {
      graphInsights = await this.buildGraphInsights(currentFile, backlinks)
    }

    return {
      currentFile,
      backlinks,
      mentions,
      recentFiles,
      ragContext,
      graphInsights,
    }
  }

  private async buildRagContext(currentFile: { path: string; content: string }): Promise<string> {
    return '' // placeholder for RAG context
  }

  /**
   * 构建图谱洞察
   */
  private async buildGraphInsights(
    currentFile: AgentContext['currentFile'],
    backlinks: AgentContext['backlinks']
  ): Promise<GraphInsights> {
    const graphData = await knowledgeIndex.buildGraphData()
    
    const insights: GraphInsights = {
      totalNotes: graphData.stats.totalNodes,
      totalLinks: graphData.stats.totalEdges,
      orphanCount: graphData.stats.orphanCount,
    }

    // 当前笔记的位置信息
    if (currentFile) {
      const currentNode = graphData.nodes.find(n => n.path === currentFile.path)
      if (currentNode) {
        // 获取邻居节点
        const neighborEdges = graphData.edges.filter(
          e => String(e.source) === currentFile.path || String(e.target) === currentFile.path
        )
        const neighborPaths = new Set<string>()
        neighborEdges.forEach(e => {
          if (String(e.source) === currentFile.path) neighborPaths.add(String(e.target))
          if (String(e.target) === currentFile.path) neighborPaths.add(String(e.source))
        })
        const neighbors = graphData.nodes
          .filter(n => neighborPaths.has(n.path))
          .map(n => ({ title: n.label, path: n.path }))

        insights.currentNotePosition = {
          linkCount: currentNode.linkCount,
          isOrphan: currentNode.isOrphan,
          neighbors,
        }

        // 生成连接建议
        insights.suggestions = this.generateConnectionSuggestions(
          graphData,
          currentFile,
          currentNode,
          backlinks
        )
      }
    }

    return insights
  }

  /**
   * 生成连接建议
   */
  private generateConnectionSuggestions(
    graphData: Awaited<ReturnType<typeof knowledgeIndex.buildGraphData>>,
    currentFile: AgentContext['currentFile'],
    currentNode: { linkCount: number; isOrphan: boolean; tags: string[] },
    backlinks: AgentContext['backlinks']
  ): GraphInsights['suggestions'] {
    const suggestions: GraphInsights['suggestions'] = []
    const currentPath = currentFile!.path

    // 1. 孤立节点建议（如果当前笔记是孤立的）
    if (currentNode.isOrphan && graphData.stats.orphanCount > 1) {
      const otherOrphans = graphData.nodes.filter(
        n => n.isOrphan && n.path !== currentPath
      ).slice(0, 3)
      
      otherOrphans.forEach(orphan => {
        suggestions.push({
          type: 'connect-orphan',
          note: orphan.label,
          path: orphan.path,
          reason: `发现 ${graphData.stats.orphanCount} 个孤立笔记，可以考虑创建连接`,
        })
      })
    }

    // 2. 基于标签的相似主题建议
    const currentTags = new Set(currentNode.tags)
    if (currentTags.size > 0) {
      const taggedNodes = graphData.nodes.filter(n => 
        n.tags.some(tag => currentTags.has(tag)) && n.path !== currentPath
      ).slice(0, 5)

      const linkedPaths = new Set(backlinks.map(b => b.path))
      taggedNodes.forEach(node => {
        if (!linkedPaths.has(node.path)) {
          suggestions.push({
            type: 'similar-topic',
            note: node.label,
            path: node.path,
            reason: `与当前笔记共享标签: ${[...currentTags].filter(t => node.tags.includes(t)).join(', ')}`,
          })
        }
      })
    }

    // 3. 缺失的链接建议（基于未链接提及）
    const linkedPaths = new Set(backlinks.map(b => b.path))
    graphData.nodes
      .filter(n => n.linkCount > 0 && !linkedPaths.has(n.path) && n.path !== currentPath)
      .slice(0, 3)
      .forEach(node => {
        suggestions.push({
          type: 'missing-link',
          note: node.label,
          path: node.path,
          reason: `这篇笔记有 ${node.linkCount} 个连接，但当前笔记没有引用它`,
        })
      })

    return suggestions.slice(0, 10) // 最多返回 10 条建议
  }
}

export const contextBuilder = new ContextBuilderImpl()
