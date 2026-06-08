import { ref, type Ref } from 'vue'
import { agentController } from '@/services/agent/agentController'
import { contextBuilder } from '@/services/agent/contextBuilder'
import type { ToolCallRecord, AgentConfig } from '@/services/agent/types'
import { DEFAULT_AGENT_CONFIG } from '@/services/agent/types'
import type { AIMessage, ToolCallDisplay } from '@/types'
import { useEditorStore } from '@/stores'

const AGENT_CONFIG_KEY = 'agent_config'

function loadAgentConfig(): AgentConfig {
  try {
    const raw = localStorage.getItem(AGENT_CONFIG_KEY)
    if (!raw) return { ...DEFAULT_AGENT_CONFIG }
    return { ...DEFAULT_AGENT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_AGENT_CONFIG }
  }
}

function saveAgentConfig(config: AgentConfig): void {
  try {
    localStorage.setItem(AGENT_CONFIG_KEY, JSON.stringify(config))
  } catch {
    // ignore storage errors
  }
}

function toToolCallDisplay(record: ToolCallRecord): ToolCallDisplay {
  return {
    tool: record.tool,
    params: record.params,
    result: {
      success: record.result.success,
      display: record.result.display,
      error: record.result.error,
    },
    timestamp: record.timestamp,
  }
}

export function useAgentChat(options?: {
  messages: () => AIMessage[]
  onMessageUpdate: (msg: AIMessage) => void
  onFilesModified?: (files: string[]) => void
}) {
  const agentMode = ref(loadAgentConfig().agentMode)
  const agentConfig = ref<AgentConfig>(loadAgentConfig())
  const isAgentRunning = ref(false)
  let currentAbortController: AbortController | null = null

  const editorStore = useEditorStore()

  function setAgentMode(enabled: boolean): void {
    agentMode.value = enabled
    agentConfig.value.agentMode = enabled
    agentController.updateConfig({ agentMode: enabled })
    saveAgentConfig(agentConfig.value)
  }

  function updateAgentConfig(partial: Partial<AgentConfig>): void {
    agentConfig.value = { ...agentConfig.value, ...partial }
    agentController.updateConfig(partial)
    saveAgentConfig(agentConfig.value)
  }

  function stopAgent(): void {
    if (currentAbortController) {
      currentAbortController.abort()
      currentAbortController = null
    }
    isAgentRunning.value = false
  }

  async function executeAgent(prompt: string): Promise<{
    message: string
    toolCalls: ToolCallDisplay[]
    filesModified: string[]
  } | undefined> {
    if (isAgentRunning.value) return undefined

    isAgentRunning.value = true
    const abortController = new AbortController()
    currentAbortController = abortController

    try {
      // Build context from current editor state
      const currentFile = editorStore.currentFile
      const content = editorStore.content
      const contextOptions = currentFile ? { currentFile: { path: currentFile, content } } : undefined
      const context = await contextBuilder.build(contextOptions)

      const result = await agentController.execute(prompt, {
        context,
        signal: abortController.signal,
        maxSteps: agentConfig.value.maxSteps,
        tools: agentConfig.value.allowedTools.length > 0
          ? agentConfig.value.allowedTools
          : undefined,
        onToolCall: (record: ToolCallRecord) => {
          // Update the assistant message in-place with tool call records
          if (options?.onMessageUpdate) {
            const msgs = options.messages()
            const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant')
            if (lastAssistant) {
              lastAssistant.toolCalls = [
                ...(lastAssistant.toolCalls || []),
                toToolCallDisplay(record),
              ]
              options.onMessageUpdate(lastAssistant)
            }
          }
        },
        onFilesModified: (files: string[]) => {
          // Refresh editor if current file was modified
          refreshEditorForModifiedFiles(files)
          options?.onFilesModified?.(files)
        },
      })

      if (abortController.signal.aborted) {
        return undefined
      }

      return {
        message: result.message,
        toolCalls: result.toolCalls.map(toToolCallDisplay),
        filesModified: result.filesModified,
      }
    } catch (e) {
      return {
        message: `Agent 执行出错: ${e instanceof Error ? e.message : String(e)}`,
        toolCalls: [],
        filesModified: [],
      }
    } finally {
      isAgentRunning.value = false
      currentAbortController = null
    }
  }

  function refreshEditorForModifiedFiles(files: string[]): void {
    const currentPath = editorStore.currentFile
    if (!currentPath) return

    // If the currently open file was modified, reload it
    if (files.includes(currentPath)) {
      // Trigger a re-read by re-opening the file
      const tab = editorStore.getActiveTab()
      if (tab) {
        // Use vaultService to re-read and update the tab content
        import('@/services/vault').then(({ vaultService }) => {
          vaultService.readFile(currentPath).then(content => {
            editorStore.setContentSilent(content)
          }).catch(() => {
            // File may have been deleted
          })
        })
      }
    }
  }

  return {
    agentMode,
    agentConfig,
    isAgentRunning,
    setAgentMode,
    updateAgentConfig,
    executeAgent,
    stopAgent,
  }
}
