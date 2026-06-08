import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { EditorView, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { extractMarkdownBlocks, extractMarkdownHeadings, resolveWikiLinkTarget } from '@/utils/wikiLinks'

export interface WikiLinkCompletionContext {
  from: number
  to: number
  query: string
  mode: 'note' | 'current-heading' | 'cross-heading'
  isEmbed?: boolean
  fileTarget?: string
  headingQuery?: string
  targetPath?: string | null
}

export interface WikiLinkSuggestion {
  id: string
  kind: 'note' | 'heading' | 'block'
  title: string
  insertText: string
  meta: string
  sortKey: string
}

export interface MarkdownHeadingSuggestion {
  title: string
  level: number
  slug: string
  lineNumber: number
}

export interface MarkdownBlockSuggestion {
  id: string
  text: string
  lineNumber: number
}

export function useWikiLinkCompletion(options: {
  editorView: () => EditorView | undefined
  markdownPaths: () => string[]
  currentFile: () => string
  readMarkdownFile?: (path: string) => Promise<string>
}) {
  const completionContext = ref<WikiLinkCompletionContext | null>(null)
  const selectedCompletionIndex = ref(0)
  const crossDocumentHeadingState = ref<{
    requestKey: string
    path: string
    headings: MarkdownHeadingSuggestion[]
    blocks: MarkdownBlockSuggestion[]
    loading: boolean
    error: boolean
  } | null>(null)
  let crossDocumentHeadingRequestId = 0

  const stripMarkdownExtension = (path: string): string => path.replace(/\.(md|markdown)$/i, '')

  const getWikiLinkTitle = (path: string): string => {
    const fileName = path.split('/').pop() || path
    return stripMarkdownExtension(fileName)
  }

  const getWorkspaceRelativePath = (path: string): string => path.replace(/^\/workspace\/?/, '')

  const getMarkdownHeadings = (content: string): MarkdownHeadingSuggestion[] => {
    return extractMarkdownHeadings(content).map(heading => ({
      title: heading.text,
      level: heading.level,
      slug: heading.slug,
      lineNumber: heading.lineNumber,
    }))
  }

  const getCurrentMarkdownHeadings = (): MarkdownHeadingSuggestion[] => {
    const view = options.editorView()
    if (!view) return []
    return getMarkdownHeadings(view.state.doc.toString())
  }

  const getMarkdownBlocks = (content: string): MarkdownBlockSuggestion[] => {
    return extractMarkdownBlocks(content).map(block => ({
      id: block.id,
      text: block.text,
      lineNumber: block.lineNumber,
    }))
  }

  const getCurrentMarkdownBlocks = (): MarkdownBlockSuggestion[] => {
    const view = options.editorView()
    if (!view) return []
    return getMarkdownBlocks(view.state.doc.toString())
  }

  const getBlockSuggestions = (rawQuery: string): WikiLinkSuggestion[] => {
    const query = rawQuery.replace(/^#?\^/, '').trim().toLowerCase()
    return getCurrentMarkdownBlocks()
      .filter(block => {
        if (!query) return true
        return block.id.toLowerCase().includes(query) || block.text.toLowerCase().includes(query)
      })
      .map(block => ({
        id: `block:${block.lineNumber}:${block.id}`,
        kind: 'block' as const,
        title: `^${block.id}`,
        insertText: `#^${block.id}`,
        meta: `当前文档 · ${block.text.replace(/\s+/g, ' ').slice(0, 48)}`,
        sortKey: `${String(block.lineNumber).padStart(5, '0')}:${block.id}`,
      }))
      .slice(0, 6)
  }

  const getHeadingSuggestions = (rawQuery: string): WikiLinkSuggestion[] => {
    const query = rawQuery.replace(/^#/, '').trim().toLowerCase()
    return getCurrentMarkdownHeadings()
      .filter(heading => {
        if (!query) return true
        return heading.title.toLowerCase().includes(query) || heading.slug.includes(query)
      })
      .map(heading => ({
        id: `heading:${heading.lineNumber}:${heading.title}`,
        kind: 'heading' as const,
        title: heading.title,
        insertText: `#${heading.title}`,
        meta: `当前文档 · H${heading.level}`,
        sortKey: `${String(heading.lineNumber).padStart(5, '0')}:${heading.title}`,
      }))
      .slice(0, 6)
  }

  const getCrossDocumentHeadingSuggestions = (context: WikiLinkCompletionContext): WikiLinkSuggestion[] => {
    if (context.mode !== 'cross-heading' || !context.targetPath || !context.fileTarget) return []
    const state = crossDocumentHeadingState.value
    if (!state || state.path !== context.targetPath || state.loading || state.error) return []

    const query = (context.headingQuery || '').trim().toLowerCase()
    const fileTarget = context.fileTarget.trim()
    const noteTitle = getWikiLinkTitle(context.targetPath)

    return state.headings
      .filter(heading => {
        if (!query) return true
        return heading.title.toLowerCase().includes(query) || heading.slug.includes(query)
      })
      .map(heading => ({
        id: `cross-heading:${context.targetPath}:${heading.lineNumber}:${heading.title}`,
        kind: 'heading' as const,
        title: heading.title,
        insertText: `${fileTarget}#${heading.title}`,
        meta: `${noteTitle} · H${heading.level}`,
        sortKey: `${String(heading.lineNumber).padStart(5, '0')}:${heading.title}`,
      }))
      .slice(0, 6)
  }

  const getCrossDocumentBlockSuggestions = (context: WikiLinkCompletionContext): WikiLinkSuggestion[] => {
    if (context.mode !== 'cross-heading' || !context.targetPath || !context.fileTarget) return []
    const state = crossDocumentHeadingState.value
    if (!state || state.path !== context.targetPath || state.loading || state.error) return []

    const query = (context.headingQuery || '').replace(/^\^/, '').trim().toLowerCase()
    const fileTarget = context.fileTarget.trim()
    const noteTitle = getWikiLinkTitle(context.targetPath)

    return state.blocks
      .filter(block => {
        if (!query) return true
        return block.id.toLowerCase().includes(query) || block.text.toLowerCase().includes(query)
      })
      .map(block => ({
        id: `cross-block:${context.targetPath}:${block.lineNumber}:${block.id}`,
        kind: 'block' as const,
        title: `^${block.id}`,
        insertText: `${fileTarget}#^${block.id}`,
        meta: `${noteTitle} · ${block.text.replace(/\s+/g, ' ').slice(0, 48)}`,
        sortKey: `${String(block.lineNumber).padStart(5, '0')}:${block.id}`,
      }))
      .slice(0, 6)
  }

  const getNoteSuggestions = (rawQuery: string): WikiLinkSuggestion[] => {
    const query = rawQuery.trim().toLowerCase()
    return options.markdownPaths()
      .filter(path => /\.(md|markdown)$/i.test(path))
      .map(path => {
        const title = getWikiLinkTitle(path)
        const relativePath = getWorkspaceRelativePath(path)
        return {
          id: `note:${path}`,
          kind: 'note' as const,
          title,
          insertText: title,
          meta: relativePath,
          sortKey: relativePath,
        }
      })
      .filter(suggestion => {
        if (!query) return true
        return suggestion.title.toLowerCase().includes(query) ||
          suggestion.meta.toLowerCase().includes(query)
      })
      .sort((a, b) => {
        const aTitle = a.title.toLowerCase()
        const bTitle = b.title.toLowerCase()
        const aStarts = query && aTitle.startsWith(query)
        const bStarts = query && bTitle.startsWith(query)
        if (aStarts !== bStarts) return aStarts ? -1 : 1
        return a.sortKey.localeCompare(b.sortKey)
      })
      .slice(0, 6)
  }

  const isHeadingCompletion = computed(() => completionContext.value?.mode === 'current-heading' || completionContext.value?.mode === 'cross-heading')

  const completionEmptyText = computed(() => {
    const context = completionContext.value
    if (context?.mode === 'cross-heading' && !context.targetPath) return '没有找到目标笔记，继续输入可创建链接'
    if (context?.headingQuery?.trim().startsWith('^')) return '没有匹配块 ID'
    if (isHeadingCompletion.value) return '没有匹配标题，继续输入可创建标题链接'
    return '没有匹配笔记，继续输入可创建新链接'
  })

  const wikiLinkSuggestions = computed<WikiLinkSuggestion[]>(() => {
    const context = completionContext.value
    if (!context) return []

    if (context.mode === 'current-heading') {
      return context.headingQuery?.trim().startsWith('^')
        ? getBlockSuggestions(context.query)
        : getHeadingSuggestions(context.query)
    }
    if (context.mode === 'cross-heading') {
      return context.headingQuery?.trim().startsWith('^')
        ? getCrossDocumentBlockSuggestions(context)
        : getCrossDocumentHeadingSuggestions(context)
    }
    return getNoteSuggestions(context.query)
  })

  watch(wikiLinkSuggestions, (suggestions) => {
    if (selectedCompletionIndex.value >= suggestions.length) {
      selectedCompletionIndex.value = Math.max(0, suggestions.length - 1)
    }
  })

  watch(completionContext, async (context) => {
    if (context?.mode !== 'cross-heading' || !context.targetPath || !options.readMarkdownFile) {
      crossDocumentHeadingRequestId++
      crossDocumentHeadingState.value = null
      return
    }

    if (
      crossDocumentHeadingState.value?.path === context.targetPath &&
      !crossDocumentHeadingState.value.error
    ) {
      return
    }

    const requestId = ++crossDocumentHeadingRequestId
    const requestKey = `${context.targetPath}:${context.fileTarget || ''}`
      crossDocumentHeadingState.value = {
        requestKey,
        path: context.targetPath,
        headings: [],
        blocks: [],
        loading: true,
        error: false,
      }

    try {
      const content = await options.readMarkdownFile(context.targetPath)
      if (requestId !== crossDocumentHeadingRequestId) return
      crossDocumentHeadingState.value = {
        requestKey,
        path: context.targetPath,
        headings: getMarkdownHeadings(content),
        blocks: getMarkdownBlocks(content),
        loading: false,
        error: false,
      }
    } catch {
      if (requestId !== crossDocumentHeadingRequestId) return
      crossDocumentHeadingState.value = {
        requestKey,
        path: context.targetPath,
        headings: [],
        blocks: [],
        loading: false,
        error: true,
      }
    }
  })

  const detectWikiLinkCompletion = (view: EditorView): WikiLinkCompletionContext | null => {
    const selection = view.state.selection.main
    if (!selection.empty) return null

    const position = selection.head
    const line = view.state.doc.lineAt(position)
    const textBeforeCursor = line.text.slice(0, position - line.from)
    const openIndex = textBeforeCursor.lastIndexOf('[[')
    if (openIndex === -1) return null
    const isEmbed = openIndex > 0 && textBeforeCursor.charCodeAt(openIndex - 1) === 0x21

    const closeIndex = textBeforeCursor.lastIndexOf(']]')
    if (closeIndex > openIndex) return null

    const query = textBeforeCursor.slice(openIndex + 2)
    if (query.includes(']') || query.includes('|')) return null

    if (query.trim().startsWith('#')) {
      return {
        from: line.from + openIndex - (isEmbed ? 1 : 0),
        to: position,
        query,
        mode: 'current-heading',
        headingQuery: query.replace(/^#/, ''),
        isEmbed,
      }
    }

    const hashIndex = query.indexOf('#')
    if (hashIndex > 0) {
      const fileTarget = query.slice(0, hashIndex).trim()
      const headingQuery = query.slice(hashIndex + 1)
      const targetPath = fileTarget
        ? resolveWikiLinkTarget(fileTarget, options.currentFile() || '', options.markdownPaths())
        : null

      return {
        from: line.from + openIndex - (isEmbed ? 1 : 0),
        to: position,
        query,
        mode: 'cross-heading',
        fileTarget,
        headingQuery,
        targetPath,
        isEmbed,
      }
    }

    return {
      from: line.from + openIndex - (isEmbed ? 1 : 0),
      to: position,
      query,
      mode: 'note',
      isEmbed,
    }
  }

  const refreshWikiLinkCompletion = (view: EditorView) => {
    const nextContext = detectWikiLinkCompletion(view)
    if (!nextContext) {
      completionContext.value = null
      selectedCompletionIndex.value = 0
      return
    }

    const previousQuery = completionContext.value?.query
    completionContext.value = nextContext
    if (previousQuery !== nextContext.query) {
      selectedCompletionIndex.value = 0
    }
  }

  const closeWikiLinkCompletion = () => {
    completionContext.value = null
    selectedCompletionIndex.value = 0
  }

  const moveWikiLinkCompletionSelection = (delta: number): boolean => {
    const suggestions = wikiLinkSuggestions.value
    if (!completionContext.value || suggestions.length === 0) return false
    selectedCompletionIndex.value = (selectedCompletionIndex.value + delta + suggestions.length) % suggestions.length
    return true
  }

  const applyWikiLinkSuggestion = (suggestion: WikiLinkSuggestion) => {
    const view = options.editorView()
    const context = completionContext.value
    if (!view || !context) return

    const insert = context.isEmbed ? `![[${suggestion.insertText}]]` : `[[${suggestion.insertText}]]`
    view.dispatch({
      changes: { from: context.from, to: context.to, insert },
      selection: { anchor: context.from + insert.length },
      scrollIntoView: true
    })
    closeWikiLinkCompletion()
    view.focus()
  }

  const acceptSelectedWikiLinkCompletion = (): boolean => {
    if (!completionContext.value) return false
    const suggestions = wikiLinkSuggestions.value
    const suggestion = suggestions[selectedCompletionIndex.value] || suggestions[0]
    if (!suggestion) return false
    applyWikiLinkSuggestion(suggestion)
    return true
  }

  const wikiLinkCompletionKeymap = Prec.highest(keymap.of([
    {
      key: 'ArrowDown',
      run: () => moveWikiLinkCompletionSelection(1),
    },
    {
      key: 'ArrowUp',
      run: () => moveWikiLinkCompletionSelection(-1),
    },
    {
      key: 'Enter',
      run: () => acceptSelectedWikiLinkCompletion(),
    },
    {
      key: 'Tab',
      run: () => acceptSelectedWikiLinkCompletion(),
    },
    {
      key: 'Escape',
      run: () => {
        if (!completionContext.value) return false
        closeWikiLinkCompletion()
        return true
      },
    },
  ]))

  const handleWikiLinkCompletionKeydown = (event: KeyboardEvent, view: EditorView): boolean => {
    if (!completionContext.value) return false

    if (event.key === 'Escape') {
      event.preventDefault()
      closeWikiLinkCompletion()
      return true
    }

    const suggestions = wikiLinkSuggestions.value
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault()
      return moveWikiLinkCompletionSelection(1)
    }
    if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault()
      return moveWikiLinkCompletionSelection(-1)
    }
    if ((event.key === 'Enter' || event.key === 'Tab') && suggestions.length > 0) {
      event.preventDefault()
      return acceptSelectedWikiLinkCompletion()
    }

    refreshWikiLinkCompletion(view)
    return false
  }

  return {
    completionContext,
    selectedCompletionIndex,
    wikiLinkSuggestions,
    completionEmptyText,
    wikiLinkCompletionKeymap,
    refreshWikiLinkCompletion,
    closeWikiLinkCompletion,
    handleWikiLinkCompletionKeydown,
    applyWikiLinkSuggestion,
  }
}
