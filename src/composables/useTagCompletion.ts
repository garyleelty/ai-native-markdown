import { ref, computed, watch } from 'vue'
import { EditorView, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { knowledgeIndex } from '@/services/knowledgeIndex'

export interface TagSuggestion {
  tag: string
  count: number
}

export interface TagCompletionContext {
  from: number
  to: number
  query: string
}

export function useTagCompletion(options: {
  editorView: () => EditorView | undefined
}) {
  const completionContext = ref<TagCompletionContext | null>(null)
  const selectedCompletionIndex = ref(0)
  const allTags = ref<TagSuggestion[]>([])
  const tagsLoading = ref(false)

  // Fetch all tags from knowledge index
  const loadAllTags = async () => {
    tagsLoading.value = true
    try {
      const records = await knowledgeIndex.getAll()
      const tagCount = new Map<string, number>()
      for (const record of records) {
        for (const tag of record.tags || []) {
          tagCount.set(tag, (tagCount.get(tag) || 0) + 1)
        }
      }
      allTags.value = [...tagCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([tag, count]) => ({ tag, count }))
    } finally {
      tagsLoading.value = false
    }
  }

  // Detect tag completion trigger
  const detectTagCompletion = (view: EditorView): TagCompletionContext | null => {
    const selection = view.state.selection.main
    if (!selection.empty) return null

    const position = selection.head
    const line = view.state.doc.lineAt(position)
    const textBeforeCursor = line.text.slice(0, position - line.from)

    const hashIndex = textBeforeCursor.lastIndexOf('#')
    if (hashIndex === -1) return null

    // Must be at start of line or preceded by whitespace
    if (hashIndex > 0 && !/\s/.test(textBeforeCursor[hashIndex - 1])) return null

    const query = textBeforeCursor.slice(hashIndex + 1)
    // Stop at whitespace, comma, bracket
    if (/[\s,\[\]]/.test(query)) return null
    // Empty query after # - not a valid trigger
    if (query === '') return null

    return {
      from: line.from + hashIndex,
      to: position,
      query,
    }
  }

  // Filter tags based on query
  const tagSuggestions = computed<TagSuggestion[]>(() => {
    const context = completionContext.value
    if (!context) return []

    const query = context.query.toLowerCase()
    return allTags.value
      .filter(({ tag }) => !query || tag.toLowerCase().includes(query))
      .slice(0, 8)
  })

  // Reset selection when suggestions change
  watch(tagSuggestions, (suggestions) => {
    if (selectedCompletionIndex.value >= suggestions.length) {
      selectedCompletionIndex.value = Math.max(0, suggestions.length - 1)
    }
  })

  const refreshTagCompletion = (view: EditorView) => {
    const nextContext = detectTagCompletion(view)
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

  const closeTagCompletion = () => {
    completionContext.value = null
    selectedCompletionIndex.value = 0
  }

  const moveTagCompletionSelection = (delta: number): boolean => {
    const suggestions = tagSuggestions.value
    if (!completionContext.value || suggestions.length === 0) return false
    selectedCompletionIndex.value = (selectedCompletionIndex.value + delta + suggestions.length) % suggestions.length
    return true
  }

  const applyTagSuggestion = (suggestion: TagSuggestion) => {
    const view = options.editorView()
    const context = completionContext.value
    if (!view || !context) return

    const insert = `#${suggestion.tag}`
    view.dispatch({
      changes: { from: context.from, to: context.to, insert },
      selection: { anchor: context.from + insert.length },
      scrollIntoView: true,
    })
    closeTagCompletion()
    view.focus()
  }

  const acceptSelectedTagCompletion = (): boolean => {
    if (!completionContext.value) return false
    const suggestions = tagSuggestions.value
    const suggestion = suggestions[selectedCompletionIndex.value] || suggestions[0]
    if (!suggestion) return false
    applyTagSuggestion(suggestion)
    return true
  }

  const tagCompletionKeymap = Prec.highest(keymap.of([
    {
      key: 'ArrowDown',
      run: () => {
        if (!completionContext.value) return false
        return moveTagCompletionSelection(1)
      },
    },
    {
      key: 'ArrowUp',
      run: () => {
        if (!completionContext.value) return false
        return moveTagCompletionSelection(-1)
      },
    },
    {
      key: 'Enter',
      run: () => acceptSelectedTagCompletion(),
    },
    {
      key: 'Tab',
      run: () => acceptSelectedTagCompletion(),
    },
    {
      key: 'Escape',
      run: () => {
        if (!completionContext.value) return false
        closeTagCompletion()
        return true
      },
    },
  ]))

  const handleTagCompletionKeydown = (event: KeyboardEvent, view: EditorView): boolean => {
    if (!completionContext.value) return false

    if (event.key === 'Escape') {
      event.preventDefault()
      closeTagCompletion()
      return true
    }

    const suggestions = tagSuggestions.value
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault()
      return moveTagCompletionSelection(1)
    }
    if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault()
      return moveTagCompletionSelection(-1)
    }
    if ((event.key === 'Enter' || event.key === 'Tab') && suggestions.length > 0) {
      event.preventDefault()
      return acceptSelectedTagCompletion()
    }

    refreshTagCompletion(view)
    return false
  }

  // Subscribe to knowledge index changes
  const unsubscribe = knowledgeIndex.subscribe(() => {
    void loadAllTags()
  })

  // Initial load
  void loadAllTags()

  return {
    completionContext,
    selectedCompletionIndex,
    tagSuggestions,
    tagsLoading,
    tagCompletionKeymap,
    detectTagCompletion,
    refreshTagCompletion,
    closeTagCompletion,
    handleTagCompletionKeydown,
    applyTagSuggestion,
    loadAllTags,
    unsubscribe,
  }
}
