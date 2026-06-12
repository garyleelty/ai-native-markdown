import { ref, onUnmounted, type Ref } from 'vue'
import * as d3 from 'd3'
import type { GraphNode, KnowledgeGraphData } from '@/types'

type SimulationNode = GraphNode & d3.SimulationNodeDatum
type SimulationEdge = d3.SimulationLinkDatum<SimulationNode>

export function useKnowledgeGraph(
  container: Ref<HTMLElement | null>,
  onNodeClick?: (node: GraphNode) => void
) {
  const simulation = ref<d3.Simulation<SimulationNode, SimulationEdge> | null>(null)
  const svg = ref<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null)
  const zoomBehavior = ref<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const hoveredNode = ref<SimulationNode | null>(null)
  const selectedNode = ref<SimulationNode | null>(null)
  const currentNodeId = ref<string | null>(null)

  const GRAPH_FORCE_DISTANCE = 110
  const GRAPH_FORCE_STRENGTH = -280
  const GRAPH_COLLISION_PADDING = 10
  const GRAPH_ALPHA_DECAY = 0.02
  const GRAPH_VELOCITY_DECAY = 0.4
  const GRAPH_FOCUS_DURATION = 600
  const GRAPH_FOCUS_SCALE = 1.6
  const GRAPH_PRELAYOUT_TICKS = 150

  let renderFrame: number | null = null
  let pulseFrame: number | null = null

  const TAG_COLORS = [
    '#818cf8', '#60a5fa', '#34d399', '#fb923c',
    '#f472b6', '#a78bfa', '#fbbf24', '#2dd4bf',
    '#f87171', '#94a3b8'
  ]

  const NODE_RADIUS_MIN = 4
  const NODE_RADIUS_MAX = 20

  function getNodeRadius(linkCount: number): number {
    if (linkCount <= 0) return NODE_RADIUS_MIN
    if (linkCount === 1) return 6
    if (linkCount <= 3) return 8
    if (linkCount <= 6) return 11
    if (linkCount <= 10) return 15
    return NODE_RADIUS_MAX
  }

  function getTagColor(tags: string[]): string {
    if (tags.length === 0) return '#94a3b8'
    const index = tags[0].charCodeAt(0) % TAG_COLORS.length
    return TAG_COLORS[index]
  }

  function getGlowOpacity(linkCount: number, isOrphan: boolean): number {
    if (isOrphan) return 0
    if (linkCount <= 1) return 0.18
    if (linkCount <= 3) return 0.28
    if (linkCount <= 6) return 0.40
    return 0.55
  }

  function getTextOffset(linkCount: number): number {
    return getNodeRadius(linkCount) + 10
  }

  function getFontSize(linkCount: number): string {
    if (linkCount >= 10) return '13px'
    if (linkCount >= 4) return '12px'
    return '11px'
  }

  function getTextMaxLen(linkCount: number): number {
    if (linkCount >= 10) return 18
    if (linkCount >= 4) return 14
    return 12
  }

  function getEdgeOpacity(a: number, b: number): number {
    const max = Math.max(a, b)
    const min = Math.min(a, b)
    if (max >= 8 && min >= 4) return 0.38
    if (max >= 8) return 0.30
    if (max >= 4) return 0.22
    return 0.14
  }

  let pulseTimeAccum = 0
  let pulseLastTime = 0
  let livePulseSel: d3.Selection<SVGCircleElement, SimulationNode, any, any> | null = null
  let liveGlowSel: d3.Selection<SVGCircleElement, SimulationNode, any, any> | null = null

  function startPulseAnimation(
    pulseSel: d3.Selection<SVGCircleElement, SimulationNode, any, any>,
    glowSel: d3.Selection<SVGCircleElement, SimulationNode, any, any>,
    _nodes: SimulationNode[]
  ) {
    if (pulseFrame !== null) cancelAnimationFrame(pulseFrame)
    pulseLastTime = performance.now()
    livePulseSel = pulseSel
    liveGlowSel = glowSel

    const animate = (now: number) => {
      const delta = now - pulseLastTime
      pulseLastTime = now
      pulseTimeAccum = (pulseTimeAccum + delta) % 8000
      const t = (pulseTimeAccum / 8000) * Math.PI * 2
      const scale = 1.0 + 0.25 * Math.sin(t)
      const glowPulse = 0.88 + 0.12 * Math.sin(t)

      livePulseSel?.each(function(d) {
        if (d.linkCount > 0 && !d.isOrphan) {
          const size = getNodeRadius(d.linkCount)
          d3.select(this).attr('r', size * 1.6 * scale)
        }
      })
      liveGlowSel?.each(function(d) {
        if (d.linkCount === 0 || d.isOrphan) return
        const size = getNodeRadius(d.linkCount)
        const base = getGlowOpacity(d.linkCount, d.isOrphan)
        d3.select(this)
          .attr('r', size * 1.5)
          .attr('fill-opacity', base * glowPulse)
      })

      pulseFrame = requestAnimationFrame(animate)
    }
    pulseFrame = requestAnimationFrame(animate)
  }

  function stopPulseAnimation() {
    if (pulseFrame !== null) {
      cancelAnimationFrame(pulseFrame)
      pulseFrame = null
    }
    livePulseSel = null
    liveGlowSel = null
  }

  function lighten(hex: string, amount: number): string {
    const h = hex.replace('#', '')
    const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
    const r = (num >> 16) & 255
    const g = (num >> 8) & 255
    const b = num & 255
    const lr = Math.min(255, Math.round(r + (255 - r) * amount))
    const lg = Math.min(255, Math.round(g + (255 - g) * amount))
    const lb = Math.min(255, Math.round(b + (255 - b) * amount))
    return '#' + lr.toString(16).padStart(2, '0') + lg.toString(16).padStart(2, '0') + lb.toString(16).padStart(2, '0')
  }

  function darken(hex: string, amount: number): string {
    const h = hex.replace('#', '')
    const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
    const r = (num >> 16) & 255
    const g = (num >> 8) & 255
    const b = num & 255
    return '#' + Math.round(r * amount).toString(16).padStart(2, '0') + Math.round(g * amount).toString(16).padStart(2, '0') + Math.round(b * amount).toString(16).padStart(2, '0')
  }

  function setCurrentNode(id: string | null) {
    currentNodeId.value = id
    if (!svg.value) return
    const nodeSel = svg.value.selectAll<SVGGElement, SimulationNode>('g.nodes > g')
    if (nodeSel.empty()) return
    nodeSel.each(function(d) {
      const g = d3.select(this)
      const isCurrent = currentNodeId.value !== null && d.id === currentNodeId.value
      const r = getNodeRadius(d.linkCount)

      g.select('.node-core')
        .transition().duration(250).ease(d3.easeCubicOut)
        .attr('stroke', isCurrent
          ? 'var(--accent-primary)'
          : (d.isOrphan ? 'var(--text-muted)' : 'rgba(255,255,255,0.3)'))
        .attr('stroke-width', isCurrent ? 2.8 : 1.2)

      g.select('.node-pulse')
        .attr('stroke', isCurrent ? 'var(--accent-primary)' : getTagColor(d.tags))
        .attr('stroke-width', isCurrent ? 1.8 : 1.5)
        .transition().duration(250)
        .attr('stroke-opacity', d.linkCount > 0 && !d.isOrphan
          ? (isCurrent ? 0.55 : 0.12)
          : 0)

      g.select('.node-glow')
        .transition().duration(250)
        .attr('r', r * (isCurrent ? 1.8 : 1.5))
        .attr('fill-opacity', isCurrent
          ? Math.max(0.45, getGlowOpacity(d.linkCount, d.isOrphan))
          : getGlowOpacity(d.linkCount, d.isOrphan))

      g.select('text')
        .transition().duration(250)
        .attr('font-weight', isCurrent ? '600' : '500')
        .attr('fill', isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)')
    })
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

    const linkCounts = new Map<string, number>()
    simEdges.forEach(e => {
      const s = typeof e.source === 'string' ? e.source : (e.source as SimulationNode).id
      const t = typeof e.target === 'string' ? e.target : (e.target as SimulationNode).id
      linkCounts.set(s, (linkCounts.get(s) || 0) + 1)
      linkCounts.set(t, (linkCounts.get(t) || 0) + 1)
    })

    const svgEl = d3.select(container.value)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', 'transparent')
    svg.value = svgEl

    const bgGroup = svgEl.append('g')
      .attr('class', 'graph-bg')
      .attr('pointer-events', 'none')
      .attr('opacity', 0)
    const gridSpacing = 48
    for (let i = 0; i <= Math.ceil(width / gridSpacing); i++) {
      for (let j = 0; j <= Math.ceil(height / gridSpacing); j++) {
        const x = i * gridSpacing + (j % 2 === 0 ? gridSpacing / 2 : 0)
        const y = j * gridSpacing
        if (x <= width && y <= height) {
          bgGroup.append('circle')
            .attr('cx', x)
            .attr('cy', y)
            .attr('r', 0.8)
            .attr('fill', 'var(--text-muted)')
            .attr('fill-opacity', 0.08)
        }
      }
    }
    bgGroup.transition().duration(1200).attr('opacity', 1)

    const g = svgEl.append('g')
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
      })
    svgEl.call(zoom)
    zoomBehavior.value = zoom

    const edgeGroup = g.append('g').attr('class', 'edges')
    const nodeGroup = g.append('g').attr('class', 'nodes')

    const defs = svgEl.append('defs')
    defs.append('filter')
      .attr('id', 'node-glow')
      .attr('x', '-120%').attr('y', '-120%')
      .attr('width', '340%').attr('height', '340%')
      .append('feGaussianBlur')
      .attr('stdDeviation', '10')
      .attr('result', 'coloredBlur')

    TAG_COLORS.forEach((color, i) => {
      const grad = defs.append('radialGradient')
        .attr('id', `node-grad-${i}`)
        .attr('cx', '35%').attr('cy', '30%')
        .attr('r', '75%').attr('fx', '35%').attr('fy', '30%')
      grad.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff').attr('stop-opacity', '0.75')
      grad.append('stop').attr('offset', '40%').attr('stop-color', lighten(color, 0.2))
      grad.append('stop').attr('offset', '100%').attr('stop-color', darken(color, 0.7))
    })
    const grayGrad = defs.append('radialGradient')
      .attr('id', `node-grad-${TAG_COLORS.length}`)
      .attr('cx', '35%').attr('cy', '30%').attr('r', '75%').attr('fx', '35%').attr('fy', '30%')
    grayGrad.append('stop').attr('offset', '0%').attr('stop-color', '#e2e8f0').attr('stop-opacity', '0.8')
    grayGrad.append('stop').attr('offset', '60%').attr('stop-color', '#94a3b8')
    grayGrad.append('stop').attr('offset', '100%').attr('stop-color', '#475569')

    const edgeSelection = edgeGroup
      .selectAll('line')
      .data(simEdges)
      .join('line')
      .attr('stroke', 'var(--accent-primary)')
      .attr('stroke-opacity', 0)
      .attr('stroke-width', d => 0.8 + Math.min(((d as any).weight ?? 1) * 0.3, 1.5))
      .attr('stroke-linecap', 'round')
    edgeSelection
      .transition().delay((_, i) => 400 + i * 5).duration(1000)
      .attr('stroke-opacity', d => {
        const s = typeof d.source === 'string' ? d.source : (d.source as SimulationNode).id
        const t = typeof d.target === 'string' ? d.target : (d.target as SimulationNode).id
        return getEdgeOpacity(linkCounts.get(s) ?? 0, linkCounts.get(t) ?? 0)
      })

    const nodeSelection = nodeGroup
      .selectAll<SVGGElement, SimulationNode>('g')
      .data(simNodes)
      .join('g')
      .attr('cursor', 'pointer')
      .attr('opacity', 0)
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
      .on('click', (event, d) => {
        if (selectedNode.value?.id === d.id) {
          selectedNode.value = null
        } else {
          selectedNode.value = d
        }
        if (onNodeClick) onNodeClick(d)
        event.stopPropagation()
      })

    nodeSelection
      .transition()
      .delay(d => d.linkCount >= 8 ? 200 : d.linkCount >= 3 ? 400 : 600)
      .duration(700)
      .ease(d3.easeCubicOut)
      .attr('opacity', 1)

    const glowSel = nodeSelection
      .append('circle')
      .attr('class', 'node-glow')
      .attr('r', d => getNodeRadius(d.linkCount) * 1.5)
      .attr('fill', d => getTagColor(d.tags))
      .attr('fill-opacity', 0)
      .attr('filter', 'url(#node-glow)')
      .attr('pointer-events', 'none')
    glowSel
      .transition().delay(d => 500).duration(1000)
      .attr('fill-opacity', d => getGlowOpacity(d.linkCount, d.isOrphan))

    const pulseSel = nodeSelection
      .append('circle')
      .attr('class', 'node-pulse')
      .attr('r', d => getNodeRadius(d.linkCount) * 1.6)
      .attr('fill', 'none')
      .attr('stroke', d => getTagColor(d.tags))
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', d => d.linkCount > 0 && !d.isOrphan ? 0.12 : 0)
      .attr('pointer-events', 'none')

    nodeSelection
      .append('circle')
      .attr('class', 'node-core')
      .attr('r', d => getNodeRadius(d.linkCount))
      .attr('fill', d => {
        const idx = d.tags.length === 0 ? TAG_COLORS.length : d.tags[0].charCodeAt(0) % TAG_COLORS.length
        return `url(#node-grad-${idx})`
      })
      .attr('stroke', d => d.isOrphan ? 'var(--text-muted)' : 'rgba(255,255,255,0.3)')
      .attr('stroke-width', 1.2)
      .style('vector-effect', 'non-scaling-stroke')

    nodeSelection
      .append('text')
      .text(d => {
        const name = d.path.split('/').pop()?.replace(/\.(md|markdown)$/i, '') || d.label
        const max = getTextMaxLen(d.linkCount)
        return name.length > max ? name.slice(0, max - 1) + '…' : name
      })
      .attr('dy', d => getTextOffset(d.linkCount))
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', d => getFontSize(d.linkCount))
      .attr('font-family', 'var(--font-sans)')
      .attr('font-weight', '500')
      .attr('pointer-events', 'none')

    if (currentNodeId.value !== null) {
      const cid = currentNodeId.value
      nodeSelection.each(function(d) {
        if (d.id === cid) {
          const g = d3.select(this)
          const r = getNodeRadius(d.linkCount)
          g.select('.node-core')
            .attr('stroke', 'var(--accent-primary)')
            .attr('stroke-width', 2.8)
          g.select('.node-pulse')
            .attr('stroke', 'var(--accent-primary)')
            .attr('stroke-width', 1.8)
            .attr('stroke-opacity', d.linkCount > 0 && !d.isOrphan ? 0.55 : 0)
          g.select('.node-glow')
            .attr('r', r * 1.8)
            .attr('fill-opacity', Math.max(0.45, getGlowOpacity(d.linkCount, d.isOrphan)))
          g.select('text')
            .attr('font-weight', '600')
            .attr('fill', 'var(--text-primary)')
        }
      })
    }

    const baseOpacity = new Map<string, number>()
    simEdges.forEach(e => {
      const s = typeof e.source === 'string' ? e.source : (e.source as SimulationNode).id
      const t = typeof e.target === 'string' ? e.target : (e.target as SimulationNode).id
      baseOpacity.set(`${s}__${t}`, getEdgeOpacity(linkCounts.get(s) ?? 0, linkCounts.get(t) ?? 0))
    })

    nodeSelection
      .on('mouseenter', (event, d) => {
        hoveredNode.value = d
        const g = d3.select(event.currentTarget)
        const r = getNodeRadius(d.linkCount)
        g.select('.node-glow')
          .transition().duration(180).ease(d3.easeCubicOut)
          .attr('r', r * 2.4)
          .attr('fill-opacity', 0.75)
        g.select('.node-core')
          .transition().duration(180).ease(d3.easeCubicOut)
          .attr('stroke', 'var(--accent-primary)')
          .attr('stroke-width', 2.5)
        g.select('.node-pulse')
          .transition().duration(180)
          .attr('stroke-opacity', d.linkCount > 0 && !d.isOrphan ? 0.55 : 0)
        g.select('text')
          .transition().duration(180)
          .attr('font-weight', '600')
          .attr('fill', 'var(--text-primary)')

        edgeSelection
          .attr('stroke-opacity', e => {
            const s = typeof e.source === 'string' ? e.source : (e.source as SimulationNode).id
            const t = typeof e.target === 'string' ? e.target : (e.target as SimulationNode).id
            return s === d.id || t === d.id ? 0.85 : 0.04
          })
          .attr('stroke', e => {
            const s = typeof e.source === 'string' ? e.source : (e.source as SimulationNode).id
            const t = typeof e.target === 'string' ? e.target : (e.target as SimulationNode).id
            return s === d.id || t === d.id ? 'var(--accent-primary)' : 'var(--border-default)'
          })
          .attr('stroke-width', e => {
            const s = typeof e.source === 'string' ? e.source : (e.source as SimulationNode).id
            const t = typeof e.target === 'string' ? e.target : (e.target as SimulationNode).id
            return s === d.id || t === d.id ? 2 : 0.8
          })
        nodeSelection
          .filter(n => n.id !== d.id)
          .transition().duration(180)
          .attr('opacity', 0.45)
      })
      .on('mouseleave', (event, d) => {
        hoveredNode.value = null
        const g = d3.select(event.currentTarget)
        const r = getNodeRadius(d.linkCount)
        const isCurrent = currentNodeId.value !== null && d.id === currentNodeId.value
        g.select('.node-glow')
          .transition().duration(300).ease(d3.easeCubicOut)
          .attr('r', r * (isCurrent ? 1.8 : 1.5))
          .attr('fill-opacity', isCurrent ? Math.max(0.45, getGlowOpacity(d.linkCount, d.isOrphan)) : getGlowOpacity(d.linkCount, d.isOrphan))
        g.select('.node-core')
          .transition().duration(300).ease(d3.easeCubicOut)
          .attr('stroke', isCurrent ? 'var(--accent-primary)' : (d.isOrphan ? 'var(--text-muted)' : 'rgba(255,255,255,0.3)'))
          .attr('stroke-width', isCurrent ? 2.8 : 1.2)
        g.select('.node-pulse')
          .attr('stroke', isCurrent ? 'var(--accent-primary)' : getTagColor(d.tags))
          .attr('stroke-width', isCurrent ? 1.8 : 1.5)
          .transition().duration(300)
          .attr('stroke-opacity', d.linkCount > 0 && !d.isOrphan ? (isCurrent ? 0.55 : 0.12) : 0)
        g.select('text')
          .transition().duration(300)
          .attr('font-weight', isCurrent ? '600' : '500')
          .attr('fill', isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)')
        edgeSelection
          .attr('stroke-opacity', e => {
            const s = typeof e.source === 'string' ? e.source : (e.source as SimulationNode).id
            const t = typeof e.target === 'string' ? e.target : (e.target as SimulationNode).id
            return baseOpacity.get(`${s}__${t}`) ?? 0.22
          })
          .attr('stroke', 'var(--accent-primary)')
          .attr('stroke-width', d => 0.8 + Math.min(((d as any).weight ?? 1) * 0.3, 1.5))
        nodeSelection
          .transition().duration(250)
          .attr('opacity', 1)
      })

    const renderPositions = () => {
      edgeSelection
        .attr('x1', e => (e.source as SimulationNode).x ?? 0)
        .attr('y1', e => (e.source as SimulationNode).y ?? 0)
        .attr('x2', e => (e.target as SimulationNode).x ?? 0)
        .attr('y2', e => (e.target as SimulationNode).y ?? 0)
      nodeSelection.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    }

    const scheduleRender = () => {
      if (renderFrame !== null) return
      renderFrame = requestAnimationFrame(() => {
        renderFrame = null
        renderPositions()
      })
    }

    const sim = d3.forceSimulation<SimulationNode>(simNodes)
      .force('link', d3.forceLink<SimulationNode, SimulationEdge>(simEdges)
        .id(d => d.id).distance(GRAPH_FORCE_DISTANCE))
      .force('charge', d3.forceManyBody().strength(GRAPH_FORCE_STRENGTH))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimulationNode>()
        .radius(d => getNodeRadius(d.linkCount) + GRAPH_COLLISION_PADDING))
      .alphaDecay(GRAPH_ALPHA_DECAY)
      .velocityDecay(GRAPH_VELOCITY_DECAY)
      .stop()

    sim.tick(GRAPH_PRELAYOUT_TICKS)
    renderPositions()
    sim.on('tick', scheduleRender)
    simulation.value = sim
    startPulseAnimation(pulseSel, glowSel, simNodes)
  }

  function highlightNode(nodeId: string) {
    if (!svg.value) return
    svg.value.selectAll<SVGGElement, SimulationNode>('g.nodes > g')
      .filter(d => d.id === nodeId)
      .select('.node-core')
      .transition().duration(300)
      .attr('stroke', 'var(--accent-primary)')
      .attr('stroke-width', 3)
  }

  function focusNode(nodeId: string) {
    if (!svg.value || !simulation.value || !zoomBehavior.value) return
    const nodes = simulation.value.nodes()
    const target = nodes.find(n => n.id === nodeId)
    if (!target || target.x == null || target.y == null) return

    const w = container.value?.clientWidth ?? 600
    const h = container.value?.clientHeight ?? 400
    svg.value.transition().duration(GRAPH_FOCUS_DURATION).call(
      zoomBehavior.value.transform,
      d3.zoomIdentity.translate(w / 2, h / 2).scale(GRAPH_FOCUS_SCALE).translate(-target.x, -target.y)
    )

    const nodeG = svg.value.selectAll<SVGGElement, SimulationNode>('g.nodes > g')
      .filter(d => d.id === nodeId)
    if (nodeG.empty()) return

    const r = getNodeRadius(target.linkCount)
    for (let i = 0; i < 3; i++) {
      nodeG.append('circle')
        .attr('class', 'focus-pulse-ring')
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', 'var(--accent-primary)')
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.7)
        .attr('pointer-events', 'none')
        .transition()
        .delay(i * 200)
        .duration(1100)
        .ease(d3.easeCubicOut)
        .attr('r', r * 5)
        .attr('stroke-opacity', 0)
        .on('end', function() { d3.select(this).remove() })
    }
  }

  function destroyGraph() {
    stopPulseAnimation()
    if (renderFrame !== null) {
      cancelAnimationFrame(renderFrame)
      renderFrame = null
    }
    if (simulation.value) {
      simulation.value.stop()
      simulation.value = null
    }
    if (svg.value) {
      svg.value.on('.zoom', null)
    }
    if (container.value) {
      d3.select(container.value).selectAll('svg').remove()
    }
    svg.value = null
    zoomBehavior.value = null
    hoveredNode.value = null
    selectedNode.value = null
  }

  onUnmounted(() => { destroyGraph() })

  return {
    simulation,
    hoveredNode,
    selectedNode,
    initGraph,
    highlightNode,
    focusNode,
    setCurrentNode,
    destroyGraph
  }
}
