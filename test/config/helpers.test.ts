import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { providers } from '@/config/constants'
import { normalizeArgs } from '@/config/helpers'
import { handleCliError } from '@/utils/general'

vi.mock('@/utils/general')

const mockedHandleCliError = handleCliError as unknown as Mock

describe('normalizeArgs', () => {
  beforeEach(() => {
    mockedHandleCliError.mockImplementation(() => {
      throw new Error('handleCliError was called')
    })
  })

  afterEach(() => {
    mockedHandleCliError.mockClear()
  })

  it('should normalize basic arguments correctly', () => {
    const inputArgs = {
      locale: 'en',
      cwd: '/test',
      debug: true,
      context: 'test context',
    }
    const result = normalizeArgs(inputArgs)
    expect(result.locale).toBe('en')
    expect(result.cwd).toBe('/test')
    expect(result.debug).toBe(true)
    expect(result.context).toBe('test context')
  })

  it('should handle a valid integration', () => {
    const inputArgs = { integration: 'nextjs' }
    const result = normalizeArgs(inputArgs)
    expect(result.integration).toBe('nextjs')
  })

  it('should call handleCliError for an invalid integration', () => {
    const inputArgs = { integration: 'invalid-integration' }
    expect(() => normalizeArgs(inputArgs)).toThrow('handleCliError was called')
    expect(mockedHandleCliError).toHaveBeenCalledWith(
      'Invalid integration "invalid-integration"',
      expect.any(String),
    )
  })

  it('should correctly handle the i18n object', () => {
    const i18nConfig = { locales: ['de'], defaultLocale: 'de', directory: 'i18n' }
    const inputArgs = { i18n: i18nConfig }
    const result = normalizeArgs(inputArgs)
    expect(result.i18n).toEqual(i18nConfig)
  })

  it('should merge top-level LLM args into the options object', () => {
    const inputArgs = {
      provider: 'openai',
      model: 'gpt-4.1-mini',
      apiKey: 'test-key',
      temperature: '0.9',
      mode: 'json',
    }
    const result = normalizeArgs(inputArgs)
    expect(result.options).toEqual({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      apiKey: 'test-key',
      temperature: 0.9,
      mode: 'json',
    })
  })

  it('should call handleCliError for an invalid provider', () => {
    const inputArgs = { provider: 'invalid-provider' }
    expect(() => normalizeArgs(inputArgs)).toThrow('handleCliError was called')
    expect(mockedHandleCliError).toHaveBeenCalledWith(
      'Invalid provider "invalid-provider"',
      `Available providers: ${providers.join(', ')}`,
    )
  })

  it('should call handleCliError for an invalid temperature', () => {
    const inputArgs = { temperature: 'not-a-number' }
    expect(() => normalizeArgs(inputArgs)).toThrow('handleCliError was called')
    expect(mockedHandleCliError).toHaveBeenCalledWith('Invalid temperature "not-a-number"')
  })

  it('should call handleCliError for an invalid mode', () => {
    const inputArgs = { mode: 'invalid-mode' }
    expect(() => normalizeArgs(inputArgs)).toThrow('handleCliError was called')
    expect(mockedHandleCliError).toHaveBeenCalledWith(
      'Invalid mode "invalid-mode"',
      'Available modes: auto, json, custom',
    )
  })

  it('should call handleCliError for a model not found for the given provider', () => {
    const inputArgs = { provider: 'openai', model: 'non-existent-model' }
    expect(() => normalizeArgs(inputArgs)).toThrow('handleCliError was called')
    expect(mockedHandleCliError).toHaveBeenCalledWith(
      'Model "non-existent-model" not found for provider "openai".',
      expect.stringContaining('Available:'),
    )
  })

  it('should handle Azure-specific arguments from top level', () => {
    const inputArgs = {
      azureResourceName: 'my-resource',
      azureApiVersion: 'v1',
      azureBaseURL: 'https://test.azure.com',
    }
    const result = normalizeArgs(inputArgs)
    expect(result.options).toEqual({
      resourceName: 'my-resource',
      apiVersion: 'v1',
      baseURL: 'https://test.azure.com',
    })
  })

  it('should handle and rename old Azure keys from a nested options object', () => {
    const inputArgs = {
      options: {
        azureResourceName: 'my-resource-from-options',
        azureApiVersion: 'v2',
        azureBaseURL: 'https://options.azure.com',
      },
    }
    const result = normalizeArgs(inputArgs)
    expect(result.options).toEqual({
      resourceName: 'my-resource-from-options',
      apiVersion: 'v2',
      baseURL: 'https://options.azure.com',
    })
  })

  it('should let top-level args override args from the options object', () => {
    const inputArgs = {
      provider: 'openai',
      model: 'gpt-4.1-mini',
      options: {
        provider: 'anthropic',
        model: 'from-options-object',
        temperature: 0.5,
      },
    }
    const result = normalizeArgs(inputArgs)
    expect(result.options).toEqual({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      temperature: 0.5,
    })
  })

  it('should return an empty object if no arguments are provided', () => {
    const result = normalizeArgs({})
    expect(result).toEqual({})
  })
})
