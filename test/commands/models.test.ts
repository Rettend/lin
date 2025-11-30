import type { MockedFunction } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import modelsCommand from '@/commands/models'
import * as configModule from '@/config'
import * as consoleModule from '@/utils/console'
import { ICONS } from '@/utils/console'
import * as generalUtils from '@/utils/general'
import * as llmUtils from '@/utils/llm'

vi.mock('@/utils/console', async () => {
  const actual = await vi.importActual('@/utils/console')
  return {
    ...actual,
    console: {
      log: vi.fn(),
      logL: vi.fn(),
      error: vi.fn(),
    },
  }
})

vi.mock('@/utils/general')
vi.mock('@/utils/llm')
vi.mock('@/config')
vi.mock('picocolors', () => ({
  default: {
    magenta: (str: string) => str,
    cyan: (str: string) => str,
    green: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
    blue: (str: string) => str,
    dim: (str: string) => str,
    bold: (str: string) => str,
    italic: (str: string) => str,
    underline: (str: string) => str,
  },
}))

const mockModels = [
  { provider: 'openai', value: 'gpt-1', alias: 'GPT-1', iq: 5, speed: 5 },
  { provider: 'openai', value: 'gpt-1-mini', alias: 'GPT-1 Mini', iq: 4, speed: 5 },
  { provider: 'google', value: 'gemini-1-pro', alias: 'Gemini 1 Pro', iq: 5, speed: 4 },
]

const mockRegistry = {
  searchModels: vi.fn().mockResolvedValue({ data: mockModels }),
  clearCache: vi.fn().mockResolvedValue(undefined),
}

describe('models command', () => {
  let mockConsoleLog: MockedFunction<any>
  let mockConsoleLogL: MockedFunction<any>
  let mockHandleCliError: MockedFunction<typeof generalUtils.handleCliError>
  let mockGetRegistry: MockedFunction<typeof llmUtils.getRegistry>
  let mockResolveConfig: MockedFunction<typeof configModule.resolveConfig>

  beforeEach(() => {
    vi.clearAllMocks()
    mockConsoleLog = consoleModule.console.log as MockedFunction<typeof consoleModule.console.log>
    mockConsoleLogL = consoleModule.console.logL as MockedFunction<typeof consoleModule.console.logL>
    mockHandleCliError = generalUtils.handleCliError as MockedFunction<typeof generalUtils.handleCliError>
    mockGetRegistry = llmUtils.getRegistry as MockedFunction<typeof llmUtils.getRegistry>
    mockResolveConfig = configModule.resolveConfig as MockedFunction<typeof configModule.resolveConfig>

    mockHandleCliError.mockImplementation((message, details) => {
      throw new Error(`${message} ${details ? JSON.stringify(details) : ''}`.trim())
    })

    mockGetRegistry.mockReturnValue(mockRegistry as any)
    mockResolveConfig.mockResolvedValue({
      config: {
        registry: {
          status: ['latest', 'preview'],
        },
      },
    } as any)
  })

  const baseArgsToRun = {
    _: [],
  }

  it('should show all models when no provider is specified', async () => {
    await modelsCommand.run?.({
      args: { ...baseArgsToRun } as any,
      rawArgs: [],
      cmd: modelsCommand.meta as any,
    })

    expect(mockGetRegistry).toHaveBeenCalled()
    expect(mockRegistry.searchModels).toHaveBeenCalledWith({
      provider: undefined,
      status: ['latest', 'preview'],
    })

    expect(mockConsoleLog).toHaveBeenCalledWith('`Available Models:`                   IQ      Speed ')
    expect(mockConsoleLog).toHaveBeenCalledWith('  `openai`')
    expect(mockConsoleLog).toHaveBeenCalledWith('    - **GPT-1**: gpt-1                ●●●●● 5  ●●●●● 5')
    expect(mockConsoleLog).toHaveBeenCalledWith('    - **GPT-1 Mini**: gpt-1-mini      ●●●●○ 4  ●●●●● 5')
    expect(mockConsoleLog).toHaveBeenCalledWith('  `google`')
    expect(mockConsoleLog).toHaveBeenCalledWith('    - **Gemini 1 Pro**: gemini-1-pro  ●●●●● 5  ●●●●○ 4')
  })

  it('should show models for a single specified provider', async () => {
    const provider = 'openai'
    await modelsCommand.run?.({
      args: { ...baseArgsToRun, provider } as any,
      rawArgs: [],
      cmd: modelsCommand.meta as any,
    })

    expect(mockRegistry.searchModels).toHaveBeenCalledWith({
      provider: ['openai'],
      status: ['latest', 'preview'],
    })
  })

  it('should clear cache when --clear-cache is passed', async () => {
    await modelsCommand.run?.({
      args: { ...baseArgsToRun, 'clear-cache': true } as any,
      rawArgs: [],
      cmd: modelsCommand.meta as any,
    })

    expect(mockRegistry.clearCache).toHaveBeenCalled()
    expect(mockConsoleLogL).toHaveBeenCalledWith(ICONS.result, 'LLM registry cache cleared.')
    expect(mockRegistry.searchModels).not.toHaveBeenCalled()
  })

  it('should show warning when no models found', async () => {
    mockRegistry.searchModels.mockResolvedValueOnce({ data: [] })

    await modelsCommand.run?.({
      args: { ...baseArgsToRun } as any,
      rawArgs: [],
      cmd: modelsCommand.meta as any,
    })

    expect(mockConsoleLogL).toHaveBeenCalledWith(ICONS.warning, 'No models found.')
  })
})
