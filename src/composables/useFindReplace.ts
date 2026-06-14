import { EditorView } from '@codemirror/view'

interface SearchOptions {
  caseSensitive: boolean
  useRegex: boolean
  wholeWord: boolean
}

const getSearchSource = (text: string, options: SearchOptions): string =>
  options.useRegex ? text : text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildSearchRegExp = (text: string, options: SearchOptions): RegExp | null => {
  try {
    let source = getSearchSource(text, options)
    if (options.wholeWord) {
      source = `\\b${source}\\b`
    }
    return new RegExp(source, options.caseSensitive ? 'g' : 'gi')
  } catch {
    return null
  }
}

const buildExactSearchRegExp = (text: string, options: SearchOptions): RegExp | null => {
  try {
    let source = getSearchSource(text, options)
    if (options.wholeWord) {
      source = `\\b${source}\\b`
    }
    return new RegExp(`^(?:${source})$`, options.caseSensitive ? '' : 'i')
  } catch {
    return null
  }
}

const getAllMatches = (text: string, query: RegExp): { from: number; to: number }[] => {
  const matches: { from: number; to: number }[] = []
  query.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = query.exec(text)) !== null) {
    if (m[0].length === 0) { query.lastIndex++; continue }
    matches.push({ from: m.index, to: m.index + m[0].length })
  }
  return matches
}

export function useFindReplace(options: {
  editorView: () => EditorView | undefined
  findReplaceRef: () => any
}) {
  const reportInvalidSearch = () => {
    options.findReplaceRef()?.setSearchError?.('正则表达式无效')
  }

  const handleFind = (text: string, findOptions: { caseSensitive: boolean; useRegex: boolean; wholeWord: boolean; direction: 'next' | 'prev' }) => {
    const view = options.editorView()
    if (!view || !text) return
    const re = buildSearchRegExp(text, findOptions)
    if (!re) {
      reportInvalidSearch()
      return
    }
    const docText = view.state.doc.toString()
    const matches = getAllMatches(docText, re)
    if (matches.length === 0) {
      options.findReplaceRef()?.setMatchInfo(0, 0)
      return
    }
    const currentPos = view.state.selection.main.head
    let targetIdx = 0
    if (findOptions.direction === 'next') {
      targetIdx = matches.findIndex(m => m.from >= currentPos)
      if (targetIdx === -1) targetIdx = 0
    } else {
      targetIdx = matches.findIndex(m => m.to > currentPos)
      if (targetIdx === -1) targetIdx = matches.length - 1
      else targetIdx = Math.max(0, targetIdx - 1)
    }
    const target = matches[targetIdx]
    view.dispatch({
      selection: { anchor: target.from, head: target.to },
      scrollIntoView: true
    })
    options.findReplaceRef()?.setMatchInfo(targetIdx + 1, matches.length)
  }

  const handleReplace = (findText: string, replaceText: string, replaceOptions: { caseSensitive: boolean; useRegex: boolean; wholeWord: boolean }) => {
    const view = options.editorView()
    if (!view || !findText) return
    const { from, to } = view.state.selection.main
    const selectedText = view.state.sliceDoc(from, to)
    const re = buildSearchRegExp(findText, replaceOptions)
    const exactRe = buildExactSearchRegExp(findText, replaceOptions)
    if (!re || !exactRe) {
      reportInvalidSearch()
      return
    }
    re.lastIndex = 0
    const isSelectedMatch = exactRe.test(selectedText)
    if (isSelectedMatch) {
      const nextText = replaceOptions.useRegex ? selectedText.replace(re, replaceText) : replaceText
      view.dispatch({
        changes: { from, to, insert: nextText },
        selection: { anchor: from + nextText.length }
      })
    }
    handleFind(findText, { ...replaceOptions, direction: 'next' })
  }

  const handleReplaceAll = (findText: string, replaceText: string, replaceAllOptions: { caseSensitive: boolean; useRegex: boolean; wholeWord: boolean }) => {
    const view = options.editorView()
    if (!view || !findText) return
    const re = buildSearchRegExp(findText, replaceAllOptions)
    if (!re) {
      reportInvalidSearch()
      return
    }
    const docText = view.state.doc.toString()
    const matches = getAllMatches(docText, re)
    if (matches.length === 0) return
    re.lastIndex = 0
    const nextText = docText.replace(re, replaceText)
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: nextText }
    })
    options.findReplaceRef()?.setMatchInfo(0, 0)
  }

  return {
    handleFind,
    handleReplace,
    handleReplaceAll,
  }
}
