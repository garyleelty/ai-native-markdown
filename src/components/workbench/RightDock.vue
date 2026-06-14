<template>
  <aside class="right-dock" aria-label="右侧工作台">
    <header class="right-dock-header">
      <div class="dock-title">
        <el-icon><Tickets /></el-icon>
        <span>文档面板</span>
      </div>
      <el-button
        :icon="Close"
        native-type="button"
        size="small"
        circle
        aria-label="关闭右侧工作台"
        @click="$emit('close')"
      />
    </header>

    <div class="dock-stack">
      <section class="dock-section outline-section">
        <button
          class="dock-section-header"
          type="button"
          :aria-expanded="openSections.outline"
          @click="openSections.outline = !openSections.outline"
        >
          <span class="section-label">
            <el-icon><List /></el-icon>
            大纲
          </span>
          <el-icon class="section-chevron" :class="{ open: openSections.outline }"><ArrowDown /></el-icon>
        </button>
        <div v-show="openSections.outline" class="dock-section-body">
          <OutlinePanel
            :content="editorContent"
            :cursor-line="cursorLine"
            @navigate="line => $emit('navigate', line)"
          />
        </div>
      </section>

      <section class="dock-section properties-section">
        <button
          class="dock-section-header"
          type="button"
          :aria-expanded="openSections.properties"
          @click="openSections.properties = !openSections.properties"
        >
          <span class="section-label">
            <el-icon><Tickets /></el-icon>
            属性
          </span>
          <el-icon class="section-chevron" :class="{ open: openSections.properties }"><ArrowDown /></el-icon>
        </button>
        <div v-show="openSections.properties" class="dock-section-body properties-body">
          <PropertiesPanel
            :content="editorContent"
            :file-path="currentFile || ''"
            embedded
            @content-change="content => $emit('content-change', content)"
          />
        </div>
      </section>

      <section class="dock-section relations-section">
        <button
          class="dock-section-header"
          type="button"
          :aria-expanded="openSections.relations"
          @click="openSections.relations = !openSections.relations"
        >
          <span class="section-label">
            <el-icon><Share /></el-icon>
            关联
          </span>
          <el-icon class="section-chevron" :class="{ open: openSections.relations }"><ArrowDown /></el-icon>
        </button>
        <div v-show="openSections.relations" class="dock-section-body relations-body">
          <RightRelationsPanel
            :current-file="currentFile"
            @reference-select="reference => $emit('reference-select', reference)"
            @wiki-navigate="target => $emit('wiki-navigate', target)"
            @link-mention="payload => $emit('link-mention', payload)"
          />
        </div>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ArrowDown, Close, List, Share, Tickets } from '@element-plus/icons-vue'
import OutlinePanel from '@/components/editor/OutlinePanel.vue'
import PropertiesPanel from '@/components/sidebar/PropertiesPanel.vue'
import RightRelationsPanel from '@/components/workbench/RightRelationsPanel.vue'
import { useSettingsStore } from '@/stores/settings'
import type { KnowledgeReference } from '@/services/knowledgeIndex'

defineProps<{
  currentFile?: string
  editorContent: string
  cursorLine: number
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'navigate', lineNumber: number): void
  (e: 'select', path: string): void
  (e: 'reference-select', reference: KnowledgeReference): void
  (e: 'wiki-navigate', target: string): void
  (e: 'link-mention', payload: { reference: KnowledgeReference; targetTitle: string; targetNames: string[] }): void
  (e: 'content-change', content: string): void
}>()

const settingsStore = useSettingsStore()
const openSections = settingsStore.rightDockSections
</script>

<style scoped>
.right-dock {
  height: 100%;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--obsidian-bg-secondary);
  border-left: 1px solid var(--obsidian-border);
}

.right-dock-header {
  height: 36px;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 8px 0 12px;
  background: var(--obsidian-bg-modifier);
  border-bottom: 1px solid var(--obsidian-border);
}

.dock-title {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--obsidian-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.right-dock-header :deep(.el-button) {
  width: 28px;
  height: 28px;
  border: none !important;
  background: transparent !important;
  color: var(--obsidian-text-faint) !important;
}

.right-dock-header :deep(.el-button:hover) {
  background: var(--obsidian-bg-hover) !important;
  color: var(--obsidian-text-normal) !important;
}

.dock-stack {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dock-section {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--obsidian-border);
}

.outline-section {
  flex: 0 1 28%;
}

.properties-section {
  flex: 0 1 30%;
}

.relations-section {
  flex: 1 1 42%;
  border-bottom: 0;
}

.dock-section-header {
  min-height: 34px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  border: 0;
  border-bottom: 1px solid var(--obsidian-border);
  background: var(--obsidian-bg-secondary);
  color: var(--obsidian-text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.dock-section-header:hover,
.dock-section-header:focus-visible {
  color: var(--obsidian-text-normal);
  background: var(--obsidian-bg-hover);
  outline: none;
}

.section-label {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.section-chevron {
  flex-shrink: 0;
  color: var(--obsidian-text-faint);
  transition: transform var(--duration-fast) var(--ease-default);
}

.section-chevron.open {
  transform: rotate(180deg);
}

.dock-section-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--obsidian-bg-secondary);
}

.properties-body {
  overflow-y: auto;
}

.properties-body :deep(.properties-panel) {
  padding: 10px;
  min-height: 0;
}

</style>
