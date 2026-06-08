import type MarkdownIt from 'markdown-it'

export function embedPlugin(md: MarkdownIt): void {
  md.inline.ruler.before('emphasis', 'embed', (state: any, silent: boolean): boolean => {
    const start = state.pos

    // Check for ![[ prefix (0x21='!', 0x5B='[', 0x5B='[')
    if (
      state.src.charCodeAt(start) !== 0x21 ||
      state.src.charCodeAt(start + 1) !== 0x5B ||
      state.src.charCodeAt(start + 2) !== 0x5B
    ) {
      return false
    }

    // Find matching ]]
    const contentStart = start + 3
    let depth = 1
    let pos = contentStart
    while (pos < state.src.length) {
      if (state.src.charCodeAt(pos) === 0x5B && state.src.charCodeAt(pos + 1) === 0x5B) {
        depth++
        pos += 2
      } else if (state.src.charCodeAt(pos) === 0x5D && state.src.charCodeAt(pos + 1) === 0x5D) {
        depth--
        if (depth === 0) break
        pos += 2
      } else {
        pos++
      }
    }

    if (depth !== 0) return false

    const raw = state.src.slice(contentStart, pos)
    if (!raw.trim() || raw.includes('\n')) return false

    // Split on # to separate target and optional heading
    const hashIndex = raw.indexOf('#')
    const target = (hashIndex === -1 ? raw : raw.slice(0, hashIndex)).trim()
    const heading = hashIndex === -1 ? '' : raw.slice(hashIndex + 1).trim()

    if (!target && !heading) return false

    if (!silent) {
      const token = state.push('embed', '', 0)
      token.attrSet('class', 'embed')
      token.attrSet('data-target', target)
      if (heading) {
        token.attrSet('data-heading', heading)
      }
    }

    state.pos = pos + 2
    return true
  })

  md.renderer.rules.embed = (tokens, idx) => {
    const token = tokens[idx]
    const target = token.attrGet('data-target') ?? ''
    const heading = token.attrGet('data-heading')

    const escapedTarget = md.utils.escapeHtml(target)
    const headingAttr = heading ? ` data-heading="${md.utils.escapeHtml(heading)}"` : ''

    return `<div class="embed" data-target="${escapedTarget}"${headingAttr}></div>`
  }
}
