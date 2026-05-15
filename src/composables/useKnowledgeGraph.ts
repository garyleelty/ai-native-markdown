import { ref, onUnmounted, type Ref } from 'vue'
import * as d3 from 'd3'
import type { GraphNode, GraphEdge, KnowledgeGraphData } from '@/types'

type SimulationNode = GraphNode & d3.SimulationNodeDatum
type SimulationEdge = d3.SimulationLinkDatum<SimulationNode>

export function useKnowledgeGraph(container: Ref<HTMLElement | null>) {
  const simulation = ref<d3.Simulation<SimulationNode, SimulationEdge> | null>(null)
  const svg = ref<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null)
  const hoveredNode = ref<SimulationNode | null>(null)
  const selectedNode = ref<SimulationNode | null>(null)

  const TAG_COLORS = [
    '#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7',
    '#94e2d5', '#fab387', '#74c7ec', '#f5c2e7', '#eba0ac'
  ]

  function getNodeRadius(linkCount: number): number {
    return Math.sqrt(linkCount + 1) * 5 + 8
  }

  function getTagColor(tags: string[]): string {
    if (tags.length === 0) return '#6c7086'
    const index = tags[0].charCodeAt(0) % TAG_COLORS.length
    return TAG_COLORS[index]
  }

  function initGraph(data: KnowledgeGraphData) {
    if (!container.value) return
    destroyGraph()

    const width = container.value.clientWidth
    const height = container.value.clientHeight

    const simNodes: SimulationNode[] = data.nodes.map(n => ({ ...n }))
    const simEdges: SimulationEdge[] = data.edges.map(e => ({
      source: e.source as string,
      target: e.target as string,
      weight: e.weight
    }))

    const svgEl = d3.select(container.value)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', 'transparent')

    svg.value = svgEl

    const g = svgEl.append('g')

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
      })

    svgEl.call(zoomBehavior)

    const edgeGroup = g.append('g').attr('class', 'edges')
    const nodeGroup = g.append('g').attr('class', 'nodes')

    const edgeSelection = edgeGroup
      .selectAll('line')
      .data(simEdges)
      .join('line')
      .attr('stroke', 'var(--text-muted)')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5)

    const nodeSelection = nodeGroup
      .selectAll<SVGGElement, SimulationNode>('g')
      .data(simNodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, SimulationNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.value?.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.value?.alphaTarget(0)
          d.fx = null
          d.fy = null
        })
      )

    nodeSelection
      .append('circle')
      .attr('r', d => getNodeRadius(d.linkCount))
      .attr('fill', d => getTagColor(d.tags))
      .attr('stroke', d => d.isOrphan ? '#f38ba8' : 'var(--bg-elevated)')
      .attr('stroke-width', d => d.isOrphan ? 2.5 : 1.5)
      .attr('stroke-dasharray', d => d.isOrphan ? '4,3' : 'none')

    nodeSelection
      .append('text')
      .text(d => d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label)
      .attr('dy', d => getNodeRadius(d.linkCount) + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-sans)')
      .attr('pointer-events', 'none')

    nodeSelection
      .on('mouseenter', (event, d) => {
        hoveredNode.value = d
        d3.select(event.currentTarget).select('circle')
          .transition().duration(150)
          .attr('stroke', 'var(--accent-primary)')
          .attr('stroke-width', 3)
        edgeSelection
          .attr('stroke-opacity', e => {
            const src = typeof e.source === 'string' ? e.source : (e.source as SimulationNode).id
            const tgt = typeof e.target === 'string' ? e.target : (e.target as SimulationNode).id
            return src === d.id || tgt === d.id ? 0.8 : 0.1
          })
          .attr('stroke', e => {
            const src = typeof e.source === 'string' ? e.source : (e.source as SimulationNode).id
            const tgt = typeof e.target === 'string' ? e.target : (e.target as SimulationNode).id
            return src === d.id || tgt === d.id ? 'var(--accent-primary)' : 'var(--text-muted)'
          })
      })
      .on('mouseleave', (event, d) => {
        hoveredNode.value = null
        d3.select(event.currentTarget).select('circle')
          .transition().duration(150)
          .attr('stroke', d.isOrphan ? '#f38ba8' : 'var(--bg-elevated)')
          .attr('stroke-width', d.isOrphan ? 2.5 : 1.5)
        edgeSelection
          .attr('stroke-opacity', 0.4)
          .attr('stroke', 'var(--text-muted)')
      })

    const sim = d3.forceSimulation<SimulationNode>(simNodes)
      .force('link', d3.forceLink<SimulationNode, SimulationEdge>(simEdges)
        .id(d => d.id)
        .distance(80)
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimulationNode>().radius(d => getNodeRadius(d.linkCount) + 4))
      .on('tick', () => {
        edgeSelection
          .attr('x1', d => (d.source as SimulationNode).x ?? 0)
          .attr('y1', d => (d.source as SimulationNode).y ?? 0)
          .attr('x2', d => (d.target as SimulationNode).x ?? 0)
          .attr('y2', d => (d.target as SimulationNode).y ?? 0)

        nodeSelection.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
      })

    simulation.value = sim
  }

  function highlightNode(nodeId: string) {
    if (!svg.value) return
    svg.value.selectAll<SVGGElement, SimulationNode>('g')
      .filter((d: SimulationNode) => d.id === nodeId)
      .select('circle')
      .transition().duration(200)
      .attr('stroke', 'var(--accent-primary)')
      .attr('stroke-width', 4)
  }

  function focusNode(nodeId: string) {
    if (!svg.value || !simulation.value) return
    const nodes = simulation.value.nodes()
    const target = nodes.find(n => n.id === nodeId)
    if (!target || target.x == null || target.y == null) return

    const width = container.value?.clientWidth ?? 600
    const height = container.value?.clientHeight ?? 400

    svg.value.transition().duration(500).call(
      d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 5]).on('zoom', (event) => {
        svg.value?.select('g').attr('transform', event.transform.toString())
      }).transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(1.5).translate(-target.x, -target.y)
    )
  }

  function destroyGraph() {
    if (simulation.value) {
      simulation.value.stop()
      simulation.value = null
    }
    if (container.value) {
      d3.select(container.value).selectAll('svg').remove()
    }
    svg.value = null
    hoveredNode.value = null
    selectedNode.value = null
  }

  onUnmounted(() => {
    destroyGraph()
  })

  return {
    simulation,
    hoveredNode,
    selectedNode,
    initGraph,
    highlightNode,
    focusNode,
    destroyGraph
  }
}
