import type { AgentContext, AgentOptions, AgentResult, AgentConfig, ToolCallRecord } from './types'
import { DEFAULT_AGENT_CONFIG } from './types'
import { toolRegistry } from './toolRegistry'
import { contextBuilder } from './contextBuilder'
import * as tools from './tools'
import { aiService } from '@/services/ai'

const FILE_MODIFYING_TOOLS = new Set([
  'write_note', 'create_note', 'append_to_note', 'delete_note', 'move_note'
])

class AgentControllerImpl {
  private initialized = false
  private config: AgentConfig = { ...DEFAULT_AGENT_CONFIG }

  init(): void {
    if (this.initialized) return

    // Register all built-in tools
    for (const [name, tool] of Object.entries(tools)) {
      if (tool && 'name' in tool && 'execute' in tool) {
        toolRegistry.register(tool as any)
      }
    }
    this.initialized = true
  }

  getConfig(): AgentConfig {
    return { ...this.config }
  }

  updateConfig(partial: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...partial }
  }

  async execute(prompt: string, options?: AgentOptions): Promise<AgentResult> {
    if (!this.initialized) this.init()

    const toolCalls: ToolCallRecord[] = []
    const filesModified: string[] = []
    const context = options?.context || await contextBuilder.build()

    // Determine which tools to expose
    const allowedTools = options?.tools
      || (this.config.allowedTools.length > 0 ? this.config.allowedTools : undefined)
    const openAITools = toolRegistry.toOpenAITools(allowedTools)

    const maxSteps = options?.maxSteps ?? this.config.maxSteps

    const messages: any[] = [
      { role: 'system', content: this.buildSystemPrompt(context) },
      { role: 'user', content: prompt }
    ]

    let finalMessage = ''

    try {
      const provider = aiService.getActiveProvider()
      if (!provider) {
        throw new Error('No active AI provider configured')
      }

      let steps = 0

      while (steps < maxSteps) {
        steps++

        // Check for abort signal
        if (options?.signal?.aborted) {
          break
        }

        // Call AI with tools
        const response = await provider.chatWithTools(messages as any, { tools: openAITools })

        // If there's no tool calls, we're done
        if (!response.toolCalls || response.toolCalls.length === 0) {
          finalMessage = response.content || ''
          break
        }

        // Add assistant message with tool calls to history
        messages.push({
          role: 'assistant',
          content: response.content || null,
          tool_calls: response.toolCalls
        })

        // Execute each tool call
        for (const toolCall of response.toolCalls) {
          const tool = toolRegistry.get(toolCall.function.name)
          if (!tool) {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Error: Tool ${toolCall.function.name} not found`
            })
            continue
          }

          // Check if high-risk tool needs confirmation
          if (tool.riskLevel === 'high' && options?.onConfirm) {
            let params: Record<string, unknown>
            try {
              params = JSON.parse(toolCall.function.arguments)
            } catch (e) {
              console.warn('[AgentController] Failed to parse tool call arguments:', e instanceof Error ? e.message : String(e))
              params = {}
            }
            const confirmed = await options.onConfirm(tool.name, params)
            if (!confirmed) {
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: '用户取消了此操作'
              })
              continue
            }
          }

          try {
            const params = JSON.parse(toolCall.function.arguments)
            const result = await tool.execute(params)

            const record: ToolCallRecord = {
              tool: tool.name,
              params,
              result,
              timestamp: Date.now()
            }
            toolCalls.push(record)

            // Notify tool call callback
            options?.onToolCall?.(record)

            // Track files modified by file-modifying tools
            if (FILE_MODIFYING_TOOLS.has(tool.name)) {
              const filePath = this.extractFilePath(tool.name, params)
              if (filePath && !filesModified.includes(filePath)) {
                filesModified.push(filePath)
              }
            }

            // Add tool result to messages
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result.success
                ? (typeof result.data === 'string' ? result.data : JSON.stringify(result.data))
                : `Error: ${result.error}`
            })
          } catch (e) {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Error: ${e instanceof Error ? e.message : String(e)}`
            })
          }
        }
      }

      // If we hit max steps, get a final message
      if (!finalMessage) {
        const finalResponse = await provider.chatWithTools(messages as any)
        finalMessage = finalResponse.content || ''
      }

      // Notify files modified callback
      if (filesModified.length > 0) {
        options?.onFilesModified?.(filesModified)
      }

    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : String(e),
        toolCalls,
        filesModified
      }
    }

    return {
      success: true,
      message: finalMessage,
      toolCalls,
      filesModified
    }
  }

  private extractFilePath(toolName: string, params: Record<string, unknown>): string | null {
    switch (toolName) {
      case 'write_note':
      case 'create_note':
      case 'append_to_note':
      case 'delete_note':
        return typeof params.path === 'string' ? params.path : null
      case 'move_note':
        return typeof params.new_path === 'string' ? params.new_path : null
      default:
        return null
    }
  }

  private buildSystemPrompt(context: AgentContext): string {
    let prompt = `你是一个 AI Native Markdown 助手。你的职责是帮助用户管理 Markdown 笔记、处理知识工作、写作、思考。\n\n`
    if (context.currentFile) {
      prompt += `当前打开的笔记是: ${context.currentFile.path}\n`
      if (context.currentFile.tags.length > 0) {
        prompt += `标签: ${context.currentFile.tags.join(', ')}\n`
      }
      if (context.currentFile.content.length < 1000) {
        prompt += `内容:\n${context.currentFile.content}\n`
      } else {
        prompt += `内容:\n${context.currentFile.content.slice(0, 800)}...\n`
      }
    }

    prompt += `\n最近打开的文件: ${context.recentFiles.slice(0, 5).join(', ')}\n`
    if (context.backlinks.length > 0) {
      prompt += `反向链接: ${context.backlinks.map(b => b.path).join(', ')}\n`
    }

    prompt += `\n你可以使用提供的工具来帮助用户。对于高风险操作（删除、移动文件），请先确认用户意图。`
    return prompt
  }
}

export const agentController = new AgentControllerImpl()
