export interface WikiLinkData {
  target: string
  display?: string
  from: number
  to: number
}

export interface TagData {
  name: string
  from: number
  to: number
}

export function extractWikiLinks(text: string): WikiLinkData[] {
  const links: WikiLinkData[] = []
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
  let match
  while ((match = regex.exec(text)) !== null) {
    links.push({
      target: match[1].trim(),
      display: match[2]?.trim(),
      from: match.index,
      to: match.index + match[0].length
    })
  }
  return links
}

export function extractTags(text: string): TagData[] {
  const tags: TagData[] = []
  const regex = /#([\w\u4e00-\u9fa5_-]+)/g
  let match
  while ((match = regex.exec(text)) !== null) {
    tags.push({
      name: match[1],
      from: match.index,
      to: match.index + match[0].length
    })
  }
  return tags
}

export function buildLinkGraph(files: { path: string; content: string }[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>()
  const fileMap = new Map<string, string>()

  for (const file of files) {
    const name = file.path.split('/').pop()?.replace(/\.md$/, '') || ''
    fileMap.set(name, file.path)
    if (!graph.has(file.path)) graph.set(file.path, new Set())
  }

  for (const file of files) {
    const links = extractWikiLinks(file.content)
    for (const link of links) {
      const targetPath = fileMap.get(link.target)
      if (targetPath) {
        graph.get(file.path)?.add(targetPath)
      }
    }
  }

  return graph
}

export function getAllTags(files: { path: string; content: string }[]): Map<string, string[]> {
  const tagMap = new Map<string, string[]>()
  for (const file of files) {
    const tags = extractTags(file.content)
    for (const tag of tags) {
      if (!tagMap.has(tag.name)) tagMap.set(tag.name, [])
      tagMap.get(tag.name)?.push(file.path)
    }
  }
  return tagMap
}

import type { GraphNode, GraphEdge, KnowledgeGraphData } from '@/types'

export function buildKnowledgeGraph(
  files: { path: string; content: string }[]
): KnowledgeGraphData {
  const graph = buildLinkGraph(files)
  const tagMap = getAllTags(files)

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  for (const file of files) {
    const name = file.path.split('/').pop()?.replace(/\.md$/, '') || ''
    const outgoingCount = graph.get(file.path)?.size || 0
    let incomingCount = 0
    for (const targets of graph.values()) {
      if (targets.has(file.path)) incomingCount++
    }
    const linkCount = outgoingCount + incomingCount

    nodes.push({
      id: file.path,
      label: name,
      path: file.path,
      linkCount,
      tags: [...new Set(
        extractTags(file.content).map(t => t.name)
      )],
      isOrphan: linkCount === 0
    })
  }

  for (const [source, targets] of graph) {
    for (const target of targets) {
      edges.push({ source, target, weight: 1 })
    }
  }

  return {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      orphanCount: nodes.filter(n => n.isOrphan).length,
      avgLinkCount: nodes.length > 0
        ? Math.round((nodes.reduce((s, n) => s + n.linkCount, 0) / nodes.length) * 10) / 10
        : 0
    }
  }
}
