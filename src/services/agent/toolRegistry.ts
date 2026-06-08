import type { AgentTool } from './types'

class ToolRegistryImpl {
  private tools = new Map<string, AgentTool>()

  register(tool: AgentTool): () => void {
    this.tools.set(tool.name, tool)
    return () => this.tools.delete(tool.name)
  }

  unregister(name: string): void {
    this.tools.delete(name)
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name)
  }

  getAll(toolNames?: string[]): AgentTool[] {
    const all = [...this.tools.values()]
    if (toolNames) return all.filter(t => toolNames.includes(t.name))
    return all
  }

  toOpenAITools(toolNames?: string[]): object[] {
    return this.getAll(toolNames).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            tool.parameters.map(p => [p.name, {
              type: p.type,
              description: p.description,
              ...(p.enum ? { enum: p.enum } : {})
            }])
          ),
          required: tool.parameters.filter(p => p.required).map(p => p.name)
        }
      }
    }))
  }
}

export const toolRegistry = new ToolRegistryImpl()
