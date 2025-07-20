import type { confirm as confirmFnType } from '@clack/prompts'
import type { MockedFunction } from 'vitest'
import type { Config, Provider } from '@/config'
import type { I18nConfig } from '@/config/i18n'
import type { DeepRequired } from '@/types'
import type { LocaleJson } from '@/utils/locale'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deletionGuard, jsonExtractionMiddleware, sanitizeJsonString, translateKeys } from '@/utils/llm'

const mockLanguageModelFn = vi.fn().mockReturnValue({})
const mockProviderClient = { languageModel: mockLanguageModelFn }

const mockCreateOpenAI = vi.fn((_options?: any) => mockProviderClient)
const mockCreateAnthropic = vi.fn((_options?: any) => mockProviderClient)
const mockCreateGoogleGenerativeAI = vi.fn((_options?: any) => mockProviderClient)
const mockCreateXai = vi.fn((_options?: any) => mockProviderClient)
const mockCreateMistral = vi.fn((_options?: any) => mockProviderClient)
const mockCreateGroq = vi.fn((_options?: any) => mockProviderClient)
const mockCreateCerebras = vi.fn((_options?: any) => mockProviderClient)
const mockCreateAzure = vi.fn((_options?: any) => mockProviderClient)
const mockGenerateObject = vi.fn()

vi.mock('@/utils/console', () => ({
  console: {
    logL: vi.fn(),
    log: vi.fn(),
    loading: vi.fn((_message, callback) => callback()),
  },
  formatLog: vi.fn(str => str),
  ICONS: { result: '>.. ', warning: '⚠', error: '✗', info: 'ℹ' },
}))

vi.mock('@clack/prompts', async () => {
  const actual = await vi.importActual('@clack/prompts')
  return {
    ...actual,
    confirm: vi.fn(),
  }
})

vi.mock('@ai-sdk/openai', () => ({ createOpenAI: (options?: any) => mockCreateOpenAI(options) }))
vi.mock('@ai-sdk/anthropic', () => ({ createAnthropic: (options?: any) => mockCreateAnthropic(options) }))
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: (options?: any) => mockCreateGoogleGenerativeAI(options) }))
vi.mock('@ai-sdk/xai', () => ({ createXai: (options?: any) => mockCreateXai(options) }))
vi.mock('@ai-sdk/mistral', () => ({ createMistral: (options?: any) => mockCreateMistral(options) }))
vi.mock('@ai-sdk/groq', () => ({ createGroq: (options?: any) => mockCreateGroq(options) }))
vi.mock('@ai-sdk/cerebras', () => ({ createCerebras: (options?: any) => mockCreateCerebras(options) }))
vi.mock('@ai-sdk/azure', () => ({ createAzure: (options?: any) => mockCreateAzure(options) }))
vi.mock('ai', async () => {
  const actual = await vi.importActual('ai')
  return {
    ...actual,
    generateObject: (...args: any[]) => mockGenerateObject(...args),
    zodSchema: actual.zodSchema,
    wrapLanguageModel: actual.wrapLanguageModel,
  }
})
vi.mock('@/utils/general', async () => {
  const { customMockHandleCliError } = await import('../mocks/general.mock')
  return {
    handleCliError: customMockHandleCliError,
  }
})

const { MOCKED_CLI_ERROR_MESSAGE } = await import('../mocks/general.mock')
const { console: mockConsole, ICONS: mockICONS, formatLog: mockFormatLog } = await import('@/utils/console')
const { confirm: clackConfirm } = await import('@clack/prompts')
const mockConfirm = clackConfirm as MockedFunction<typeof confirmFnType>
const { handleCliError: mockHandleCliError } = await import('@/utils/general')

describe('llm utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateOpenAI.mockReturnValue({ languageModel: mockLanguageModelFn })
    mockCreateAnthropic.mockReturnValue({ languageModel: mockLanguageModelFn })
    mockCreateGoogleGenerativeAI.mockReturnValue({ languageModel: mockLanguageModelFn })
    mockCreateXai.mockReturnValue({ languageModel: mockLanguageModelFn })
    mockCreateMistral.mockReturnValue({ languageModel: mockLanguageModelFn })
    mockCreateGroq.mockReturnValue({ languageModel: mockLanguageModelFn })
    mockCreateCerebras.mockReturnValue({ languageModel: mockLanguageModelFn })
    mockCreateAzure.mockReturnValue({ languageModel: mockLanguageModelFn })
  })

  describe('deletionGuard', () => {
    const keyCountsBefore = { 'en-US': 10, 'es-ES': 8 }
    const locales = ['en-US', 'es-ES']

    it('should return true if no keys are deleted', async () => {
      const keyCountsAfter = { 'en-US': 10, 'es-ES': 8 }
      const result = await deletionGuard(keyCountsBefore, keyCountsAfter, locales)
      expect(result).toBe(true)
      expect(mockConfirm).not.toHaveBeenCalled()
      expect(mockConsole.logL).toHaveBeenCalledWith(mockICONS.result)
      expect(mockConsole.logL).toHaveBeenCalledWith('en-US (0), ')
      expect(mockConsole.logL).toHaveBeenCalledWith('es-ES (0)')
      expect(mockConsole.log).toHaveBeenCalledTimes(1)
    })

    it('should prompt and return true if keys are deleted and user confirms', async () => {
      const keyCountsAfter = { 'en-US': 8, 'es-ES': 7 }
      mockConfirm.mockResolvedValue(true)
      const result = await deletionGuard(keyCountsBefore, keyCountsAfter, locales)
      expect(result).toBe(true)
      expect(mockConfirm).toHaveBeenCalledWith({
        message: mockFormatLog(`${mockICONS.warning} This will remove \`2\` keys from **en-US**, \`1\` keys from **es-ES**. Continue?`),
        initialValue: false,
      })
      expect(mockConsole.logL).toHaveBeenCalledWith('en-US (-2), ')
      expect(mockConsole.logL).toHaveBeenCalledWith('es-ES (-1)')
    })

    it('should prompt and return false if keys are deleted and user cancels', async () => {
      const keyCountsAfter = { 'en-US': 8, 'es-ES': 7 }
      mockConfirm.mockResolvedValue(false)
      const result = await deletionGuard(keyCountsBefore, keyCountsAfter, locales)
      expect(result).toBe(false)
      expect(mockConfirm).toHaveBeenCalled()
    })

    it('should handle single locale deletion', async () => {
      const keyCountsBeforeSingle = { 'en-US': 10 }
      const keyCountsAfterSingle = { 'en-US': 8 }
      const localesSingle = ['en-US']
      mockConfirm.mockResolvedValue(true)

      const result = await deletionGuard(keyCountsBeforeSingle, keyCountsAfterSingle, localesSingle)
      expect(result).toBe(true)
      expect(mockConsole.logL).toHaveBeenCalledWith('en-US (-2)')
      expect(mockConfirm).toHaveBeenCalledWith({
        message: mockFormatLog(`${mockICONS.warning} This will remove \`2\` keys from **en-US**. Continue?`),
        initialValue: false,
      })
    })

    it('should correctly log for multiple locales with deletions and additions', async () => {
      const keyCountsBeforeMulti = { 'en-US': 10, 'es-ES': 8, 'fr-FR': 12 }
      const keyCountsAfterMulti = { 'en-US': 8, 'es-ES': 9, 'fr-FR': 12 }
      const localesMulti = ['en-US', 'es-ES', 'fr-FR']
      mockConfirm.mockResolvedValue(true)

      const result = await deletionGuard(keyCountsBeforeMulti, keyCountsAfterMulti, localesMulti)
      expect(result).toBe(true)
      expect(mockConsole.logL).toHaveBeenCalledWith(mockICONS.result)
      expect(mockConsole.logL).toHaveBeenCalledWith('en-US (-2), ')
      expect(mockConsole.logL).toHaveBeenCalledWith('es-ES (+1), ')
      expect(mockConsole.logL).toHaveBeenCalledWith('fr-FR (0)')
      expect(mockConsole.log).toHaveBeenCalledTimes(1)
      expect(mockConfirm).toHaveBeenCalledWith({
        message: mockFormatLog(`${mockICONS.warning} This will remove \`2\` keys from **en-US**. Continue?`),
        initialValue: false,
      })
    })
  })

  describe('translateKeys', () => {
    const mockConfigBase: DeepRequired<Config> = {
      locale: 'all',
      cwd: '/mock',
      debug: false,
      undo: false,
      adapter: ['json'],
      adapters: {
        json: {
          sort: 'def',
          directory: 'locales',
        },
        markdown: {
          files: ['**/*.md'],
          localesDir: '.lin/markdown',
        },
      },
      context: 'Test context about the project.',
      with: 'none',
      limits: {
        locale: 10,
        key: 50,
        char: 4000,
      },
      integration: '',
      parser: {
        input: ['src/**/*.{js,jsx,ts,tsx,vue,svelte,astro}'],
      },
      i18n: {
        locales: ['en-US', 'es-ES', 'fr-FR'],
        defaultLocale: 'en-US',
      },
      options: {
        provider: 'openai',
        model: 'gpt-4.1-mini',
        apiKey: 'test-api-key',
        temperature: 0.7,
        maxTokens: 150,
        topP: 0.9,
        frequencyPenalty: 0.1,
        presencePenalty: 0.1,
        seed: 12345,
        mode: 'auto',
      },
      presets: {},
    }

    const mockI18n: I18nConfig = {
      locales: ['en-US', 'es-ES', 'fr-FR'],
      defaultLocale: 'en-US',
    }

    const keysToTranslate: Record<string, LocaleJson> = {
      'es-ES': { greeting: 'Hello', farewell: 'Goodbye' },
      'fr-FR': { greeting: 'Hello', farewell: 'Goodbye' },
    }

    const mockTranslatedJson: Record<string, LocaleJson> = {
      'es-ES': { greeting: 'Hola', farewell: 'Adiós' },
      'fr-FR': { greeting: 'Bonjour', farewell: 'Au revoir' },
    }

    beforeEach(() => {
      vi.clearAllMocks()
      mockGenerateObject.mockResolvedValue({ object: mockTranslatedJson })
      mockCreateOpenAI.mockReturnValue({ languageModel: mockLanguageModelFn })
      mockCreateAnthropic.mockReturnValue({ languageModel: mockLanguageModelFn })
      mockCreateGoogleGenerativeAI.mockReturnValue({ languageModel: mockLanguageModelFn })
      mockCreateXai.mockReturnValue({ languageModel: mockLanguageModelFn })
      mockCreateMistral.mockReturnValue({ languageModel: mockLanguageModelFn })
      mockCreateGroq.mockReturnValue({ languageModel: mockLanguageModelFn })
      mockCreateCerebras.mockReturnValue({ languageModel: mockLanguageModelFn })
      mockCreateAzure.mockReturnValue({ languageModel: mockLanguageModelFn })
    })

    it('should correctly call generateObject and return translations for OpenAI', async () => {
      const result = await translateKeys(keysToTranslate, mockConfigBase, mockI18n, undefined)

      expect(result).toEqual(mockTranslatedJson)
      expect(mockCreateOpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' })
      expect(mockLanguageModelFn).toHaveBeenCalledWith('gpt-4.1-mini')
      expect(mockGenerateObject).toHaveBeenCalledTimes(2)
      const generateObjectCall = mockGenerateObject.mock.calls[0][0]
      expect(generateObjectCall.model).toEqual({})
      expect(generateObjectCall.schema).toBeDefined()
      expect(generateObjectCall.system).toContain('Example input')
      expect(generateObjectCall.system).toContain(`default locale (${mockI18n.defaultLocale})`)
      expect(generateObjectCall.system).toContain(mockConfigBase.context)
      expect(generateObjectCall.prompt).toBe(JSON.stringify({ 'es-ES': { greeting: 'Hello', farewell: 'Goodbye' } }))
      expect(generateObjectCall.temperature).toBe(mockConfigBase.options.temperature)
      expect(generateObjectCall.maxTokens).toBe(mockConfigBase.options.maxTokens)
      expect(generateObjectCall.topP).toBe(mockConfigBase.options.topP)
      expect(generateObjectCall.frequencyPenalty).toBe(mockConfigBase.options.frequencyPenalty)
      expect(generateObjectCall.presencePenalty).toBe(mockConfigBase.options.presencePenalty)
      expect(generateObjectCall.seed).toBe(mockConfigBase.options.seed)
      expect(generateObjectCall.mode).toBe('auto')
    })

    it('should include withLocaleJsons in system prompt if provided', async () => {
      const withLocaleJsons = { 'ja-JP': { common: { yes: 'はい' } } }
      await translateKeys(keysToTranslate, mockConfigBase, mockI18n, withLocaleJsons)

      expect(mockGenerateObject).toHaveBeenCalledTimes(2)
      const generateObjectCall = mockGenerateObject.mock.calls[0][0]
      expect(generateObjectCall.system).toContain(JSON.stringify(withLocaleJsons))
    })

    it('should exclude user context from system prompt if includeContext is false', async () => {
      await translateKeys(keysToTranslate, mockConfigBase, mockI18n, undefined)

      expect(mockGenerateObject).toHaveBeenCalledTimes(2)
      const generateObjectCall = mockGenerateObject.mock.calls[0][0]
      expect(generateObjectCall.system).toContain(mockConfigBase.context)
    })

    it('should handle missing provider in config', async () => {
      const configNoProvider = {
        ...mockConfigBase,
        options: { ...mockConfigBase.options, provider: '' as unknown as Provider, model: mockConfigBase.options.model },
      } as DeepRequired<Config>
      await expect(translateKeys(keysToTranslate, configNoProvider, mockI18n))
        .rejects
        .toThrow(MOCKED_CLI_ERROR_MESSAGE)

      expect(mockHandleCliError).toHaveBeenCalledWith(
        expect.stringContaining('Provider or modelId missing'),
        expect.arrayContaining([expect.stringContaining('Provider: '), expect.stringContaining(`Model: ${mockConfigBase.options.model}`)]),
      )
    })

    it('should handle missing modelId in config', async () => {
      const configNoModel = {
        ...mockConfigBase,
        options: { ...mockConfigBase.options, provider: mockConfigBase.options.provider, model: '' },
      } as DeepRequired<Config>
      await expect(translateKeys(keysToTranslate, configNoModel, mockI18n))
        .rejects
        .toThrow(MOCKED_CLI_ERROR_MESSAGE)

      expect(mockHandleCliError).toHaveBeenCalledWith(
        expect.stringContaining('Provider or modelId missing'),
        expect.arrayContaining([expect.stringContaining(`Provider: ${mockConfigBase.options.provider}`), expect.stringContaining('Model: ')]),
      )
    })

    it('should propagate errors from generateObject', async () => {
      const error = new Error('LLM API Error')
      mockGenerateObject.mockRejectedValue(error)
      await expect(translateKeys(keysToTranslate, mockConfigBase, mockI18n)).rejects.toThrow(error)
    })

    it('should not pass apiKey if not provided in config', async () => {
      const testConfigWithEmptyApiKey = {
        ...mockConfigBase,
        options: { ...mockConfigBase.options, apiKey: '' },
      } as DeepRequired<Config>
      await translateKeys(keysToTranslate, testConfigWithEmptyApiKey, mockI18n)
      expect(mockCreateOpenAI).toHaveBeenCalledWith({})
      expect(mockGenerateObject).toHaveBeenCalledTimes(2)
    })

    it('should use openai provider when specified', async () => {
      const openAIConfig = {
        ...mockConfigBase,
      } as DeepRequired<Config>
      await translateKeys(keysToTranslate, openAIConfig, mockI18n)
      expect(mockCreateOpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' })
      expect(mockLanguageModelFn).toHaveBeenCalledWith('gpt-4.1-mini')
      expect(mockGenerateObject).toHaveBeenCalledTimes(2)
    })

    const providers: Provider[] = ['anthropic', 'google', 'xai', 'mistral', 'groq', 'cerebras']
    const providerMocks = {
      openai: mockCreateOpenAI,
      anthropic: mockCreateAnthropic,
      google: mockCreateGoogleGenerativeAI,
      xai: mockCreateXai,
      mistral: mockCreateMistral,
      groq: mockCreateGroq,
      cerebras: mockCreateCerebras,
      azure: mockCreateAzure,
    }

    providers.forEach((provider) => {
      it(`should use ${provider} provider when specified`, async () => {
        const currentProvider = provider as Exclude<Provider, 'azure' | 'openai'>
        const providerConfig = {
          ...mockConfigBase,
          options: {
            ...mockConfigBase.options,
            provider: currentProvider,
            model: `test-${currentProvider}-model`,
          },
        } as DeepRequired<Config>
        await translateKeys(keysToTranslate, providerConfig, mockI18n)
        expect(providerMocks[currentProvider]).toHaveBeenCalledWith({ apiKey: 'test-api-key' })
        expect(mockLanguageModelFn).toHaveBeenCalledWith(`test-${currentProvider}-model`)
        expect(mockGenerateObject).toHaveBeenCalledTimes(2)
        mockGenerateObject.mockClear()
        ;(providerMocks[currentProvider] as MockedFunction<any>).mockClear()
        mockLanguageModelFn.mockClear()
      })
    })

    it('should use azure provider with resourceName and apiKey', async () => {
      const azureConfig = {
        ...mockConfigBase,
        options: {
          model: 'my-azure-deployment',
          apiKey: 'azure-api-key',
          temperature: mockConfigBase.options.temperature,
          maxTokens: mockConfigBase.options.maxTokens,
          topP: mockConfigBase.options.topP,
          frequencyPenalty: mockConfigBase.options.frequencyPenalty,
          presencePenalty: mockConfigBase.options.presencePenalty,
          seed: mockConfigBase.options.seed,
          provider: 'azure' as const,
          resourceName: 'my-resource',
          apiVersion: '2024-00-00',
          baseURL: 'https://default.azure.com',
          mode: 'auto',
        },
      } as DeepRequired<Config>
      await translateKeys(keysToTranslate, azureConfig, mockI18n)
      expect(mockCreateAzure).toHaveBeenCalledWith({ apiKey: 'azure-api-key', resourceName: 'my-resource', apiVersion: '2024-00-00', baseURL: 'https://default.azure.com' })
      expect(mockLanguageModelFn).toHaveBeenCalledWith('my-azure-deployment')
      expect(mockGenerateObject).toHaveBeenCalledTimes(2)
    })

    it('should use azure provider with baseURL, apiKey, and apiVersion, ignoring resourceName', async () => {
      const azureConfig = {
        ...mockConfigBase,
        options: {
          model: 'my-azure-deployment-2',
          apiKey: 'azure-api-key-2',
          temperature: mockConfigBase.options.temperature,
          maxTokens: mockConfigBase.options.maxTokens,
          topP: mockConfigBase.options.topP,
          frequencyPenalty: mockConfigBase.options.frequencyPenalty,
          presencePenalty: mockConfigBase.options.presencePenalty,
          seed: mockConfigBase.options.seed,
          provider: 'azure' as const,
          resourceName: 'should-be-ignored',
          baseURL: 'https://mycustom.azure.com',
          apiVersion: '2024-05-01',
          mode: 'auto',
        },
      } as DeepRequired<Config>
      await translateKeys(keysToTranslate, azureConfig, mockI18n)
      expect(mockCreateAzure).toHaveBeenCalledWith({
        apiKey: 'azure-api-key-2',
        baseURL: 'https://mycustom.azure.com',
        apiVersion: '2024-05-01',
        resourceName: 'should-be-ignored',
      })
      expect(mockLanguageModelFn).toHaveBeenCalledWith('my-azure-deployment-2')
      expect(mockGenerateObject).toHaveBeenCalledTimes(2)
    })

    it('should use azure provider with only apiKey (relying on env vars for resourceName)', async () => {
      const azureConfig = {
        ...mockConfigBase,
        options: {
          model: 'env-based-deployment',
          apiKey: 'azure-api-key-env',
          temperature: mockConfigBase.options.temperature,
          maxTokens: mockConfigBase.options.maxTokens,
          topP: mockConfigBase.options.topP,
          frequencyPenalty: mockConfigBase.options.frequencyPenalty,
          presencePenalty: mockConfigBase.options.presencePenalty,
          seed: mockConfigBase.options.seed,
          provider: 'azure' as const,
          resourceName: '',
          apiVersion: '',
          baseURL: '',
          mode: 'auto',
        },
      } as DeepRequired<Config>
      await translateKeys(keysToTranslate, azureConfig, mockI18n)
      expect(mockCreateAzure).toHaveBeenCalledWith({ apiKey: 'azure-api-key-env' })
      expect(mockLanguageModelFn).toHaveBeenCalledWith('env-based-deployment')
      expect(mockGenerateObject).toHaveBeenCalledTimes(2)
    })

    it('should handle unsupported provider', async () => {
      const unsupportedProviderConfig = {
        ...mockConfigBase,
        options: {
          ...mockConfigBase.options,
          provider: 'unsupported' as Provider,
        },
      } as DeepRequired<Config>
      await expect(translateKeys(keysToTranslate, unsupportedProviderConfig, mockI18n))
        .rejects
        .toThrow(MOCKED_CLI_ERROR_MESSAGE)

      expect(mockHandleCliError).toHaveBeenCalledWith(
        'Unsupported provider: unsupported',
        'Supported providers are: openai, anthropic, google, xai, mistral, groq, cerebras, azure.',
      )
    })
  })

  describe('sanitizeJsonString', () => {
    it('should return a valid JSON string as is', () => {
      const validJson = '{"key":"value"}'
      expect(sanitizeJsonString(validJson)).toBe(validJson)
    })

    it('should extract JSON from markdown code blocks', () => {
      const markdownJson = '```json\n{"key":"value"}\n```'
      expect(sanitizeJsonString(markdownJson)).toBe('{"key":"value"}')
    })

    it('should remove thinking tags', () => {
      const withThinking = '<think>some thoughts</think>{"key":"value"}'
      expect(sanitizeJsonString(withThinking)).toBe('{"key":"value"}')
    })

    it('should extract JSON object from a string with surrounding text', () => {
      const withText = 'Here is the JSON: {"key":"value"} a-and that is it.'
      expect(sanitizeJsonString(withText)).toBe('{"key":"value"}')
    })

    it('should handle nested JSON', () => {
      const nestedJson = '{"key":{"nested_key":"nested_value"}}'
      expect(sanitizeJsonString(nestedJson)).toBe(nestedJson)
    })

    it('should remove trailing commas from objects', () => {
      const withTrailingComma = '{"key":"value",}'
      const withoutTrailingComma = '{"key":"value"}'
      expect(JSON.parse(sanitizeJsonString(withTrailingComma))).toEqual(JSON.parse(withoutTrailingComma))
    })
  })

  describe('jsonExtractionMiddleware', () => {
    it('should sanitize the text in the result', async () => {
      const dirtyJson = '```json\n{"key":"value"}\n```'
      const doGenerate = vi.fn().mockResolvedValue({ text: dirtyJson })

      const result = await jsonExtractionMiddleware.wrapGenerate!({ doGenerate } as any)

      expect(result.text).toBe('{"key":"value"}')
    })

    it('should handle result with no text', async () => {
      const doGenerate = vi.fn().mockResolvedValue({ text: undefined })
      const result = await jsonExtractionMiddleware.wrapGenerate!({ doGenerate } as any)
      expect(result.text).toBeUndefined()
    })
  })
})
