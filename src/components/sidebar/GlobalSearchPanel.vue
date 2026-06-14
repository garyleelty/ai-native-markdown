<template>
  <div class="global-search-panel">
    <div class="search-input-area">
      <el-input
        v-model="searchQuery"
        placeholder="搜索文件内容... (用 /pattern/ 做正则搜索)"
        size="small"
        clearable
        :prefix-icon="Search"
        @input="handleInput"
      />
      <div class="search-scope-row">
        <el-input
          v-model="scopeInput"
          placeholder="限定目录 (如 /workspace/notes/)"
          size="small"
          clearable
          class="scope-input"
          @input="handleScopeInput"
        >
          <template #prefix>
            <el-icon><FolderOpened /></el-icon>
          </template>
        </el-input>
      </div>
      <div class="search-mode-hint">
        {{ searchMode === 'regex' ? '正则搜索' : '文本搜索' }}
        <span v-if="scopePath"> · 限定: {{ scopePath }}</span>
        <span v-if="results.length > 0"> · {{ results.length }} 个文件 · {{ totalMatches }} 处匹配</span>
      </div>
      <div v-if="searchHistory.length > 0" class="search-history" aria-label="最近搜索">
        <div class="search-history-header">
          <span>最近搜索</span>
          <button type="button" class="history-clear" @click="clearSearchHistory">清空</button>
        </div>
        <div class="search-history-list">
          <button
            v-for="item in searchHistory"
            :key="`${item.query}-${item.scope}`"
            type="button"
            class="history-chip"
            :title="formatHistoryTitle(item)"
            @click="applySearchHistory(item)"
          >
            <span class="history-query">{{ item.query }}</span>
            <span v-if="item.scope" class="history-scope">{{ item.scope }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="search-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>搜索中...</span>
    </div>

    <div v-else-if="error" class="search-error">
      {{ error }}
    </div>

    <div v-else-if="results.length > 0" class="search-results">
      <div v-for="result in displayedResults" :key="result.filePath" class="search-result-item" @click="handleResultClick(result)">
        <div class="result-file-name">
          <el-icon :size="14"><Document /></el-icon>
          {{ result.fileName }}
        </div>
        <div v-for="match in result.matches" :key="`${result.filePath}-${match.lineNumber}`" class="result-match">
          <el-tag size="small" type="info" effect="plain">L{{ match.lineNumber }}</el-tag>
          <span class="match-content" v-html="renderMatchContent(match.lineContent)" />
        </div>
      </div>
      <el-button
        v-if="results.length > displayedCount"
        size="small"
        text
        class="load-more-btn"
        @click="displayedCount += PAGE_SIZE"
      >
        加载更多 ({{ results.length - displayedCount }} 条剩余)
      </el-button>
    </div>

    <div v-else-if="searchQuery && !loading" class="search-empty">
      <el-icon :size="24" color="var(--obsidian-text-faint)"><Search /></el-icon>
      <span>未找到匹配结果</span>
      <span class="search-empty-hint">试试不同关键词，或使用 <code>/pattern/</code> 正则搜索</span>
    </div>

    <div v-else class="search-placeholder">
      <el-icon :size="32" color="var(--obsidian-text-faint)"><Search /></el-icon>
      <p>输入关键词搜索工作区中的所有 Markdown 文件</p>
      <p class="search-tip">支持 <code>/pattern/</code> 正则搜索与目录限定</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { Search, Document, Loading, FolderOpened } from '@element-plus/icons-vue'
import { useGlobalSearch, type SearchResult } from '@/composables/useGlobalSearch'
import { safeStorage, sanitizeMarkdown } from '@/utils/security'

const emit = defineEmits<{
  (e: 'select', payload: { path: string; lineNumber?: number }): void
}>()

const { query, scopePath, results, loading, error, searchMode, totalMatches } = useGlobalSearch()

const PAGE_SIZE = 20
const SEARCH_HISTORY_KEY = 'global_search_history'
const SEARCH_HISTORY_LIMIT = 6

type SearchHistoryItem = {
  query: string
  scope: string
}

const displayedCount = ref(PAGE_SIZE)
const displayedResults = computed(() => results.value.slice(0, displayedCount.value))

const searchQuery = ref('')
const scopeInput = ref('')
const searchHistory = ref<SearchHistoryItem[]>(safeStorage.get<SearchHistoryItem[]>(SEARCH_HISTORY_KEY, [])
  .filter((item): item is SearchHistoryItem => typeof item?.query === 'string' && typeof item?.scope === 'string' && item.query.trim().length > 0)
  .slice(0, SEARCH_HISTORY_LIMIT))

// Reset pagination when query changes
watch(() => query.value, () => { displayedCount.value = PAGE_SIZE })

const persistSearchHistory = () => {
  safeStorage.set(SEARCH_HISTORY_KEY, searchHistory.value)
}

const rememberSearch = () => {
  const nextQuery = searchQuery.value.trim()
  if (!nextQuery) return

  const nextScope = scopeInput.value.trim()
  searchHistory.value = [
    { query: nextQuery, scope: nextScope },
    ...searchHistory.value.filter(item => item.query !== nextQuery || item.scope !== nextScope),
  ].slice(0, SEARCH_HISTORY_LIMIT)
  persistSearchHistory()
}

const handleInput = () => {
  query.value = searchQuery.value
}

const handleScopeInput = () => {
  scopePath.value = scopeInput.value.trim()
}

watch(results, (nextResults) => {
  if (nextResults.length > 0) rememberSearch()
})

const applySearchHistory = (item: SearchHistoryItem) => {
  searchQuery.value = item.query
  scopeInput.value = item.scope
  query.value = item.query
  scopePath.value = item.scope
}

const clearSearchHistory = () => {
  searchHistory.value = []
  safeStorage.remove(SEARCH_HISTORY_KEY)
}

const formatHistoryTitle = (item: SearchHistoryItem) => {
  return item.scope ? `${item.query} · 限定: ${item.scope}` : item.query
}

const handleResultClick = (result: SearchResult) => {
  const firstMatch = result.matches[0]
  emit('select', {
    path: result.filePath,
    lineNumber: firstMatch?.lineNumber,
  })
}

const renderMatchContent = (content: string): string => {
  // Highlight **marked** text from makeExcerpt, then sanitize to prevent XSS
  const highlighted = content.replace(/\*\*(.+?)\*\*/g, '<mark>$1</mark>')
  return sanitizeMarkdown(highlighted)
}

onUnmounted(() => {
  query.value = ''
})
</script>

<style scoped>
.global-search-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.search-input-area {
  padding: 10px 12px;
  flex-shrink: 0;
}

.search-scope-row {
  margin-top: 6px;
}

.scope-input :deep(.el-input__wrapper) {
  background: var(--obsidian-bg-primary);
  box-shadow: none;
  border: 1px dashed var(--obsidian-border);
  border-radius: var(--radius-sm);
}

.scope-input :deep(.el-input__wrapper:hover) {
  border-color: var(--obsidian-text-faint);
}

.scope-input :deep(.el-input__wrapper.is-focus) {
  border-style: solid;
  border-color: var(--obsidian-accent);
}

.search-mode-hint {
  font-size: 10px;
  color: var(--obsidian-text-faint);
  margin-top: 4px;
}

.search-history {
  margin-top: 8px;
  padding: 8px;
  border: 1px solid var(--obsidian-border);
  border-radius: var(--radius-sm);
  background: var(--obsidian-bg-secondary);
}

.search-history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--obsidian-text-faint);
}

.history-clear {
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--obsidian-text-faint);
  cursor: pointer;
}

.history-clear:hover {
  color: var(--obsidian-accent);
}

.search-history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.history-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--obsidian-border);
  background: var(--obsidian-bg-primary);
  color: var(--obsidian-text-normal);
  border-radius: 999px;
  padding: 5px 8px;
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  max-width: 100%;
}

.history-chip:hover {
  border-color: var(--obsidian-accent);
  color: var(--obsidian-accent);
}

.history-query,
.history-scope {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-query {
  max-width: 120px;
}

.history-scope {
  max-width: 110px;
  color: var(--obsidian-text-faint);
}

.search-loading,
.search-error,
.search-empty,
.search-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  color: var(--obsidian-text-muted);
  font-size: 12px;
  gap: 8px;
}

.search-empty .search-empty-hint {
  font-size: 11px;
  color: var(--obsidian-text-faint);
}

.search-empty .search-empty-hint code {
  background: var(--obsidian-bg-primary);
  padding: 1px 4px;
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 11px;
}

.search-placeholder p {
  margin: 0;
  text-align: center;
}

.search-tip {
  font-size: 11px;
  color: var(--obsidian-text-faint);
}

.search-tip code {
  background: var(--obsidian-bg-primary);
  padding: 1px 4px;
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 11px;
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.search-result-item {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--obsidian-bg-primary);
  border: 1px solid var(--obsidian-border);
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.search-result-item:hover {
  border-color: var(--obsidian-accent);
}

.load-more-btn {
  width: 100%;
  margin-top: 4px;
  color: var(--obsidian-text-muted) !important;
}

.load-more-btn:hover {
  color: var(--obsidian-accent) !important;
}

.result-file-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--obsidian-text-normal);
  margin-bottom: 4px;
}

.result-match {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
}

.match-content {
  color: var(--obsidian-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.match-content :deep(mark) {
  background: var(--obsidian-accent-soft);
  color: var(--obsidian-accent);
  padding: 0 2px;
  border-radius: 2px;
}
</style>
