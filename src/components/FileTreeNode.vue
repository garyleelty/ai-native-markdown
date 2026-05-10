<template>
  <div class="file-tree-node">
    <!-- 文件夹节点 -->
    <div
      v-if="node.isDirectory"
      class="tree-item folder"
      :class="{ expanded: node.isExpanded, active: isActive }"
      @click="handleFolderClick"
      @contextmenu.prevent="showContextMenu($event, node)"
    >
      <svg
        class="chevron"
        :class="{ open: node.isExpanded }"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent-peach)"
        stroke-width="2"
      >
        <path
          d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
        />
      </svg>
      <!-- 重命名/新建输入框 -->
      <input
        v-if="node.isEditing"
        ref="editInput"
        v-model="editValue"
        class="tree-edit-input"
        :placeholder="node.isNew ? (node.children ? '新文件夹名' : '新文件名.md') : ''"
        @keydown.enter="confirmEdit"
        @keydown.esc="cancelEdit"
        @blur="confirmEdit"
        @click.stop
      />
      <span v-else class="item-name folder-name">{{ node.name }}</span>
    </div>

    <!-- 文件节点 -->
    <div
      v-else
      class="tree-item file"
      :class="{ active: isActive }"
      @click="handleFileClick"
      @contextmenu.prevent="showContextMenu($event, node)"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        :stroke="node.isMarkdown ? 'var(--accent-blue)' : 'var(--text-muted)'"
        stroke-width="2"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <!-- 重命名/新建输入框 -->
      <input
        v-if="node.isEditing"
        ref="editInput"
        v-model="editValue"
        class="tree-edit-input"
        :placeholder="node.isNew ? '新文件名.md' : ''"
        @keydown.enter="confirmEdit"
        @keydown.esc="cancelEdit"
        @blur="confirmEdit"
        @click.stop
      />
      <span v-else class="item-name">{{ node.name }}</span>
    </div>

    <!-- 错误提示 -->
    <div v-if="node.error" class="tree-error">{{ node.error }}</div>

    <!-- 子节点 -->
    <div v-if="node.isDirectory && node.isExpanded && node.children" class="tree-children">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :current-file-path="currentFilePath"
        @select="$emit('select', $event)"
        @toggle="$emit('toggle', $event)"
        @create="$emit('create', $event)"
        @rename="$emit('rename', $event)"
        @delete="$emit('delete', $event)"
        @cancel-edit="$emit('cancel-edit', $event)"
      />
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenuVisible"
        class="context-menu"
        :style="{ left: contextMenuX + 'px', top: contextMenuMenuY + 'px' }"
        @click.stop
      >
        <div class="context-menu-item" @click="handleRename">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          重命名
        </div>
        <div class="context-menu-item delete" @click="handleDelete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          删除
        </div>
        <!-- 仅在文件夹节点上显示新建选项 -->
        <template v-if="node.isDirectory">
          <div class="context-menu-divider" />
          <div class="context-menu-item" @click="handleCreateFile">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            新建文件
          </div>
          <div class="context-menu-item" @click="handleCreateFolder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            新建文件夹
          </div>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import type { TreeNode } from '@/types'

const props = defineProps<{
  node: TreeNode
  currentFilePath: string
}>()

const emit = defineEmits<{
  (e: 'select', path: string): void
  (e: 'toggle', path: string): void
  (e: 'create', payload: { parentPath: string; name: string; isDirectory: boolean }): void
  (e: 'rename', payload: { oldPath: string; newPath: string }): void
  (e: 'delete', path: string): void
  (e: 'cancel-edit', path: string): void
}>()

const isActive = computed(() => props.node.path === props.currentFilePath)
const editInput = ref<HTMLInputElement | null>(null)
const editValue = ref('')

// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuMenuY = ref(0)

// 初始化编辑值
watch(
  () => props.node.isEditing,
  (editing) => {
    if (editing) {
      editValue.value = props.node.isNew ? '' : props.node.name
      nextTick(() => {
        editInput.value?.focus()
        if (!props.node.isNew) {
          editInput.value?.select()
        }
      })
    }
  },
  { immediate: true }
)

const handleFolderClick = () => {
  if (props.node.isEditing) return
  emit('toggle', props.node.path)
}

const handleFileClick = () => {
  if (props.node.isEditing) return
  emit('select', props.node.path)
}

const confirmEdit = () => {
  const value = editValue.value.trim()
  if (!value) {
    if (props.node.isNew) {
      emit('cancel-edit', props.node.path)
    }
    return
  }

  if (props.node.isNew) {
    // 新建操作 - 从临时路径中提取真正的父目录路径
    // 临时节点的 path 格式: ${parentPath}/__new__${timestamp}
    const tempPath = props.node.path
    const isDir = props.node.isDirectory
    let parentPath = tempPath
    
    // 如果是临时新建节点（path 包含 __new__），提取父目录
    if (tempPath.includes('/__new__')) {
      parentPath = tempPath.substring(0, tempPath.lastIndexOf('/__new__'))
    } else {
      // 兜底：取最后一个 / 之前的部分
      parentPath = tempPath.substring(0, tempPath.lastIndexOf('/')) || tempPath
    }
    
    const name = isDir ? value : (value.endsWith('.md') || value.endsWith('.markdown') ? value : value + '.md')
    emit('create', { parentPath, name, isDirectory: isDir })
  } else {
    // 重命名操作
    if (value === props.node.name) return
    const parentPath = props.node.path.substring(0, props.node.path.lastIndexOf('/'))
    const newPath = parentPath + '/' + value
    emit('rename', { oldPath: props.node.path, newPath })
  }
}

const cancelEdit = () => {
  if (props.node.isNew) {
    emit('cancel-edit', props.node.path)
  } else {
    editValue.value = props.node.name
  }
}

// 右键菜单
const showContextMenu = (event: MouseEvent, node: TreeNode) => {
  if (node.isEditing) return
  contextMenuX.value = event.clientX
  contextMenuMenuY.value = event.clientY
  contextMenuVisible.value = true
}

const hideContextMenu = () => {
  contextMenuVisible.value = false
}

const handleRename = () => {
  hideContextMenu()
  props.node.isEditing = true
  props.node.editValue = props.node.name
  editValue.value = props.node.name
  nextTick(() => editInput.value?.focus())
}

const handleDelete = () => {
  hideContextMenu()
  const itemType = props.node.isDirectory ? '文件夹' : '文件'
  if (confirm(`确定要删除${itemType} "${props.node.name}" 吗？`)) {
    emit('delete', props.node.path)
  }
}

const handleCreateFile = () => {
  hideContextMenu()
  // 防御性检查：仅允许在文件夹下创建文件
  if (!props.node.isDirectory) {
    console.warn('⚠️ 不能在文件节点下创建子项')
    return
  }
  emit('create', { parentPath: props.node.path, name: '', isDirectory: false })
}

const handleCreateFolder = () => {
  hideContextMenu()
  // 防御性检查：仅允许在文件夹下创建文件夹
  if (!props.node.isDirectory) {
    console.warn('⚠️ 不能在文件节点下创建子项')
    return
  }
  emit('create', { parentPath: props.node.path, name: '', isDirectory: true })
}

// 点击外部关闭右键菜单
onMounted(() => {
  document.addEventListener('click', hideContextMenu)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideContextMenu()
  })
})

onUnmounted(() => {
  document.removeEventListener('click', hideContextMenu)
})
</script>

<style scoped>
.file-tree-node {
  position: relative;
}

.tree-item {
  padding: 5px 8px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  user-select: none;
  position: relative;
  margin-bottom: 1px;
}

.tree-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2.5px;
  height: 0;
  background: linear-gradient(180deg, var(--accent), var(--accent-mauve));
  border-radius: 0 3px 3px 0;
  transition: all var(--transition-fast);
  opacity: 0;
}

.tree-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tree-item:hover::before {
  height: 55%;
  opacity: 1;
}

.tree-item.active {
  background: linear-gradient(135deg, var(--accent-soft), transparent);
  color: var(--accent);
}

.tree-item.active::before {
  height: 60%;
  opacity: 1;
}

.tree-item.folder {
  font-weight: 500;
}

.tree-item.folder.expanded {
  color: var(--text-primary);
}

.chevron {
  flex-shrink: 0;
  transition: transform var(--transition-smooth);
  color: var(--text-muted);
  opacity: 0.5;
}

.chevron.open {
  transform: rotate(90deg);
  color: var(--accent);
  opacity: 1;
}

.item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.folder-name {
  font-weight: 600;
  color: var(--text-primary);
}

/* 编辑输入框 */
.tree-edit-input {
  flex: 1;
  min-width: 0;
  background: var(--bg-surface0);
  color: var(--text-primary);
  border: 1.5px solid var(--accent);
  border-radius: var(--radius-xs);
  padding: 3px 6px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-soft);
  animation: editPulse 0.3s ease;
}

@keyframes editPulse {
  from {
    box-shadow: 0 0 0 0 var(--accent-soft);
  }
  to {
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
}

.tree-edit-input::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}

/* 错误提示 */
.tree-error {
  padding: 2px 8px 4px 28px;
  font-size: 11px;
  color: var(--accent-red);
  animation: shake 0.3s ease;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-3px);
  }
  75% {
    transform: translateX(3px);
  }
}

/* 子节点缩进 */
.tree-children {
  padding-left: 12px;
  position: relative;
}

.tree-children::before {
  content: '';
  position: absolute;
  left: 14px;
  top: 0;
  bottom: 4px;
  width: 1px;
  background: linear-gradient(180deg, var(--border-subtle), transparent);
  opacity: 0.4;
}

/* 右键菜单 */
:global(.context-menu) {
  position: fixed;
  z-index: 9999;
  background: var(--bg-surface0);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 4px;
  min-width: 160px;
  box-shadow: 0 8px 24px var(--shadow-sm), 0 2px 8px var(--shadow-xs);
  animation: menuAppear 0.15s ease;
  backdrop-filter: blur(12px);
}

@keyframes menuAppear {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

:global(.context-menu-item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: var(--radius-xs);
  font-size: 12.5px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

:global(.context-menu-item:hover) {
  background: var(--accent-soft);
  color: var(--accent);
}

:global(.context-menu-item.delete) {
  color: var(--accent-red);
}

:global(.context-menu-item.delete:hover) {
  background: rgba(239, 68, 68, 0.1);
  color: var(--accent-red);
}

:global(.context-menu-item svg) {
  flex-shrink: 0;
  opacity: 0.7;
}

:global(.context-menu-divider) {
  height: 1px;
  background: var(--border-subtle);
  margin: 4px 0;
}
</style>
