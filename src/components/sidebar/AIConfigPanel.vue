<template>
  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">AI 配置</span>
      <el-tag :type="connectionStatus === 'connected' ? 'success' : connectionStatus === 'error' ? 'danger' : 'info'" size="small" effect="dark">
        {{ connectionStatusText }}
      </el-tag>
    </div>

    <el-form label-position="top" size="small" class="config-form">
      <el-form-item label="Provider">
        <el-select v-model="selectedProvider" @change="onProviderChange" style="width: 100%">
          <el-option label="Ollama (本地)" value="ollama" />
          <el-option label="OpenAI 兼容" value="openai" />
          <el-option label="DeepSeek" value="deepseek" />
        </el-select>
      </el-form-item>

      <template v-if="selectedProvider === 'ollama'">
        <el-form-item label="服务地址">
          <el-input v-model="ollamaBaseURL" placeholder="http://localhost:11434" @blur="fetchOllamaModels" />
        </el-form-item>
        <el-form-item>
          <template #label>
            模型
            <el-button :icon="Refresh" native-type="button" circle size="small" :loading="loadingModels" aria-label="刷新 Ollama 模型" @click="fetchOllamaModels" style="margin-left: 8px" />
          </template>
          <el-select v-model="model" style="width: 100%" :disabled="ollamaModels.length === 0">
            <el-option v-for="m in ollamaModels" :key="m" :label="m" :value="m" />
          </el-select>
          <div class="config-hint">{{ ollamaModels.length > 0 ? `已安装 ${ollamaModels.length} 个模型` : '未检测到模型' }}</div>
        </el-form-item>
      </template>

      <template v-if="selectedProvider !== 'ollama'">
        <el-form-item label="API Key">
          <el-input v-model="apiKey" type="password" placeholder="sk-..." show-password />
        </el-form-item>
        <el-form-item label="API 地址">
          <el-input v-model="openaiBaseURL" :placeholder="selectedProvider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1'" />
        </el-form-item>
        <el-form-item label="模型">
          <el-input v-model="model" :placeholder="selectedProvider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'" />
        </el-form-item>
      </template>

      <el-form-item :label="`Temperature: ${temperature}`">
        <el-slider v-model="temperature" :min="0" :max="2" :step="0.1" show-stops />
      </el-form-item>

      <el-form-item>
        <el-button native-type="button" @click="testConnection" :loading="testing" style="flex: 1">
          测试连接
        </el-button>
        <el-button type="primary" native-type="button" @click="saveAIConfig" style="flex: 1">
          保存
        </el-button>
      </el-form-item>

      <el-alert v-if="testResult" :title="testResult.message" :type="testResult.type === 'success' ? 'success' : 'error'" show-icon :closable="false" />
      <el-alert v-if="configSaved" title="配置已保存并激活" type="success" show-icon :closable="false" />
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { aiService, configureAIProvider } from '../../services/ai'
import { useSettingsStore } from '@/stores/settings'
import type { AIConfig } from '@/types'

const settingsStore = useSettingsStore()

const selectedProvider = ref<AIConfig['provider']>('ollama')
const apiKey = ref('')
const model = ref('qwen2.5:7b')
const temperature = ref(0.7)
const ollamaBaseURL = ref('http://localhost:11434')
const openaiBaseURL = ref('https://api.openai.com/v1')
const configSaved = ref(false)
const testing = ref(false)
const testResult = ref<{ type: 'success' | 'error'; message: string } | null>(null)
const connectionStatus = ref<'idle' | 'connected' | 'error'>('idle')
const ollamaModels = ref<string[]>([])
const loadingModels = ref(false)
let configSavedTimer: ReturnType<typeof setTimeout> | null = null
let isDisposed = false
let modelLoadVersion = 0
let connectionTestVersion = 0
let modelAbortController: AbortController | null = null
let connectionAbortController: AbortController | null = null

const connectionStatusText = computed(() => {
  const map = { idle: '未连接', connected: '已连接', error: '连接失败' }
  return map[connectionStatus.value]
})

const onProviderChange = () => {
  testResult.value = null
  if (selectedProvider.value === 'ollama') {
    model.value = 'qwen2.5:7b'
    fetchOllamaModels()
  } else if (selectedProvider.value === 'deepseek') {
    model.value = 'deepseek-chat'
    openaiBaseURL.value = 'https://api.deepseek.com/v1'
  } else {
    model.value = 'gpt-4o-mini'
    openaiBaseURL.value = 'https://api.openai.com/v1'
  }
}

const fetchOllamaModels = async () => {
  const loadVersion = ++modelLoadVersion
  modelAbortController?.abort()
  modelAbortController = new AbortController()
  loadingModels.value = true
  try {
    const models = await aiService.listOllamaModels(
      ollamaBaseURL.value || 'http://localhost:11434',
      modelAbortController.signal
    )
    if (isDisposed || loadVersion !== modelLoadVersion) return
    ollamaModels.value = models
    if (models.length > 0 && !models.includes(model.value)) {
      model.value = models[0]
    }
  } catch {
    if (isDisposed || loadVersion !== modelLoadVersion) return
    ollamaModels.value = []
  } finally {
    if (!isDisposed && loadVersion === modelLoadVersion) {
      loadingModels.value = false
      modelAbortController = null
    }
  }
}

const buildAIConfig = (): AIConfig => {
  const config: AIConfig = {
    provider: selectedProvider.value,
    baseURL: selectedProvider.value === 'ollama' ? (ollamaBaseURL.value || 'http://localhost:11434') : (openaiBaseURL.value || 'https://api.openai.com/v1'),
    apiKey: selectedProvider.value === 'ollama' ? '' : apiKey.value,
    model: model.value,
    temperature: temperature.value,
    maxTokens: settingsStore.aiConfig.maxTokens ?? 4096,
    systemPrompt: settingsStore.aiConfig.systemPrompt || '你是一个专业的 Markdown 写作助手。',
  }
  return config
}

const applyAIConfig = () => {
  const config = buildAIConfig()
  configureAIProvider(config)
}

const testConnection = async () => {
  const testVersion = ++connectionTestVersion
  connectionAbortController?.abort()
  connectionAbortController = new AbortController()
  testing.value = true
  testResult.value = null
  try {
    applyAIConfig()
    const provider = aiService.getProvider(selectedProvider.value)
    if (!provider) {
      if (isDisposed || testVersion !== connectionTestVersion) return
      testResult.value = { type: 'error', message: '当前 AI Provider 不可用，请重新保存配置后再试。' }
      return
    }
    const result = await provider.testConnection(connectionAbortController.signal)
    if (isDisposed || testVersion !== connectionTestVersion) return
    if (result.ok) {
      connectionStatus.value = 'connected'
      testResult.value = { type: 'success', message: result.error ? `连接成功（${result.error}）` : '连接成功！' }
    } else {
      connectionStatus.value = 'error'
      testResult.value = { type: 'error', message: result.error || '连接失败' }
    }
  } catch (e: any) {
    if (isDisposed || testVersion !== connectionTestVersion) return
    connectionStatus.value = 'error'
    testResult.value = { type: 'error', message: e?.message || String(e) }
  } finally {
    if (!isDisposed && testVersion === connectionTestVersion) {
      testing.value = false
      connectionAbortController = null
    }
  }
}

const saveAIConfig = async () => {
  applyAIConfig()
  settingsStore.updateAIConfig(buildAIConfig())
  await settingsStore.persistAIConfigNow()
  configSaved.value = true
  if (configSavedTimer) clearTimeout(configSavedTimer)
  configSavedTimer = setTimeout(() => {
    configSaved.value = false
    configSavedTimer = null
  }, 2500)
}

onMounted(() => {
  const savedConfig = settingsStore.aiConfig
  if (savedConfig && savedConfig.provider) {
    selectedProvider.value = savedConfig.provider
    apiKey.value = savedConfig.apiKey || ''
    model.value = savedConfig.model || 'qwen2.5:7b'
    temperature.value = savedConfig.temperature ?? 0.7
    if (savedConfig.provider === 'ollama') {
      ollamaBaseURL.value = savedConfig.baseURL || 'http://localhost:11434'
    } else {
      openaiBaseURL.value = savedConfig.baseURL || 'https://api.openai.com/v1'
    }
  }
  applyAIConfig()
  if (selectedProvider.value === 'ollama') fetchOllamaModels()
})

onUnmounted(() => {
  isDisposed = true
  modelLoadVersion += 1
  connectionTestVersion += 1
  modelAbortController?.abort()
  connectionAbortController?.abort()
  if (configSavedTimer) clearTimeout(configSavedTimer)
})
</script>

<style scoped>
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--obsidian-bg-secondary, #252525);
}

.panel-header {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06));
  flex-shrink: 0;
}

.panel-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--obsidian-text-muted, #999);
  letter-spacing: 0;
  text-transform: uppercase;
}

.config-form {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
}

.config-form :deep(.el-form-item__label) {
  color: var(--obsidian-text-muted, #999) !important;
  font-size: 11px;
  font-weight: 600;
}

.config-form :deep(.el-input__wrapper) {
  background: var(--obsidian-bg-primary, #1e1e1e) !important;
  box-shadow: none !important;
  border: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06)) !important;
  border-radius: 4px;
}

.config-form :deep(.el-input__wrapper:hover) {
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.config-form :deep(.el-input__wrapper.is-focus) {
  border-color: var(--obsidian-accent, #7f6df2) !important;
}

.config-form :deep(.el-input__inner) {
  color: var(--obsidian-text-normal, #dcddde) !important;
}

.config-form :deep(.el-input__inner::placeholder) {
  color: var(--obsidian-text-faint, #666) !important;
}

.config-form :deep(.el-select .el-input__wrapper) {
  background: var(--obsidian-bg-primary, #1e1e1e) !important;
}

.config-form :deep(.el-slider__runway) {
  background: var(--obsidian-bg-primary, #1e1e1e) !important;
}

.config-form :deep(.el-slider__bar) {
  background: var(--obsidian-accent, #7f6df2) !important;
}

.config-form :deep(.el-slider__button) {
  border-color: var(--obsidian-accent, #7f6df2) !important;
}

.config-form :deep(.el-button--primary) {
  background: var(--obsidian-accent, #7f6df2) !important;
  border-color: var(--obsidian-accent, #7f6df2) !important;
}

.config-form :deep(.el-button--default) {
  background: var(--obsidian-bg-hover, #303030) !important;
  border-color: var(--obsidian-border, rgba(255, 255, 255, 0.06)) !important;
  color: var(--obsidian-text-normal, #dcddde) !important;
}

.config-form :deep(.el-button--default:hover) {
  background: var(--obsidian-bg-active, #363636) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.config-hint {
  font-size: 10px;
  color: var(--obsidian-text-faint, #666);
  margin-top: 3px;
}
</style>
