import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentTool } from '../types'

describe('ToolRegistry', () => {
  let toolRegistry: any

  const mockTool: AgentTool = {
    name: 'test_tool',
    description: 'A test tool',
    parameters: [
      { name: 'param1', type: 'string', description: 'Parameter 1', required: true }
    ],
    riskLevel: 'low',
    execute: vi.fn().mockResolvedValue({ success: true, data: 'test' })
  }

  beforeEach(async () => {
    vi.resetModules()
    const module = await import('../toolRegistry')
    toolRegistry = module.toolRegistry
  })

  it('should register a tool successfully', () => {
    const unregister = toolRegistry.register(mockTool)
    expect(toolRegistry.get('test_tool')).toEqual(mockTool)
    unregister()
  })

  it('should unregister a tool successfully', () => {
    toolRegistry.register(mockTool)
    toolRegistry.unregister('test_tool')
    expect(toolRegistry.get('test_tool')).toBeUndefined()
  })

  it('should return unregister function from register call', () => {
    const unregister = toolRegistry.register(mockTool)
    expect(typeof unregister).toBe('function')
    unregister()
    expect(toolRegistry.get('test_tool')).toBeUndefined()
  })

  it('should get all registered tools', () => {
    const tool1 = { ...mockTool, name: 'tool1' }
    const tool2 = { ...mockTool, name: 'tool2' }
    toolRegistry.register(tool1)
    toolRegistry.register(tool2)
    expect(toolRegistry.getAll()).toEqual(expect.arrayContaining([tool1, tool2]))
  })

  it('should filter tools by name list in getAll', () => {
    const tool1 = { ...mockTool, name: 'tool1' }
    const tool2 = { ...mockTool, name: 'tool2' }
    toolRegistry.register(tool1)
    toolRegistry.register(tool2)
    expect(toolRegistry.getAll(['tool1'])).toEqual([tool1])
  })

  it('should convert tools to OpenAI format', () => {
    const tool: AgentTool = {
      name: 'test_function',
      description: 'Test function description',
      parameters: [
        { name: 'required_param', type: 'string', description: 'Required parameter', required: true },
        { name: 'optional_param', type: 'number', description: 'Optional parameter' },
        { name: 'enum_param', type: 'string', description: 'Parameter with enum', enum: ['a', 'b', 'c'] }
      ],
      riskLevel: 'low',
      execute: vi.fn().mockResolvedValue({ success: true })
    }
    toolRegistry.register(tool)
    const openAITools = toolRegistry.toOpenAITools()
    expect(openAITools).toEqual([{
      type: 'function',
      function: {
        name: 'test_function',
        description: 'Test function description',
        parameters: {
          type: 'object',
          properties: {
            required_param: {
              type: 'string',
              description: 'Required parameter'
            },
            optional_param: {
              type: 'number',
              description: 'Optional parameter'
            },
            enum_param: {
              type: 'string',
              description: 'Parameter with enum',
              enum: ['a', 'b', 'c']
            }
          },
          required: ['required_param']
        }
      }
    }])
  })

  it('should filter OpenAI tools by name list', () => {
    const tool1 = { ...mockTool, name: 'tool1' }
    const tool2 = { ...mockTool, name: 'tool2' }
    toolRegistry.register(tool1)
    toolRegistry.register(tool2)
    const openAITools = toolRegistry.toOpenAITools(['tool2'])
    expect(openAITools.length).toBe(1)
    expect((openAITools[0] as any).function.name).toBe('tool2')
  })

  it('should return undefined when getting a non-existent tool', () => {
    expect(toolRegistry.get('non_existent')).toBeUndefined()
  })

  it('should return empty array when no tools are registered', () => {
    expect(toolRegistry.getAll()).toEqual([])
  })

  it('should return empty array from toOpenAITools when no tools registered', () => {
    expect(toolRegistry.toOpenAITools()).toEqual([])
  })

  it('should overwrite tool when registering with same name', () => {
    const tool1: AgentTool = {
      ...mockTool,
      name: 'same_name',
      description: 'First version'
    }
    const tool2: AgentTool = {
      ...mockTool,
      name: 'same_name',
      description: 'Second version'
    }
    toolRegistry.register(tool1)
    toolRegistry.register(tool2)
    expect(toolRegistry.get('same_name').description).toBe('Second version')
  })

  it('should not include enum field when parameter has no enum', () => {
    const tool: AgentTool = {
      name: 'no_enum_tool',
      description: 'Tool without enum params',
      parameters: [
        { name: 'simple', type: 'string', description: 'No enum here' }
      ],
      riskLevel: 'low',
      execute: vi.fn().mockResolvedValue({ success: true })
    }
    toolRegistry.register(tool)
    const openAITools = toolRegistry.toOpenAITools()
    const props = (openAITools[0] as any).function.parameters.properties
    expect(props.simple).not.toHaveProperty('enum')
  })

  it('should return empty required array when no parameters are required', () => {
    const tool: AgentTool = {
      name: 'all_optional',
      description: 'All optional params',
      parameters: [
        { name: 'opt1', type: 'string', description: 'Optional 1' },
        { name: 'opt2', type: 'number', description: 'Optional 2' }
      ],
      riskLevel: 'low',
      execute: vi.fn().mockResolvedValue({ success: true })
    }
    toolRegistry.register(tool)
    const openAITools = toolRegistry.toOpenAITools()
    expect((openAITools[0] as any).function.parameters.required).toEqual([])
  })

  it('should unregister a non-existent tool without error', () => {
    expect(() => toolRegistry.unregister('non_existent')).not.toThrow()
  })

  it('should return empty array from getAll with non-matching filter', () => {
    toolRegistry.register(mockTool)
    expect(toolRegistry.getAll(['non_existent'])).toEqual([])
  })

  it('should return empty array from toOpenAITools with non-matching filter', () => {
    toolRegistry.register(mockTool)
    expect(toolRegistry.toOpenAITools(['non_existent'])).toEqual([])
  })
})
