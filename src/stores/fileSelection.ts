import { computed, readonly, ref } from 'vue'
import { defineStore } from 'pinia'

export const useFileSelectionStore = defineStore('fileSelection', () => {
  const selectedPaths = ref<string[]>([])
  const lastSelectedPath = ref('')
  const visiblePaths = ref<string[]>([])

  const selectedPathList = computed(() => selectedPaths.value)
  const selectedCount = computed(() => selectedPaths.value.length)

  const isSelected = (path: string): boolean => selectedPaths.value.includes(path)

  const setSelected = (paths: string[]): void => {
    selectedPaths.value = [...new Set(paths)]
  }

  const selectOnly = (path: string): void => {
    setSelected(path ? [path] : [])
    lastSelectedPath.value = path
  }

  const toggleSelection = (path: string): void => {
    if (!path) return
    if (isSelected(path)) setSelected(selectedPaths.value.filter(item => item !== path))
    else setSelected([...selectedPaths.value, path])
    lastSelectedPath.value = path
  }

  const selectRange = (path: string, additive = false): void => {
    if (!path) return
    if (!lastSelectedPath.value) {
      selectOnly(path)
      return
    }
    const start = visiblePaths.value.indexOf(lastSelectedPath.value)
    const end = visiblePaths.value.indexOf(path)
    if (start === -1 || end === -1) {
      toggleSelection(path)
      return
    }
    const [from, to] = start < end ? [start, end] : [end, start]
    const range = visiblePaths.value.slice(from, to + 1)
    setSelected(additive ? [...selectedPaths.value, ...range] : range)
  }

  const handleNodeSelection = (path: string, event?: MouseEvent): void => {
    if (event?.shiftKey) selectRange(path, event?.metaKey || event?.ctrlKey)
    else if (event?.metaKey || event?.ctrlKey) toggleSelection(path)
    else selectOnly(path)
  }

  const clearSelection = (): void => {
    selectedPaths.value = []
    lastSelectedPath.value = ''
  }

  const setVisiblePaths = (paths: string[]): void => {
    visiblePaths.value = [...new Set(paths)]
    selectedPaths.value = selectedPaths.value.filter(path => visiblePaths.value.includes(path))
    if (lastSelectedPath.value && !visiblePaths.value.includes(lastSelectedPath.value)) {
      lastSelectedPath.value = selectedPaths.value[0] ?? lastSelectedPath.value
    }
  }

  const removeSelected = (paths: string[]): void => {
    const removed = new Set(paths)
    selectedPaths.value = selectedPaths.value.filter(path => !removed.has(path))
    if (removed.has(lastSelectedPath.value)) lastSelectedPath.value = selectedPaths.value[0] ?? lastSelectedPath.value
  }

  return {
    selectedPaths: readonly(selectedPaths),
    lastSelectedPath: readonly(lastSelectedPath),
    visiblePaths: readonly(visiblePaths),
    selectedPathList,
    selectedCount,
    isSelected,
    selectOnly,
    toggleSelection,
    selectRange,
    handleNodeSelection,
    clearSelection,
    setVisiblePaths,
    removeSelected,
  }
})
