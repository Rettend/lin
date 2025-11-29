import type { loadConfig } from 'unconfig'
import type { MockedFunction } from 'vitest'
import type { Config } from '../../src/config'
import process from 'node:process'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as i18nConfigModule from '@/config/i18n'
import * as configIndex from '@/config/index'
import { handleCliError } from '@/utils/general'
import { resolveConfig } from '../../src/config'
import { DEFAULT_I18N_CONFIG } from '../../src/config/i18n'

vi.mock('unconfig')
vi.mock('@/config/i18n')
vi.mock('@/utils/general')

const mockLoadConfig = vi.fn() as MockedFunction<any>
const mockLoadI18nConfig = i18nConfigModule.loadI18nConfig as MockedFunction<typeof i18nConfigModule.loadI18nConfig>
const mockedHandleCliError = handleCliError as MockedFunction<typeof handleCliError>

const unconfig = await import('unconfig')
unconfig.loadConfig = mockLoadConfig as unknown as typeof loadConfig

describe('resolveConfig', () => {
  beforeEach(() => {
    mockedHandleCliError.mockImplementation(() => {
      throw new Error('handleCliError was called')
    })
    mockLoadConfig.mockImplementation(
      (options: any) =>
        Promise.resolve({
          config: {
            ...(options.defaults || {}),
            adapters: {
              json: { directory: 'locales' },
            },
          },
          sources: ['lin.config.js'],
        }),
    )
    mockLoadI18nConfig.mockResolvedValue({
      i18n: DEFAULT_I18N_CONFIG,
      sources: [],
    })
  })

  it('should return default config when no args are provided', async () => {
    const { config } = await resolveConfig({})
    expect(config.cwd).toBe(process.cwd())
    expect(config.debug).toBe(false)
    expect(config.locale).toBe('')
    expect(config.context).toBe('')
    expect(config.i18n.locales).toEqual([])
    expect(config.i18n.defaultLocale).toEqual('en-US')
    expect(config.adapters?.json?.directory).toEqual('locales')
    expect(config.options.provider).toBe('openai')
    expect(config.options.model).toBe('gpt-4o')
    expect(config.options.temperature).toBe(0)
  })

  it('should override default config with provided args', async () => {
    mockLoadI18nConfig.mockResolvedValue({
      i18n: {
        locales: ['hu-HU', 'fr-FR'],
        defaultLocale: 'hu-HU',
      },
      sources: [],
    })

    const { config } = await resolveConfig({
      context: 'Test context',
      options: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-latest',
        temperature: 0.5,
      },
      cwd: '/test/cwd',
    })
    expect(config.locale).toBe('')
    expect(config.i18n.locales).toEqual(['hu-HU', 'fr-FR'])
    expect(config.i18n.defaultLocale).toEqual('hu-HU')
    expect(config.adapters?.json?.directory).toEqual('locales')
    expect(config.context).toBe('Test context')
    expect(config.options.provider).toBe('anthropic')
    expect(config.options.model).toBe('claude-3-5-sonnet-latest')
    expect(config.options.temperature).toBe(0.5)
    expect(config.cwd).toBe('/test/cwd')
  })

  it('should override default config with provided args, including Azure options', async () => {
    mockLoadI18nConfig.mockResolvedValue({
      i18n: {
        locales: ['hu-HU', 'fr-FR'],
        defaultLocale: 'hu-HU',
      },
      sources: [],
    })
    const { config } = await resolveConfig({
      context: 'Test context',
      options: {
        provider: 'azure',
        model: 'grok-3-mini',
        temperature: 0.5,
        apiKey: 'test-azure-key',
        resourceName: 'my-resource',
        baseURL: 'https://custom.azure.com',
        apiVersion: '2025-05-01',
      },
      cwd: '/test/cwd',
    })
    expect(config.locale).toBe('')
    expect(config.i18n.locales).toEqual(['hu-HU', 'fr-FR'])
    expect(config.i18n.defaultLocale).toEqual('hu-HU')
    expect(config.adapters?.json?.directory).toEqual('locales')
    expect(config.context).toBe('Test context')
    expect(config.options.provider).toBe('azure')
    expect(config.options.model).toBe('grok-3-mini')
    expect(config.options.temperature).toBe(0.5)
    expect(config.options.apiKey).toBe('test-azure-key')
    if (config.options.provider === 'azure') {
      const azureOptions = config.options as any
      expect(azureOptions.resourceName).toBe('my-resource')
      expect(azureOptions.baseURL).toBe('https://custom.azure.com')
      expect(azureOptions.apiVersion).toBe('2025-05-01')
    }
    expect(config.cwd).toBe('/test/cwd')
  })

  it('should handle invalid temperature arg', async () => {
    const args = { temperature: 'not-a-number' }
    await expect(resolveConfig(args)).rejects.toThrowError('handleCliError was called')
  })
})

describe('resolveConfig with presets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedHandleCliError.mockImplementation(() => {
      throw new Error('handleCliError was called')
    })
    mockLoadI18nConfig.mockResolvedValue({
      i18n: { locales: ['en-US'], defaultLocale: 'en-US' },
      sources: [],
    })
  })

  it('should use preset options when --model matches a preset name', async () => {
    mockLoadConfig.mockResolvedValue({
      config: {
        presets: {
          'fast-groq': { provider: 'groq', model: 'llama-3.1-8b-instant', temperature: 0 },
        },
        adapters: { json: { directory: 'locales' } },
      },
      sources: ['lin.config.js'],
    })

    const args = { model: 'fast-groq' }
    const { config } = await configIndex.resolveConfig(args)

    expect(config.options.provider).toBe('groq')
    expect(config.options.model).toBe('llama-3.1-8b-instant')
    expect(config.options.temperature).toBe(0)
  })

  it('should allow CLI arguments to override preset options', async () => {
    mockLoadConfig.mockResolvedValue({
      config: {
        presets: {
          'creative-claude': { provider: 'anthropic', model: 'claude-3-5-sonnet-latest', temperature: 0.8 },
        },
        adapters: { json: { directory: 'locales' } },
      },
      sources: ['lin.config.js'],
    })

    const args = { model: 'creative-claude', temperature: '0.2' }
    const { config } = await configIndex.resolveConfig(args)

    expect(config.options.provider).toBe('anthropic')
    expect(config.options.model).toBe('claude-3-5-sonnet-latest')
    expect(config.options.temperature).toBe(0.2)
  })

  it('should handle presets that only modify some properties', async () => {
    mockLoadConfig.mockResolvedValue({
      config: {
        options: { provider: 'openai', model: 'gpt-4o' },
        presets: {
          hot: { temperature: 0.99 },
        },
        adapters: { json: { directory: 'locales' } },
      },
      sources: ['lin.config.js'],
    })

    const args = { model: 'hot' }
    const { config } = await configIndex.resolveConfig(args)

    expect(config.options.provider).toBe('openai')
    expect(config.options.model).toBe('gpt-4o')
    expect(config.options.temperature).toBe(0.99)
  })

  it('should use preset context when provided', async () => {
    const presetContext = 'This is a test context for the preset.'
    mockLoadConfig.mockResolvedValue({
      config: {
        context: 'Default context',
        presets: {
          'context-test': { provider: 'google', model: 'gemini-2.5-flash', context: presetContext },
        },
        adapters: { json: { directory: 'locales' } },
      },
      sources: ['lin.config.js'],
    })

    const args = { model: 'context-test' }
    const { config } = await configIndex.resolveConfig(args)

    expect(config.context).toBe(presetContext)
  })

  it('should fall back to default context if preset does not provide one', async () => {
    mockLoadConfig.mockResolvedValue({
      config: {
        context: 'Default context',
        presets: {
          'no-context': { provider: 'openai', model: 'gpt-4o-mini' },
        },
        adapters: { json: { directory: 'locales' } },
      },
      sources: ['lin.config.js'],
    })

    const args = { model: 'no-context' }
    const { config } = await configIndex.resolveConfig(args)

    expect(config.context).toBe('Default context')
  })

  it('should treat --model as a literal model name if it does not match a preset', async () => {
    mockLoadConfig.mockResolvedValue({
      config: {
        options: { provider: 'openai', model: 'gpt-4o' },
        presets: {
          hot: { temperature: 0.99 },
        },
        adapters: { json: { directory: 'locales' } },
      },
      sources: ['lin.config.js'],
    })

    const args = { model: 'gpt-4o-mini' }
    const { config } = await configIndex.resolveConfig(args)

    expect(config.options.model).toBe('gpt-4o-mini')
    expect(config.options.provider).toBe('openai')
    expect(config.options.temperature).toBe(0)
  })

  it('should correctly merge nested options from defaults, file, preset, and CLI', async () => {
    const fileConfig: Partial<Config> = {
      options: { provider: 'google', model: 'llama-3.1-8b-instant' },
      presets: {
        'semi-hot': { temperature: 0.5, provider: 'anthropic' },
      },
      adapters: { json: { directory: 'locales' } },
    }

    mockLoadConfig.mockResolvedValue({ config: fileConfig, sources: ['lin.config.js'] })

    const args = { model: 'semi-hot', provider: 'groq' }
    const { config } = await configIndex.resolveConfig(args)

    expect(config.options.provider).toBe('groq')
    expect(config.options.model).toBe('llama-3.1-8b-instant')
    expect(config.options.temperature).toBe(0.5)
  })
})

describe('resolveConfig with adapter validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedHandleCliError.mockImplementation(() => {
      throw new Error('handleCliError was called')
    })
    mockLoadI18nConfig.mockResolvedValue({
      i18n: { locales: ['en-US'], defaultLocale: 'en-US' },
      sources: [],
    })
  })

  it('should throw if no adapters are configured and adapter is "all"', async () => {
    mockLoadConfig.mockResolvedValue({
      config: {
        adapters: {}, // No adapters configured
      },
      sources: ['lin.config.js'],
    })

    const args = { adapter: 'all' }
    await expect(configIndex.resolveConfig(args)).rejects.toThrowError('handleCliError was called')
  })

  it('should throw for an invalid adapter name', async () => {
    mockLoadConfig.mockResolvedValue({
      config: {
        adapters: { json: { directory: 'locales' } },
      },
      sources: ['lin.config.js'],
    })

    const args = { adapter: 'invalid-adapter' }
    await expect(configIndex.resolveConfig(args)).rejects.toThrowError('handleCliError was called')
  })

  it('should throw if json adapter is requested but not configured', async () => {
    mockLoadConfig.mockResolvedValue({
      config: {
        adapters: { markdown: { files: ['**/*.md'] } },
      },
      sources: ['lin.config.js'],
    })

    const args = { adapter: 'json' }
    await expect(configIndex.resolveConfig(args)).rejects.toThrowError('handleCliError was called')
  })

  it('should throw if markdown adapter is requested but not configured', async () => {
    mockLoadConfig.mockResolvedValue({
      config: {
        adapters: { json: { directory: 'locales' } },
      },
      sources: ['lin.config.js'],
    })

    const args = { adapter: 'markdown' }
    await expect(configIndex.resolveConfig(args)).rejects.toThrowError('handleCliError was called')
  })

  it('should normalize "md" alias to "markdown" adapter', async () => {
    mockLoadConfig.mockResolvedValue({
      config: {
        adapters: { markdown: { files: ['**/*.md'] } },
      },
      sources: ['lin.config.js'],
    })

    const args = { adapter: 'md' }
    const { config } = await configIndex.resolveConfig(args)
    expect(config.adapter).toEqual(['markdown'])
  })

  it('should normalize "j" alias to "json" adapter', async () => {
    mockLoadConfig.mockResolvedValue({
      config: {
        adapters: { json: { directory: 'locales' } },
      },
      sources: ['lin.config.js'],
    })

    const args = { adapter: 'j' }
    const { config } = await configIndex.resolveConfig(args)
    expect(config.adapter).toEqual(['json'])
  })

  it('should resolve "all" to all configured adapters', async () => {
    mockLoadConfig.mockResolvedValue({
      config: {
        adapters: {
          json: { directory: 'locales' },
          markdown: { files: ['**/*.md'] },
        },
      },
      sources: ['lin.config.js'],
    })

    const args = { adapter: 'all' }
    const { config } = await configIndex.resolveConfig(args)
    expect(config.adapter).toEqual(['json', 'markdown'])
  })

  it('should resolve "all" to only the configured adapters', async () => {
    mockLoadConfig.mockResolvedValue({
      config: {
        adapters: {
          json: { directory: 'locales' },
        },
      },
      sources: ['lin.config.js'],
    })

    const args = { adapter: 'all' }
    const { config } = await configIndex.resolveConfig(args)
    expect(config.adapter).toEqual(['json'])
  })
})
