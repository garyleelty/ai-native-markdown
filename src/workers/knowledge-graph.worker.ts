/**
 * 知识图谱布局计算 Web Worker
 * 将耗时的 D3 力导向图布局计算移到后台线程
 */

import * as d3 from 'd3'

interface WorkerNode {
  id: string
  label: string
  linkCount: number
  tags: string[]
  isOrphan: boolean
  x?: number | null
  y?: number | null
}

interface WorkerEdge {
  source: string
  target: string
  weight: number
}

interface GraphData {
  nodes: WorkerNode[]
  edges: WorkerEdge[]
}

interface SimulationNode extends WorkerNode, d3.SimulationNodeDatum {}
type SimulationEdge = d3.SimulationLinkDatum<SimulationNode>

self.onmessage = (event: MessageEvent<{ type: string; data?: GraphData; width?: number; height?: number }>) => {
  const { type, data, width, height } = event.data
  
  try {
    if (type === 'init' && data && width && height) {
      // 创建力导向模拟
      const simNodes: SimulationNode[] = data.nodes.map(n => ({ ...n }))
      const simEdges: SimulationEdge[] = data.edges.map(e => ({
        source: e.source as string,
        target: e.target as string,
        weight: e.weight
      }))
      
      const simulation = d3.forceSimulation<SimulationNode>(simNodes)
        .force('link', d3.forceLink<SimulationNode, SimulationEdge>(simEdges)
          .id(d => d.id)
          .distance(80)
        )
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide<SimulationNode>().radius(d => {
          const getNodeRadius = (linkCount: number) => Math.sqrt(linkCount + 1) * 5 + 8
          return getNodeRadius((d as SimulationNode).linkCount || 0) + 4
        }))
      
      // 监听 tick 事件，定期发送位置更新
      let tickCount = 0
      simulation.on('tick', () => {
        tickCount++
        // 每 5 帧发送一次更新，减少消息频率
        if (tickCount % 5 === 0) {
          self.postMessage({
            type: 'tick',
            nodes: simNodes.map(n => ({ id: n.id, x: n.x, y: n.y }))
          })
        }
        
        // 当模拟稳定时停止
        if (simulation.alpha() < 0.01) {
          simulation.stop()
          self.postMessage({
            type: 'complete',
            nodes: simNodes.map(n => ({ id: n.id, x: n.x, y: n.y }))
          })
        }
      })
      
      simulation.on('end', () => {
        self.postMessage({
          type: 'complete',
          nodes: simNodes.map(n => ({ id: n.id, x: n.x, y: n.y }))
        })
      })
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export {}
