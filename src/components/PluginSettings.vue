<template>
  <div class="plugin-settings">
    <div class="plugin-settings-header">
      <h3>插件管理</h3>
      <el-text type="info" size="small">启用或禁用功能插件</el-text>
    </div>
    <div class="plugin-list">
      <div
        v-for="info in plugins"
        :key="info.plugin.id"
        class="plugin-item"
        :class="{ 'is-active': info.state === 'active', 'is-error': info.state === 'error' }"
      >
        <div class="plugin-item-header">
          <div class="plugin-info">
            <span class="plugin-name">{{ info.plugin.name }}</span>
            <el-tag size="small" :type="stateTagType(info.state)">{{ stateLabel(info.state) }}</el-tag>
          </div>
          <el-switch
            :model-value="info.state === 'active'"
            :disabled="info.state === 'activating' || info.state === 'deactivating'"
            @change="() => handleToggle(info.plugin.id)"
          />
        </div>
        <div class="plugin-description">{{ info.plugin.description }}</div>
        <div v-if="info.error" class="plugin-error">
          <el-text type="danger" size="small">{{ info.error }}</el-text>
        </div>
        <div v-if="info.plugin.version" class="plugin-version">v{{ info.plugin.version }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { pluginManager } from '@/plugin-system'
import type { PluginState } from '@/plugin-system'

const plugins = computed(() => pluginManager.getAllPlugins())

const stateTagType = (state: PluginState) => {
  switch (state) {
    case 'active': return 'success'
    case 'error': return 'danger'
    case 'activating':
    case 'deactivating': return 'warning'
    default: return 'info'
  }
}

const stateLabel = (state: PluginState) => {
  switch (state) {
    case 'active': return '已启用'
    case 'inactive': return '已禁用'
    case 'error': return '错误'
    case 'activating': return '启用中...'
    case 'deactivating': return '禁用中...'
    default: return '已注册'
  }
}

const handleToggle = async (pluginId: string) => {
  await pluginManager.togglePlugin(pluginId)
}
</script>

<style scoped>
.plugin-settings {
  padding: 12px;
}

.plugin-settings-header {
  margin-bottom: 16px;
}

.plugin-settings-header h3 {
  margin: 0 0 4px 0;
  font-size: 15px;
  color: var(--obsidian-text-normal);
}

.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plugin-item {
  padding: 12px;
  border-radius: 6px;
  background: var(--obsidian-bg-secondary);
  border: 1px solid var(--obsidian-border);
  transition: border-color 0.2s;
}

.plugin-item.is-active {
  border-color: var(--obsidian-accent, #7c3aed);
}

.plugin-item.is-error {
  border-color: var(--el-color-danger);
}

.plugin-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.plugin-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plugin-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--obsidian-text-normal);
}

.plugin-description {
  font-size: 12px;
  color: var(--obsidian-text-muted);
  line-height: 1.4;
}

.plugin-error {
  margin-top: 6px;
}

.plugin-version {
  margin-top: 4px;
  font-size: 11px;
  color: var(--obsidian-text-faint);
}
</style>
