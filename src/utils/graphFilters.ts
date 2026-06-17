import type { GraphEdge, GraphNode, KnowledgeGraphData } from '@/types'

export interface GraphFilterOptions {
  searchText?: string
  tags?: string[]
  pathPrefix?: string
  maxDepth?: number
  currentFile?: string
}

const getEdgeSourceId = (edge: GraphEdge): string => typeof edge.source === 'string' ? edge.source : edge.source.id
const getEdgeTargetId = (edge: GraphEdge): string => typeof edge.target === 'string' ? edge.target : edge.target.id

function buildStats(nodes: GraphNode[], edges: GraphEdge[]) {
  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    orphanCount: nodes.filter(node => node.isOrphan).length,
    avgLinkCount: nodes.length
      ? Math.round((nodes.reduce((sum, node) => sum + node.linkCount, 0) / nodes.length) * 10) / 10
      : 0,
  }
}

function rebuildGraph(nodes: GraphNode[], edges: GraphEdge[]): KnowledgeGraphData {
  const nextNodes = nodes.map(node => ({ ...node, linkCount: 0, isOrphan: true }))
  const nodeMap = new Map(nextNodes.map(node => [node.id, node]))
  const nextEdges = edges
    .filter(edge => nodeMap.has(getEdgeSourceId(edge)) && nodeMap.has(getEdgeTargetId(edge)))
    .map(edge => ({ source: getEdgeSourceId(edge), target: getEdgeTargetId(edge), weight: edge.weight }))

  for (const edge of nextEdges) {
    const source = nodeMap.get(getEdgeSourceId(edge))
    const target = nodeMap.get(getEdgeTargetId(edge))
    if (source) source.linkCount += 1
    if (target) target.linkCount += 1
  }
  nextNodes.forEach(node => { node.isOrphan = node.linkCount === 0 })
  return { nodes: nextNodes, edges: nextEdges, stats: buildStats(nextNodes, nextEdges) }
}

function nodeMatchesSearch(node: GraphNode, searchText: string): boolean {
  const q = searchText.trim().toLowerCase()
  if (!q) return true
  const haystack = [node.label, node.id, node.path, ...node.tags.map(tag => `#${tag}`)].join(' ').toLowerCase()
  return haystack.includes(q)
}

function idsWithinDepth(data: KnowledgeGraphData, currentFile: string, maxDepth: number): Set<string> {
  const adjacency = new Map<string, Set<string>>()
  for (const edge of data.edges) {
    const source = getEdgeSourceId(edge)
    const target = getEdgeTargetId(edge)
    if (!adjacency.has(source)) adjacency.set(source, new Set())
    if (!adjacency.has(target)) adjacency.set(target, new Set())
    adjacency.get(source)?.add(target)
    adjacency.get(target)?.add(source)
  }

  const seen = new Set<string>([currentFile])
  const queue: Array<{ id: string; depth: number }> = [{ id: currentFile, depth: 0 }]
  while (queue.length > 0) {
    const item = queue.shift()!
    if (item.depth >= maxDepth) continue
    for (const neighbor of adjacency.get(item.id) ?? []) {
      if (seen.has(neighbor)) continue
      seen.add(neighbor)
      queue.push({ id: neighbor, depth: item.depth + 1 })
    }
  }
  return seen
}

export function filterGraphData(data: KnowledgeGraphData, options: GraphFilterOptions): KnowledgeGraphData {
  const selectedTags = new Set(options.tags?.filter(Boolean) ?? [])
  const pathPrefix = options.pathPrefix?.trim()
  const searchText = options.searchText?.trim() ?? ''
  let includedIds = new Set(data.nodes.map(node => node.id))

  if (selectedTags.size > 0 || pathPrefix) {
    const normalizedPrefix = pathPrefix ? (pathPrefix.endsWith('/') ? pathPrefix : `${pathPrefix}/`) : undefined
    includedIds = new Set(data.nodes
      .filter(node => selectedTags.size === 0 || node.tags.some(tag => selectedTags.has(tag)))
      .filter(node => !normalizedPrefix || node.path.startsWith(normalizedPrefix) || node.path === pathPrefix)
      .map(node => node.id))
  }

  if (options.currentFile && options.maxDepth && options.maxDepth > 0) {
    const depthIds = idsWithinDepth(data, options.currentFile, options.maxDepth)
    includedIds = new Set([...includedIds].filter(id => depthIds.has(id)))
  }

  if (searchText) {
    const matchedIds = new Set(data.nodes.filter(node => includedIds.has(node.id) && nodeMatchesSearch(node, searchText)).map(node => node.id))
    const neighborIds = new Set<string>()
    data.edges.forEach(edge => {
      const source = getEdgeSourceId(edge)
      const target = getEdgeTargetId(edge)
      if (matchedIds.has(source) && includedIds.has(target)) neighborIds.add(target)
      if (matchedIds.has(target) && includedIds.has(source)) neighborIds.add(source)
    })
    includedIds = new Set([...matchedIds, ...neighborIds])
  }

  const nodes = data.nodes.filter(node => includedIds.has(node.id))
  const edges = data.edges.filter(edge => includedIds.has(getEdgeSourceId(edge)) && includedIds.has(getEdgeTargetId(edge)))
  return rebuildGraph(nodes, edges)
}

export function getAvailableGraphTags(data: KnowledgeGraphData): string[] {
  return [...new Set(data.nodes.flatMap(node => node.tags))].sort((a, b) => a.localeCompare(b))
}

export function getAvailableGraphDirectories(data: KnowledgeGraphData): string[] {
  const dirs = data.nodes
    .map(node => node.path.includes('/') ? node.path.slice(0, node.path.lastIndexOf('/')) : '')
    .filter(Boolean)
  return [...new Set(dirs)].sort((a, b) => a.localeCompare(b))
}
