import { describe, it, expect, vi, beforeEach } from 'vitest'

// Top-level mocks
const mockChatWithTools = vi.fn()
const mockGetActiveProvider = vi.fn()
const mockToolRegistryGet = vi.fn()
const mockToolRegistryRegister = vi.fn().mockReturnValue(() => {})
const mockContextBuilderBuild = vi.fn()

vi.mock('@/services/ai', () => ({
  aiService: {
    getActiveProvider: mockGetActiveProvider
  }
}))

vi.mock('../toolRegistry', () => ({
  toolRegistry: {
    getAll: vi.fn().mockReturnValue([]),
    toOpenAITools: vi.fn().mockReturnValue([
      {
        type: 'function',
        function: { name: 'listNotes', description: 'List notes', parameters: {} }
      }
    ]),
    register: mockToolRegistryRegister,
    unregister: vi.fn(),
    get: mockToolRegistryGet
  }
}))

vi.mock('../contextBuilder', () => ({
  contextBuilder: {
    build: mockContextBuilderBuild
  }
}))

vi.mock('../tools', () => ({
  listNotesTool: { name: 'listNotes', description: 'List notes', parameters: [], riskLevel: 'low', execute: vi.fn() },
  readNoteTool: { name: 'readNote', description: 'Read note', parameters: [], riskLevel: 'low', execute: vi.fn() },
  writeNoteTool: { name: 'writeNote', description: 'Write note', parameters: [], riskLevel: 'high', execute: vi.fn() },
  searchNotesTool: { name: 'searchNotes', description: 'Search notes', parameters: [], riskLevel: 'low', execute: vi.fn() },
  getBacklinksTool: { name: 'getBacklinks', description: 'Get backlinks', parameters: [], riskLevel: 'low', execute: vi.fn() },
  getTagsTool: { name: 'getTags', description: 'Get tags', parameters: [], riskLevel: 'low', execute: vi.fn() },
  createNoteTool: { name: 'create_note', description: 'Create note', parameters: [], riskLevel: 'low', execute: vi.fn() },
  appendToNoteTool: { name: 'append_to_note', description: 'Append to note', parameters: [], riskLevel: 'low', execute: vi.fn() },
  deleteNoteTool: { name: 'delete_note', description: 'Delete note', parameters: [], riskLevel: 'high', execute: vi.fn() },
  moveNoteTool: { name: 'move_note', description: 'Move note', parameters: [], riskLevel: 'high', execute: vi.fn() }
}))

describe('AgentController', () => {
  let agentController: {
    init: () => void
    execute: (prompt: string, options?: any) => Promise<{
      success: boolean
      message: string
      toolCalls: Array<{ tool: string; params: any; result: any; timestamp: number }>
      filesModified: string[]
    }>
  }

  const mockListNotesTool = {
    name: 'listNotes',
    description: 'List notes',
    parameters: [],
    riskLevel: 'low',
    execute: vi.fn().mockResolvedValue({ success: true, data: ['/test1.md', '/test2.md'] })
  }

  beforeEach(async () => {
    vi.resetModules()

    // Default mock setups
    mockGetActiveProvider.mockReturnValue({
      chatWithTools: mockChatWithTools
    })
    mockToolRegistryGet.mockReturnValue(null)
    mockToolRegistryRegister.mockReturnValue(() => {})
    mockContextBuilderBuild.mockResolvedValue({
      currentFile: null,
      backlinks: [],
      mentions: [],
      recentFiles: []
    })
    mockChatWithTools.mockReset()

    const module = await import('../agentController')
    agentController = module.agentController
  })

  it('should be able to import and instantiate', async () => {
    expect(agentController).toBeDefined()
    expect(agentController.execute).toBeDefined()
  })

  it('should return success result when no tool calls are needed', async () => {
    mockChatWithTools.mockResolvedValue({
      content: 'Hello user!',
      toolCalls: []
    })

    const result = await agentController.execute('Hello')
    expect(result.success).toBe(true)
    expect(result.message).toBe('Hello user!')
    expect(result.toolCalls.length).toBe(0)
  })

  it('should execute tool calls and track them', async () => {
    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'listNotes') return mockListNotesTool
      return null
    })

    // First call returns tool call
    mockChatWithTools.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'listNotes',
            arguments: JSON.stringify({})
          }
        }
      ]
    })
    // Second call returns final message
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Here are your notes: /test1.md, /test2.md',
      toolCalls: []
    })

    const result = await agentController.execute('List all notes')
    expect(result.success).toBe(true)
    expect(result.message).toBe('Here are your notes: /test1.md, /test2.md')
    expect(result.toolCalls.length).toBe(1)
    expect(result.toolCalls[0].tool).toBe('listNotes')
    expect(mockListNotesTool.execute).toHaveBeenCalled()
  })

  it('should handle unknown tool errors gracefully', async () => {
    mockChatWithTools.mockResolvedValue({
      content: '',
      toolCalls: [
        {
          id: 'call_456',
          type: 'function',
          function: {
            name: 'unknownTool',
            arguments: JSON.stringify({})
          }
        }
      ]
    })

    const result = await agentController.execute('Do something unknown')
    expect(result.success).toBe(true)
  })

  it('should track files modified by writeNote', async () => {
    const mockWriteNoteTool = {
      name: 'write_note',
      description: 'Write note',
      parameters: [],
      riskLevel: 'low',
      execute: vi.fn().mockResolvedValue({ success: true, data: 'Written' })
    }

    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'write_note') return mockWriteNoteTool
      return null
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_789',
          type: 'function',
          function: {
            name: 'write_note',
            arguments: JSON.stringify({ path: '/new.md', content: '# New' })
          }
        }
      ]
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: 'Note created!',
      toolCalls: []
    })

    const result = await agentController.execute('Write a note')
    expect(result.filesModified).toContain('/new.md')
  })

  it('should return error when no active AI provider is configured', async () => {
    mockGetActiveProvider.mockReturnValue(null)

    const result = await agentController.execute('Hello')
    expect(result.success).toBe(false)
    expect(result.message).toContain('No active AI provider')
  })

  it('should stop after max steps and get final message', async () => {
    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'listNotes') return mockListNotesTool
      return null
    })

    // Return tool calls for 5 iterations (max steps), then a final message
    const toolCallResponse = {
      content: '',
      toolCalls: [
        {
          id: 'call_loop',
          type: 'function',
          function: {
            name: 'listNotes',
            arguments: JSON.stringify({})
          }
        }
      ]
    }

    // First 5 calls return tool calls (hitting max steps)
    for (let i = 0; i < 5; i++) {
      mockChatWithTools.mockResolvedValueOnce(toolCallResponse)
    }
    // Final call after max steps
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Final answer after max steps',
      toolCalls: []
    })

    const result = await agentController.execute('Loop test')
    expect(result.success).toBe(true)
    expect(result.message).toBe('Final answer after max steps')
    expect(result.toolCalls.length).toBe(5)
  })

  it('should handle tool execution errors gracefully', async () => {
    const errorTool = {
      name: 'errorTool',
      description: 'Error tool',
      parameters: [],
      riskLevel: 'low',
      execute: vi.fn().mockRejectedValue(new Error('Tool execution failed'))
    }

    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'errorTool') return errorTool
      return null
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_err',
          type: 'function',
          function: {
            name: 'errorTool',
            arguments: JSON.stringify({})
          }
        }
      ]
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: 'Handled error gracefully',
      toolCalls: []
    })

    const result = await agentController.execute('Test error')
    expect(result.success).toBe(true)
    expect(result.message).toBe('Handled error gracefully')
  })

  it('should handle invalid JSON in tool call arguments', async () => {
    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'listNotes') return mockListNotesTool
      return null
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_bad_json',
          type: 'function',
          function: {
            name: 'listNotes',
            arguments: 'not valid json{'
          }
        }
      ]
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: 'Recovered from bad JSON',
      toolCalls: []
    })

    const result = await agentController.execute('Test bad JSON')
    expect(result.success).toBe(true)
    expect(result.message).toBe('Recovered from bad JSON')
  })

  it('should use provided context instead of building one', async () => {
    const customContext = {
      currentFile: { path: '/custom.md', content: 'Custom', frontmatter: {}, tags: [] },
      backlinks: [{ path: '/link.md', context: 'ref' }],
      mentions: [],
      recentFiles: ['/custom.md']
    }

    mockChatWithTools.mockResolvedValue({
      content: 'Using custom context',
      toolCalls: []
    })

    mockContextBuilderBuild.mockClear()

    const result = await agentController.execute('Test', { context: customContext })
    expect(result.success).toBe(true)
    // contextBuilder.build should NOT have been called since context was provided
    expect(mockContextBuilderBuild).not.toHaveBeenCalled()
  })

  it('should not duplicate files in filesModified', async () => {
    const mockWriteNoteTool = {
      name: 'write_note',
      description: 'Write note',
      parameters: [],
      riskLevel: 'low',
      execute: vi.fn().mockResolvedValue({ success: true, data: 'Written' })
    }

    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'write_note') return mockWriteNoteTool
      return null
    })

    // Two tool calls writing to the same file
    mockChatWithTools.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_dup1',
          type: 'function',
          function: {
            name: 'write_note',
            arguments: JSON.stringify({ path: '/same.md', content: 'First' })
          }
        },
        {
          id: 'call_dup2',
          type: 'function',
          function: {
            name: 'write_note',
            arguments: JSON.stringify({ path: '/same.md', content: 'Second' })
          }
        }
      ]
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: 'Done',
      toolCalls: []
    })

    const result = await agentController.execute('Write twice')
    expect(result.filesModified.filter(p => p === '/same.md').length).toBe(1)
  })

  it('should handle tool result with error property', async () => {
    const failTool = {
      name: 'failTool',
      description: 'Fail tool',
      parameters: [],
      riskLevel: 'low',
      execute: vi.fn().mockResolvedValue({ success: false, error: 'Something went wrong' })
    }

    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'failTool') return failTool
      return null
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_fail',
          type: 'function',
          function: {
            name: 'failTool',
            arguments: JSON.stringify({})
          }
        }
      ]
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: 'Handled failure',
      toolCalls: []
    })

    const result = await agentController.execute('Test failure')
    expect(result.success).toBe(true)
  })

  it('should handle tool result with object data', async () => {
    const objectDataTool = {
      name: 'objectTool',
      description: 'Object data tool',
      parameters: [],
      riskLevel: 'low',
      execute: vi.fn().mockResolvedValue({ success: true, data: { key: 'value', nested: { a: 1 } } })
    }

    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'objectTool') return objectDataTool
      return null
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_obj',
          type: 'function',
          function: {
            name: 'objectTool',
            arguments: JSON.stringify({})
          }
        }
      ]
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: 'Got object data',
      toolCalls: []
    })

    const result = await agentController.execute('Test object data')
    expect(result.success).toBe(true)
    expect(result.toolCalls[0].result.data).toEqual({ key: 'value', nested: { a: 1 } })
  })

  it('should register built-in tools on init', async () => {
    agentController.init()
    expect(mockToolRegistryRegister).toHaveBeenCalled()
  })

  it('should not register tools again on second init call', async () => {
    agentController.init()
    const callCount = mockToolRegistryRegister.mock.calls.length
    agentController.init()
    expect(mockToolRegistryRegister.mock.calls.length).toBe(callCount)
  })

  it('should return error when aiService throws', async () => {
    mockGetActiveProvider.mockReturnValue({
      chatWithTools: vi.fn().mockRejectedValue(new Error('Network error'))
    })

    const result = await agentController.execute('Hello')
    expect(result.success).toBe(false)
    expect(result.message).toContain('Network error')
  })

  it('should call onToolCall callback when tool is executed', async () => {
    const onToolCall = vi.fn()
    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'listNotes') return mockListNotesTool
      return null
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_cb',
          type: 'function',
          function: { name: 'listNotes', arguments: JSON.stringify({}) }
        }
      ]
    })
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Done',
      toolCalls: []
    })

    await agentController.execute('Test', { onToolCall })
    expect(onToolCall).toHaveBeenCalledTimes(1)
    expect(onToolCall.mock.calls[0][0].tool).toBe('listNotes')
  })

  it('should call onFilesModified callback when files are modified', async () => {
    const onFilesModified = vi.fn()
    const mockCreateNoteTool = {
      name: 'create_note',
      description: 'Create note',
      parameters: [],
      riskLevel: 'low',
      execute: vi.fn().mockResolvedValue({ success: true, data: { path: '/new.md' }, display: 'Created' })
    }

    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'create_note') return mockCreateNoteTool
      return null
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_create',
          type: 'function',
          function: { name: 'create_note', arguments: JSON.stringify({ path: '/new.md', content: '# New' }) }
        }
      ]
    })
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Created!',
      toolCalls: []
    })

    await agentController.execute('Create a note', { onFilesModified })
    expect(onFilesModified).toHaveBeenCalledWith(['/new.md'])
  })

  it('should skip high-risk tool when onConfirm returns false', async () => {
    const onConfirm = vi.fn().mockResolvedValue(false)
    const mockDeleteTool = {
      name: 'delete_note',
      description: 'Delete note',
      parameters: [],
      riskLevel: 'high',
      execute: vi.fn().mockResolvedValue({ success: true, data: { path: '/test.md' } })
    }

    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'delete_note') return mockDeleteTool
      return null
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_del',
          type: 'function',
          function: { name: 'delete_note', arguments: JSON.stringify({ path: '/test.md' }) }
        }
      ]
    })
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Cancelled',
      toolCalls: []
    })

    const result = await agentController.execute('Delete note', { onConfirm })
    expect(onConfirm).toHaveBeenCalledWith('delete_note', { path: '/test.md' })
    expect(mockDeleteTool.execute).not.toHaveBeenCalled()
    expect(result.toolCalls.length).toBe(0)
  })

  it('should execute high-risk tool when onConfirm returns true', async () => {
    const onConfirm = vi.fn().mockResolvedValue(true)
    const mockDeleteTool = {
      name: 'delete_note',
      description: 'Delete note',
      parameters: [],
      riskLevel: 'high',
      execute: vi.fn().mockResolvedValue({ success: true, data: { path: '/test.md' }, display: 'Deleted' })
    }

    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'delete_note') return mockDeleteTool
      return null
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_del2',
          type: 'function',
          function: { name: 'delete_note', arguments: JSON.stringify({ path: '/test.md' }) }
        }
      ]
    })
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Done',
      toolCalls: []
    })

    const result = await agentController.execute('Delete note', { onConfirm })
    expect(mockDeleteTool.execute).toHaveBeenCalled()
    expect(result.toolCalls.length).toBe(1)
  })

  it('should respect custom maxSteps option', async () => {
    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'listNotes') return mockListNotesTool
      return null
    })

    const toolCallResponse = {
      content: '',
      toolCalls: [
        {
          id: 'call_step',
          type: 'function',
          function: { name: 'listNotes', arguments: JSON.stringify({}) }
        }
      ]
    }

    // Only 2 tool call iterations for maxSteps=2
    for (let i = 0; i < 2; i++) {
      mockChatWithTools.mockResolvedValueOnce(toolCallResponse)
    }
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Done with 2 steps',
      toolCalls: []
    })

    const result = await agentController.execute('Test', { maxSteps: 2 })
    expect(result.success).toBe(true)
    expect(result.toolCalls.length).toBe(2)
  })

  it('should track files modified by create_note', async () => {
    const mockCreateNoteTool = {
      name: 'create_note',
      description: 'Create note',
      parameters: [],
      riskLevel: 'low',
      execute: vi.fn().mockResolvedValue({ success: true, data: { path: '/new.md' }, display: 'Created' })
    }

    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'create_note') return mockCreateNoteTool
      return null
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_create2',
          type: 'function',
          function: { name: 'create_note', arguments: JSON.stringify({ path: '/new.md', content: '# New' }) }
        }
      ]
    })
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Created!',
      toolCalls: []
    })

    const result = await agentController.execute('Create a note')
    expect(result.filesModified).toContain('/new.md')
  })

  it('should track files modified by move_note using new_path', async () => {
    const mockMoveTool = {
      name: 'move_note',
      description: 'Move note',
      parameters: [],
      riskLevel: 'high',
      execute: vi.fn().mockResolvedValue({ success: true, data: { oldPath: '/old.md', newPath: '/new.md' }, display: 'Moved' })
    }

    mockToolRegistryGet.mockImplementation((name: string) => {
      if (name === 'move_note') return mockMoveTool
      return null
    })

    mockChatWithTools.mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_move',
          type: 'function',
          function: { name: 'move_note', arguments: JSON.stringify({ old_path: '/old.md', new_path: '/new.md' }) }
        }
      ]
    })
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Moved!',
      toolCalls: []
    })

    const result = await agentController.execute('Move a note')
    expect(result.filesModified).toContain('/new.md')
  })

  it('should support getConfig and updateConfig', async () => {
    const ctrl = agentController as any
    const config = ctrl.getConfig()
    expect(config).toHaveProperty('maxSteps')
    expect(config).toHaveProperty('allowedTools')
    expect(config).toHaveProperty('agentMode')

    ctrl.updateConfig({ maxSteps: 20 })
    const updated = ctrl.getConfig()
    expect(updated.maxSteps).toBe(20)
  })

  it('should stop execution when abort signal is already set', async () => {
    const controller = new AbortController()
    controller.abort()

    mockChatWithTools.mockResolvedValue({
      content: 'Should not reach',
      toolCalls: []
    })

    const result = await agentController.execute('Test', { signal: controller.signal })
    // The loop should break immediately, but finalMessage will be empty
    // so it will call chatWithTools one more time for a final message
    expect(result.success).toBe(true)
  })
})
