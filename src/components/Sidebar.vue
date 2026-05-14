<template>
  <div class="sidebar">
    <!-- 侧边栏导航 tabs -->
    <nav class="sidebar-nav">
      <button class="nav-btn" :class="{ active: activeTab === 'files' }" @click="activeTab = 'files'" title="文件">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      </button>
      <button class="nav-btn" :class="{ active: activeTab === 'ai' }" @click="activeTab = 'ai'" title="AI 配置">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z"/></svg>
      </button>
      <button class="nav-btn" :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'" title="设置">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06-.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
      </button>
    </nav>

    <!-- 侧边栏内容区 -->
    <div class="sidebar-content">
      <Transition name="fade" mode="out-in">
        <div v-if="activeTab === 'files'" class="panel panel-files">
          <div class="panel-header">
            <span class="panel-title">资源管理器</span>
            <div class="panel-actions" v-if="rootPath">
              <button class="panel-action" @click="handleCreateFile" title="新建文件">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              </button>
              <button class="panel-action" @click="handleCreateFolder" title="新建文件夹">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                  <line x1="12" y1="11" x2="12" y2="17"/>
                  <line x1="9" y1="14" x2="15" y2="14"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- 搜索框 -->
          <div class="search-bar" v-if="rootPath">
            <div class="search-input-wrapper">
              <svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input 
                type="text" 
                v-model="searchQuery" 
                class="search-input" 
                placeholder="搜索文件..." 
                @keydown.enter="searchContent"
              />
              <button v-if="searchQuery" class="search-clear" @click="clearSearch">×</button>
              <button class="search-toggle" @click="toggleSearchMode" :class="{ active: searchMode === 'content' }" title="切换为内容搜索">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </button>
            </div>
            <div class="search-mode-hint">{{ searchMode === 'name' ? '文件名搜索' : '内容搜索' }}</div>
          </div>

          <!-- 搜索结果 -->
          <div class="search-results" v-if="searchResults.length > 0 && searchQuery">
            <div class="search-result-header">找到 {{ searchResults.length }} 个结果</div>
            <div 
              v-for="result in searchResults" 
              :key="result.file_path" 
              class="search-result-item"
              @click="handleSearchResultClick(result)"
            >
              <div class="result-file-name">{{ result.file_name }}</div>
              <div class="result-matches">
                <div 
                  v-for="(match, idx) in result.matches.slice(0, 3)" 
                  :key="idx" 
                  class="result-match-line"
                >
                  <span class="match-line-number">{{ match.line_number }}</span>
                  <span class="match-line-content">{{ match.line_content }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="file-list" v-if="rootPath && (!searchQuery || searchMode === 'content' && searchResults.length === 0)">
            <FileTreeNode
              v-if="treeRoot"
              :node="treeRoot"
              :current-file-path="currentFilePath"
              :search-filter="searchMode === 'name' ? searchQuery : ''"
              @select="handleSelect"
              @toggle="handleToggle"
              @create="handleCreate"
              @rename="handleRename"
              @delete="handleDelete"
              @cancel-edit="handleCancelEdit"
            />
          </div>

          <div class="empty-prompt" v-else>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" aria-hidden="true"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            <p class="empty-title">选择工作区</p>
            <p class="empty-desc">打开本地文件夹，在侧栏浏览与编辑 Markdown</p>
            <div class="open-actions">
              <button type="button" class="open-workspace-btn" @click="openFolder">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                {{ isTauri ? '打开文件夹…' : '试用示例工作区' }}
              </button>
              <p class="empty-hint-web" v-if="!isTauri">桌面版可使用系统对话框打开真实文件夹</p>
              <template v-if="isTauri">
                <button type="button" class="manual-path-toggle" @click="toggleManualPath">
                  {{ showManualPath ? '收起手动路径' : '手动输入路径' }}
                </button>
                <div class="manual-path-block" v-show="showManualPath">
                  <div class="path-input-group">
                    <input
                      type="text"
                      v-model="manualPath"
                      class="path-input"
                      placeholder="文件夹绝对路径"
                      autocomplete="off"
                      spellcheck="false"
                      aria-label="文件夹绝对路径"
                      @keydown.enter="openPath"
                      ref="pathInputRef"
                    />
                    <button type="button" class="path-go-btn" @click="openPath" :disabled="!manualPath.trim()" aria-label="打开此路径">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                  <div class="path-error" v-if="pathError">{{ pathError }}</div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- AI 配置面板 -->
        <div v-else-if="activeTab === 'ai'" class="panel panel-ai">
          <div class="panel-header">
            <span class="panel-title">AI CONFIG</span>
            <span class="connection-status" :class="connectionStatus">
              <span class="status-dot"></span>
              {{ connectionStatusText }}
            </span>
          </div>

          <div class="config-form">
            <div class="config-field">
              <label>Provider</label>
              <select v-model="selectedProvider" class="config-select" @change="onProviderChange">
                <option value="ollama">Ollama (本地)</option>
                <option value="openai">OpenAI 兼容 (云端)</option>
              </select>
            </div>

            <!-- Ollama 专属配置 -->
            <template v-if="selectedProvider === 'ollama'">
              <div class="config-field">
                <label>服务地址</label>
                <input type="text" v-model="ollamaBaseURL" placeholder="http://localhost:11434" class="config-input" />
                <span class="config-hint">默认通过 Vite 代理，也可直填 Ollama 地址</span>
              </div>
              <div class="config-field">
                <label>模型</label>
                <input type="text" v-model="model" placeholder="qwen2.5:7b" class="config-input" />
                <span class="config-hint">需先运行 ollama pull 拉取模型</span>
              </div>
            </template>

            <!-- OpenAI 兼容配置 -->
            <template v-if="selectedProvider === 'openai'">
              <div class="config-field">
                <label>API Key</label>
                <input type="password" v-model="apiKey" placeholder="sk-..." class="config-input" />
              </div>
              <div class="config-field">
                <label>API 地址</label>
                <input type="text" v-model="openaiBaseURL" placeholder="https://api.openai.com/v1" class="config-input" />
                <span class="config-hint">支持 DeepSeek/通义千问/LM Studio 等 OpenAI 兼容 API</span>
              </div>
              <div class="config-field">
                <label>模型</label>
                <input type="text" v-model="model" placeholder="gpt-4o-mini" class="config-input" />
              </div>
            </template>

            <div class="config-field">
              <label>Temperature <span class="temp-val">{{ temperature }}</span></label>
              <input type="range" v-model.number="temperature" min="0" max="2" step="0.1" class="config-range" />
            </div>

            <div class="config-actions">
              <button class="test-btn" @click="testConnection" :disabled="testing">
                <svg v-if="!testing" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span v-else class="mini-spinner"></span>
                {{ testing ? '测试中...' : '测试连接' }}
              </button>
              <button class="save-btn" @click="saveAIConfig">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                保存
              </button>
            </div>

            <div class="config-message" v-if="testResult" :class="testResult.type">
              {{ testResult.message }}
            </div>

            <div class="config-message success" v-if="configSaved">
              ✓ 配置已保存并激活
            </div>
          </div>
        </div>

        <!-- 设置面板 -->
        <div v-else-if="activeTab === 'settings'" class="panel panel-settings">
          <div class="panel-header">
            <span class="panel-title">SETTINGS</span>
          </div>

          <div class="settings-list">
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">外观主题</span>
                <span class="setting-desc">{{ isDark ? '深色模式' : '浅色模式' }}</span>
              </div>
              <button class="toggle-btn" @click="toggleTheme" :class="{ dark: isDark }">
                <svg v-if="isDark" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              </button>
            </div>

            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">AI 助手</span>
                <span class="setting-desc">内嵌辅助写作</span>
              </div>
              <button class="toggle-btn" @click="$emit('toggle-ai')" :class="{ dark: showAI }">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z"/></svg>
              </button>
            </div>

            <div class="settings-divider"></div>

            <div class="setting-section-title">关于</div>
            <div class="about-card">
              <div class="about-brand">AI Markdown</div>
              <div class="about-version">v0.1.0</div>
              <div class="about-desc">AI 原生 Markdown 编辑器，让写作更智能。</div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import FileTreeNode from './FileTreeNode.vue'
import { aiService, OpenAIProvider, OllamaProvider } from '../services/ai'
import type { TreeNode } from '@/types'

interface Props {
  isDark?: boolean
  showAI?: boolean
}
withDefaults(defineProps<Props>(), { isDark: true, showAI: false })

const emit = defineEmits<{
  (e: 'select', path: string): void
  (e: 'toggle-theme'): void
  (e: 'toggle-ai'): void
}>()

const activeTab = ref<'files' | 'ai' | 'settings'>('files')

// ── 文件树逻辑 ──
const isTauri = '__TAURI_INTERNALS__' in window

// 静态导入 Tauri API，避免动态导入的竞态问题
import { invoke } from '@tauri-apps/api/core'
import { open as openDialog } from '@tauri-apps/plugin-dialog'

const rootPath = ref('')
const rootName = ref('')
const treeRoot = ref<TreeNode | null>(null)
const currentFilePath = ref('')
const manualPath = ref('')
const pathError = ref('')
const pathInputRef = ref<HTMLInputElement | null>(null)
const showManualPath = ref(false)

const toggleManualPath = () => {
  showManualPath.value = !showManualPath.value
  if (showManualPath.value) {
    nextTick(() => pathInputRef.value?.focus())
  }
}

// 搜索相关
const searchQuery = ref('')
const searchMode = ref<'name' | 'content'>('name')
const searchResults = ref<Array<{ file_path: string; file_name: string; matches: Array<{ line_number: number; line_content: string }> }>>([])

const toggleSearchMode = () => {
  searchMode.value = searchMode.value === 'name' ? 'content' : 'name'
  if (searchMode.value === 'content' && searchQuery.value) {
    searchContent()
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  searchResults.value = []
}

const searchContent = async () => {
  if (!searchQuery.value.trim() || !rootPath.value) return
  
  searchResults.value = []
  try {
    const results = await invoke('search_files', { 
      dir_path: rootPath.value, 
      query: searchQuery.value 
    }) as any[]
    searchResults.value = results
  } catch (error) {
    console.error('搜索失败:', error)
  }
}

const handleSearchResultClick = (result: { file_path: string }) => {
  handleSelect(result.file_path)
  clearSearch()
}

// 将扁平的目录项转换为树节点
const entriesToTreeNodes = (entries: any[]): TreeNode[] => {
  return entries
    .filter((e: any) => e.name.endsWith('.md') || e.name.endsWith('.markdown') || e.is_dir)
    .map((e: any) => ({
      id: e.path,
      name: e.name,
      path: e.path,
      isDirectory: e.is_dir,
      isMarkdown: e.name.endsWith('.md') || e.name.endsWith('.markdown'),
      children: e.is_dir ? [] : undefined,
      isExpanded: false
    }))
}

// 加载文件夹内容
const loadDirectory = async (dirPath: string): Promise<TreeNode[]> => {
  if (!isTauri) return []
  try {
    const entries = await invoke('read_dir', { path: dirPath }) as any[]
    return entriesToTreeNodes(entries)
  } catch (error) {
    console.error('加载目录失败:', error)
    return []
  }
}

// 递归加载子文件夹
const expandNode = async (node: TreeNode) => {
  if (!node.isDirectory || !isTauri) return
  node.children = await loadDirectory(node.path)
  node.isExpanded = true
}

const openFolder = async () => {
  if (!isTauri) {
    rootPath.value = '/demo/workspace'
    rootName.value = 'demo-workspace'
    treeRoot.value = {
      id: '/demo/workspace',
      name: 'demo-workspace',
      path: '/demo/workspace',
      isDirectory: true,
      isMarkdown: false,
      isExpanded: true,
      children: [
        { id: '/demo/workspace/README.md', name: 'README.md', path: '/demo/workspace/README.md', isDirectory: false, isMarkdown: true },
        { id: '/demo/workspace/笔记.md', name: '笔记.md', path: '/demo/workspace/笔记.md', isDirectory: false, isMarkdown: true },
        { id: '/demo/workspace/项目文档.md', name: '项目文档.md', path: '/demo/workspace/项目文档.md', isDirectory: false, isMarkdown: true }
      ]
    }
    return
  }
  try {
    const selected = await openDialog({ directory: true, multiple: false, title: '选择工作区文件夹' })
    if (selected) {
      rootPath.value = selected as string
      rootName.value = (selected as string).split('/').pop() || '文件夹'
      const children = await loadDirectory(selected as string)
      treeRoot.value = {
        id: selected as string,
        name: rootName.value,
        path: selected as string,
        isDirectory: true,
        isMarkdown: false,
        isExpanded: true,
        children
      }
    }
  } catch (error) { console.error('打开文件夹失败:', error) }
}

// 手动输入路径打开文件夹
const openPath = async () => {
  const p = manualPath.value.trim()
  if (!p) return
  pathError.value = ''

  if (!isTauri) {
    pathError.value = '手动输入路径仅在 Tauri 桌面端可用'
    setTimeout(() => { pathError.value = '' }, 4000)
    return
  }

  try {
    const entries = await invoke('read_dir', { path: p }) as any[]
    if (!entries || entries.length === 0) {
      pathError.value = '路径为空或无法读取'
      return
    }
    rootPath.value = p
    rootName.value = p.split('/').pop() || p.split('\\').pop() || '文件夹'
    const children = entriesToTreeNodes(entries)
    treeRoot.value = {
      id: p,
      name: rootName.value,
      path: p,
      isDirectory: true,
      isMarkdown: false,
      isExpanded: true,
      children
    }
    manualPath.value = ''
    showManualPath.value = false
  } catch (error: any) {
    pathError.value = error?.toString?.() || '无法打开该路径，请检查路径是否正确'
    setTimeout(() => { pathError.value = '' }, 4000)
  }
}

// 文件树事件处理
const handleSelect = (path: string) => {
  currentFilePath.value = path
  emit('select', path)
}

const handleToggle = async (path: string) => {
  const findNode = (nodes: TreeNode[] | undefined, targetPath: string): TreeNode | null => {
    if (!nodes) return null
    for (const node of nodes) {
      if (node.path === targetPath) return node
      if (node.children) {
        const found = findNode(node.children, targetPath)
        if (found) return found
      }
    }
    return null
  }

  const node = treeRoot.value ? findNode([treeRoot.value], path) : null
  if (!node || !node.isDirectory) return

  if (node.isExpanded) {
    node.isExpanded = false
  } else {
    await expandNode(node)
  }
}

// 查找父节点路径
const findParentPath = (nodes: TreeNode[] | undefined, targetPath: string): string | null => {
  if (!nodes) return null
  for (const node of nodes) {
    if (node.children) {
      for (const child of node.children) {
        if (child.path === targetPath) return node.path
      }
      const found = findParentPath(node.children, targetPath)
      if (found) return found
    }
  }
  return null
}

// 在指定父节点下添加新建节点
const addNewNode = (parentPath: string, isDirectory: boolean) => {
  const findNode = (nodes: TreeNode[] | undefined, targetPath: string): TreeNode | null => {
    if (!nodes) return null
    for (const node of nodes) {
      if (node.path === targetPath) return node
      if (node.children) {
        const found = findNode(node.children, targetPath)
        if (found) return found
      }
    }
    return null
  }

  const parent = treeRoot.value ? findNode([treeRoot.value], parentPath) : null
  if (!parent || !parent.isDirectory) return

  // 确保父节点展开
  parent.isExpanded = true
  if (!parent.children) parent.children = []

  // 添加临时新建节点
  const tempId = `${parentPath}/__new__${Date.now()}`
  const newNode: TreeNode = {
    id: tempId,
    name: '',
    path: tempId,
    isDirectory,
    isMarkdown: !isDirectory,
    isEditing: true,
    isNew: true
  }
  parent.children.push(newNode)
}

// 移除临时节点
const removeTempNode = (path: string) => {
  const removeFromNodes = (nodes: TreeNode[] | undefined): boolean => {
    if (!nodes) return false
    const idx = nodes.findIndex(n => n.path === path)
    if (idx >= 0) {
      nodes.splice(idx, 1)
      return true
    }
    for (const node of nodes) {
      if (node.children && removeFromNodes(node.children)) return true
    }
    return false
  }
  if (treeRoot.value) {
    removeFromNodes(treeRoot.value.children)
  }
}

// 刷新指定目录
const refreshDirectory = async (dirPath: string) => {
  const findNode = (nodes: TreeNode[] | undefined, targetPath: string): TreeNode | null => {
    if (!nodes) return null
    for (const node of nodes) {
      if (node.path === targetPath) return node
      if (node.children) {
        const found = findNode(node.children, targetPath)
        if (found) return found
      }
    }
    return null
  }

  const node = treeRoot.value ? findNode([treeRoot.value], dirPath) : null
  if (node && node.isDirectory) {
    node.children = await loadDirectory(dirPath)
    node.isExpanded = true
  }
}

// 头部按钮：新建文件
const handleCreateFile = () => {
  if (!treeRoot.value) return
  addNewNode(treeRoot.value.path, false)
}

// 头部按钮：新建文件夹
const handleCreateFolder = () => {
  if (!treeRoot.value) return
  addNewNode(treeRoot.value.path, true)
}

// 树内新建/重命名事件
const handleCreate = async (payload: { parentPath: string; name: string; isDirectory: boolean }) => {
  const { parentPath, name, isDirectory } = payload

  try {
    // 验证 parentPath 是否为目录（而不是文件）
    const parentMeta = await invoke('read_dir', { path: parentPath })
    
    // 如果 read_dir 失败，说明 parentPath 可能是文件或不存在
    // 这里我们捕获错误并给出明确提示
    
    // 重名检查：检查是否已存在同名项
    const existingEntries = parentMeta as any[]
    const targetName = isDirectory ? name : (name.endsWith('.md') || name.endsWith('.markdown') ? name : name + '.md')
    
    const duplicate = existingEntries.find((e: any) => {
      if (isDirectory) {
        return e.is_dir && e.name === name
      } else {
        return !e.is_dir && (e.name === targetName || e.name === name)
      }
    })
    
    if (duplicate) {
      const itemType = isDirectory ? '文件夹' : '文件'
      throw new Error(`已存在同名${itemType} "${targetName}"`)
    }
    
    // 执行创建
    const newPath = `${parentPath}/${name}`
    if (isDirectory) {
      await invoke('create_dir', { path: newPath })
    } else {
      await invoke('create_file', { path: newPath })
    }
    // 刷新父目录
    await refreshDirectory(parentPath)
    // 如果是文件，自动打开
    if (!isDirectory) {
      currentFilePath.value = newPath
      emit('select', newPath)
    }
  } catch (error: any) {
    console.error('创建失败:', error)
    
    // 检查是否是"路径不是目录"的错误
    const errorMsg = error?.toString?.() || '创建失败'
    if (errorMsg.includes('不是文件夹') || errorMsg.includes('Not a directory')) {
      throw new Error('只能在文件夹内新建文件/文件夹，不能在文件下创建子项')
    }
    
    // 显示错误（临时节点的错误显示）
    const findNode = (nodes: TreeNode[] | undefined, targetPath: string): TreeNode | null => {
      if (!nodes) return null
      for (const node of nodes) {
        if (node.path === targetPath) return node
        if (node.children) {
          const found = findNode(node.children, targetPath)
          if (found) return found
        }
      }
      return null
    }
    // 查找临时节点并显示错误
    const tempNode = findNode(treeRoot.value?.children, `${parentPath}/__new__`)
    if (tempNode) {
      tempNode.error = errorMsg
    }
  }
}

const handleRename = async (payload: { oldPath: string; newPath: string }) => {
  try {
    await invoke('rename_file', { oldPath: payload.oldPath, newPath: payload.newPath })
    // 刷新相关目录
    const parentPath = payload.oldPath.substring(0, payload.oldPath.lastIndexOf('/'))
    await refreshDirectory(parentPath)
    // 如果重命名的是当前打开的文件，更新当前路径
    if (currentFilePath.value === payload.oldPath) {
      currentFilePath.value = payload.newPath
    }
  } catch (error: any) {
    console.error('重命名失败:', error)
    alert('重命名失败: ' + (error?.toString?.() || '未知错误'))
  }
}

const handleDelete = async (path: string) => {
  try {
    await invoke('delete_file', { path })
    // 刷新父目录
    const parentPath = path.substring(0, path.lastIndexOf('/'))
    await refreshDirectory(parentPath)
    // 如果删除的是当前打开的文件，清空当前路径
    if (currentFilePath.value === path) {
      currentFilePath.value = ''
    }
  } catch (error: any) {
    console.error('删除失败:', error)
    alert('删除失败: ' + (error?.toString?.() || '未知错误'))
  }
}

const handleCancelEdit = (path: string) => {
  removeTempNode(path)
}

// ── AI 配置逻辑 ──
const selectedProvider = ref('ollama')
const apiKey = ref('')
const model = ref('qwen2.5:7b')
const temperature = ref(0.7)
const ollamaBaseURL = ref('/api/ai/ollama')
const openaiBaseURL = ref('/api/ai/openai')
const configSaved = ref(false)
const testing = ref(false)
const testResult = ref<{ type: 'success' | 'error'; message: string } | null>(null)
const connectionStatus = ref<'idle' | 'connected' | 'error'>('idle')

const connectionStatusText = computed(() => {
  const map = { idle: '未连接', connected: '已连接', error: '连接失败' }
  return map[connectionStatus.value]
})

const onProviderChange = () => {
  testResult.value = null
  if (selectedProvider.value === 'ollama') {
    model.value = 'qwen2.5:7b'
  } else {
    model.value = 'gpt-4o-mini'
  }
}

const testConnection = async () => {
  testing.value = true
  testResult.value = null
  try {
    // 先保存配置以注册 Provider
    applyAIConfig()
    const provider = aiService.getProvider(selectedProvider.value)
    if (!provider) {
      testResult.value = { type: 'error', message: 'Provider 未注册，请先保存配置' }
      return
    }
    const result = await provider.testConnection()
    if (result.ok) {
      connectionStatus.value = 'connected'
      testResult.value = { type: 'success', message: result.error ? `连接成功（${result.error}）` : '连接成功！' }
    } else {
      connectionStatus.value = 'error'
      testResult.value = { type: 'error', message: result.error || '连接失败' }
    }
  } catch (e: any) {
    connectionStatus.value = 'error'
    testResult.value = { type: 'error', message: e?.message || String(e) }
  } finally {
    testing.value = false
  }
}

const applyAIConfig = () => {
  if (selectedProvider.value === 'ollama') {
    aiService.registerProvider(new OllamaProvider({
      provider: 'ollama',
      baseURL: ollamaBaseURL.value || '/api/ai/ollama',
      model: model.value || 'qwen2.5:7b',
      temperature: temperature.value,
    }))
  } else {
    aiService.registerProvider(new OpenAIProvider({
      provider: 'openai',
      apiKey: apiKey.value,
      baseURL: openaiBaseURL.value || '/api/ai/openai',
      model: model.value || 'gpt-4o-mini',
      temperature: temperature.value,
    }))
  }
  aiService.setActiveProvider(selectedProvider.value)
}

const saveAIConfig = () => {
  applyAIConfig()
  // 持久化到 localStorage
  localStorage.setItem('ai_provider', selectedProvider.value)
  localStorage.setItem('ai_api_key', apiKey.value)
  localStorage.setItem('ai_model', model.value)
  localStorage.setItem('ai_temperature', String(temperature.value))
  localStorage.setItem('ai_ollama_base_url', ollamaBaseURL.value)
  localStorage.setItem('ai_openai_base_url', openaiBaseURL.value)
  configSaved.value = true
  setTimeout(() => { configSaved.value = false }, 2500)
}

const toggleTheme = () => { emit('toggle-theme') }

// ── 文件读写 ──
const readFile = async (filePath: string): Promise<string> => {
  if (!isTauri) return ''
  try { return await invoke('read_file', { path: filePath }) as string } catch { return '' }
}
const saveFile = async (filePath: string, content: string): Promise<boolean> => {
  if (!isTauri) return false
  try { await invoke('write_file', { path: filePath, content }); return true } catch { return false }
}

onMounted(() => {
  // 从 localStorage 恢复配置
  const savedProvider = localStorage.getItem('ai_provider')
  if (savedProvider) selectedProvider.value = savedProvider

  const savedKey = localStorage.getItem('ai_api_key')
  if (savedKey) apiKey.value = savedKey

  const savedModel = localStorage.getItem('ai_model')
  if (savedModel) model.value = savedModel

  const savedTemp = localStorage.getItem('ai_temperature')
  if (savedTemp) temperature.value = parseFloat(savedTemp)

  const savedOllamaURL = localStorage.getItem('ai_ollama_base_url')
  if (savedOllamaURL) ollamaBaseURL.value = savedOllamaURL

  const savedOpenaiURL = localStorage.getItem('ai_openai_base_url')
  if (savedOpenaiURL) openaiBaseURL.value = savedOpenaiURL

  // 恢复 Provider 注册
  applyAIConfig()
})

defineExpose({ readFile, saveFile })
</script>

<style scoped>
.sidebar {
  height: 100%;
  display: flex;
  overflow: hidden;
}

/* ── 侧边栏导航条 ── */
.sidebar-nav {
  width: 44px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3) 0;
  gap: var(--space-1);
  background: var(--bg-deep);
  border-right: 1px solid var(--border-subtle);
}
.nav-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
  position: relative;
}
.nav-btn::before {
  content: '';
  position: absolute;
  left: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: var(--accent-primary);
  border-radius: 0 3px 3px 0;
  transition: all var(--duration-fast) var(--ease-default);
}
.nav-btn:hover {
  color: var(--accent-primary);
  background: var(--bg-hover);
}
.nav-btn.active {
  color: var(--accent-primary);
  background: var(--accent-soft);
}
.nav-btn.active::before {
  height: 16px;
}

/* ── 内容区 ── */
.sidebar-content {
  flex: 1;
  overflow: hidden;
  min-width: 0;
}
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── 面板头部 ── */
.panel-header {
  padding: var(--space-4) var(--space-4) var(--space-3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.panel-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.panel-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.panel-action {
  width: 24px;
  height: 24px;
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) var(--ease-default);
}
.panel-action:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

/* ── 搜索框 ── */
.search-bar {
  padding: var(--space-3) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}
.search-input-wrapper {
  display: flex;
  align-items: center;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  gap: var(--space-2);
  transition: all var(--duration-fast) var(--ease-default);
}
.search-input-wrapper:focus-within {
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-glow);
}
.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}
.search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  font-family: var(--font-sans);
}
.search-input::placeholder {
  color: var(--text-muted);
}
.search-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast) var(--ease-default);
}
.search-clear:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.search-toggle {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast) var(--ease-default);
}
.search-toggle:hover {
  color: var(--text-secondary);
}
.search-toggle.active {
  color: var(--accent-primary);
  background: var(--accent-soft);
}
.search-mode-hint {
  font-size: 10px;
  color: var(--text-muted);
  text-align: center;
  margin-top: var(--space-2);
}

/* ── 搜索结果 ── */
.search-results {
  padding: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
  max-height: 300px;
  overflow-y: auto;
}
.search-result-header {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: var(--space-2) var(--space-3);
}
.search-result-item {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
  margin-bottom: var(--space-1);
}
.search-result-item:hover {
  background: var(--bg-hover);
}
.result-file-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}
.result-matches {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.result-match-line {
  display: flex;
  gap: var(--space-3);
  font-size: 11px;
  color: var(--text-secondary);
}
.match-line-number {
  font-family: var(--font-mono);
  color: var(--text-muted);
  font-size: 10px;
  min-width: 24px;
  text-align: right;
  font-feature-settings: '"tnum"';
}
.match-line-content {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 文件列表 ── */
.file-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2) var(--space-2);
}

.empty-hint {
  padding: var(--space-5);
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
.empty-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-8);
  padding: 0 var(--space-4);
}
.empty-prompt svg {
  opacity: 0.3;
}
.empty-title {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  margin: 0;
  text-align: center;
}
.empty-desc {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.45;
  margin: 0;
  text-align: center;
  max-width: 220px;
}
.empty-hint-web {
  margin: 0;
  font-size: 10px;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.4;
  opacity: 0.85;
}
.open-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-2);
}
.open-workspace-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--accent-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-default);
}
.open-workspace-btn:hover {
  background: var(--accent-hover);
}
.manual-path-toggle {
  align-self: center;
  padding: 0;
  border: none;
  background: none;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.manual-path-toggle:hover {
  color: var(--accent-primary);
}
.manual-path-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}
.path-input-group {
  display: flex;
  gap: var(--space-1);
}
.path-input {
  flex: 1;
  min-width: 0;
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-3);
  font-size: 12px;
  font-family: var(--font-mono);
  outline: none;
  transition: all var(--duration-fast) var(--ease-default);
}
.path-input:focus {
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-glow);
}
.path-input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}
.path-go-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}
.path-go-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}
.path-go-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.path-error {
  font-size: 10px;
  color: var(--error);
  padding: var(--space-1) 0;
  line-height: 1.4;
}

/* ── AI 配置面板 ── */
.connection-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: all var(--duration-fast) var(--ease-default);
}
.connection-status.connected .status-dot {
  background: var(--success);
}
.connection-status.connected {
  color: var(--success);
}
.connection-status.error .status-dot {
  background: var(--error);
}
.connection-status.error {
  color: var(--error);
}
.connection-status.idle {
  color: var(--text-muted);
}

.config-form {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow-y: auto;
  flex: 1;
}
.config-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.config-field label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.temp-val {
  color: var(--accent-primary);
  font-weight: 700;
  font-size: 11px;
}
.config-hint {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 400;
  line-height: 1.4;
  margin-top: var(--space-1);
}
.config-select,
.config-input {
  width: 100%;
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: 12px;
  outline: none;
  transition: all var(--duration-fast) var(--ease-default);
  font-family: var(--font-mono);
}
.config-select:focus,
.config-input:focus {
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-glow);
}
.config-range {
  width: 100%;
  accent-color: var(--accent-primary);
  height: 4px;
}
.config-actions {
  display: flex;
  gap: var(--space-3);
}
.test-btn, .save-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
}
.test-btn {
  background: var(--bg-surface);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}
.test-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}
.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.save-btn {
  background: var(--accent-primary);
  color: #fff;
}
.save-btn:hover {
  background: var(--accent-hover);
}
.save-btn:active {
  transform: scale(0.97);
}
.config-message {
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-line;
}
.config-message.success {
  background: rgba(74, 222, 128, 0.1);
  color: var(--success);
  border: 1px solid rgba(74, 222, 128, 0.2);
}
.config-message.error {
  background: rgba(248, 113, 113, 0.1);
  color: var(--error);
  border: 1px solid rgba(248, 113, 113, 0.2);
}
.mini-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border-subtle);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  display: inline-block;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── 设置面板 ── */
.settings-list {
  padding: var(--space-2) 0;
  flex: 1;
  overflow-y: auto;
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  transition: background var(--duration-fast) var(--ease-default);
}
.setting-row:hover {
  background: var(--bg-hover);
}
.setting-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.setting-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}
.setting-desc {
  font-size: 10px;
  color: var(--text-muted);
}
.toggle-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-default);
  flex-shrink: 0;
}
.toggle-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}
.toggle-btn.dark {
  background: var(--accent-soft);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}
.settings-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: var(--space-2) var(--space-4);
}
.setting-section-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  padding: var(--space-3) var(--space-4) var(--space-2);
}
.about-card {
  margin: var(--space-2) var(--space-4) var(--space-4);
  padding: var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}
.about-brand {
  font-size: 14px;
  font-weight: 700;
  color: var(--accent-primary);
  margin-bottom: var(--space-1);
}
.about-version {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
  margin-bottom: var(--space-3);
}
.about-desc {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* ── 动画 ── */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.fade-enter-from {
  opacity: 0;
  transform: translateX(-6px);
}
.fade-leave-to {
  opacity: 0;
  transform: translateX(6px);
}
</style>