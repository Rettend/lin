import type { AzureLLMProviderOptions, Config, Integration, LinConfig, LLMProviderOptions, Provider } from './types'
import { handleCliError } from '../utils'
import { integrations, providers } from './constants'

export function normalizeArgs(inputArgs: Record<string, any>): Partial<Config> {
  const outputConfig: Partial<Config> = {}

  if (inputArgs.locale !== undefined)
    outputConfig.locale = inputArgs.locale
  if (inputArgs.cwd !== undefined)
    outputConfig.cwd = inputArgs.cwd
  if (inputArgs.debug !== undefined)
    outputConfig.debug = inputArgs.debug
  if (inputArgs.undo !== undefined)
    outputConfig.undo = inputArgs.undo
  if (inputArgs.context !== undefined)
    outputConfig.context = inputArgs.context
  if (inputArgs.with !== undefined)
    outputConfig.with = inputArgs.with

  if (inputArgs.adapter !== undefined) {
    let adapterValue = inputArgs.adapter
    if (adapterValue === 'md' || adapterValue === 'mdx')
      adapterValue = 'markdown'
    if (adapterValue === 'j')
      adapterValue = 'json'

    if (Array.isArray(adapterValue))
      outputConfig.adapter = adapterValue.length > 0 ? adapterValue : 'all'
    else
      outputConfig.adapter = adapterValue || 'all'
  }

  const limits: Partial<LinConfig['limits']> = {}
  if (inputArgs['limit.locale'] !== undefined) {
    const bs = Number(inputArgs['limit.locale'])
    if (Number.isNaN(bs))
      handleCliError(`Invalid limit.locale "${inputArgs['limit.locale']}"`)

    limits.locale = bs
  }

  if (inputArgs['limit.key'] !== undefined) {
    const kbs = Number(inputArgs['limit.key'])
    if (Number.isNaN(kbs))
      handleCliError(`Invalid limit.key "${inputArgs['limit.key']}"`)

    limits.key = kbs
  }

  if (inputArgs['limit.char'] !== undefined) {
    const cl = Number(inputArgs['limit.char'])
    if (Number.isNaN(cl))
      handleCliError(`Invalid limit.char "${inputArgs['limit.char']}"`)

    limits.char = cl
  }
  if (Object.keys(limits).length > 0)
    outputConfig.limits = limits as LinConfig['limits']

  if (inputArgs.integration !== undefined) {
    if (inputArgs.integration && !integrations.includes(inputArgs.integration as any)) {
      handleCliError(
        `Invalid integration "${inputArgs.integration}"`,
        `Available integrations: ${integrations.join(', ')}`,
      )
    }
    outputConfig.integration = inputArgs.integration as Integration
  }

  if (inputArgs.i18n !== undefined) {
    if (typeof inputArgs.i18n === 'object' && inputArgs.i18n !== null)
      outputConfig.i18n = inputArgs.i18n
  }

  let llmOptsFromInput: Partial<LLMProviderOptions> = {}

  if (typeof inputArgs.options === 'object' && inputArgs.options !== null) {
    llmOptsFromInput = { ...inputArgs.options }
    if ((llmOptsFromInput as any).azureResourceName !== undefined) {
      (llmOptsFromInput as Partial<AzureLLMProviderOptions>).resourceName = (llmOptsFromInput as any).azureResourceName
      delete (llmOptsFromInput as any).azureResourceName
    }
    if ((llmOptsFromInput as any).azureApiVersion !== undefined) {
      (llmOptsFromInput as Partial<AzureLLMProviderOptions>).apiVersion = (llmOptsFromInput as any).azureApiVersion
      delete (llmOptsFromInput as any).azureApiVersion
    }
    if ((llmOptsFromInput as any).azureBaseURL !== undefined) {
      (llmOptsFromInput as Partial<AzureLLMProviderOptions>).baseURL = (llmOptsFromInput as any).azureBaseURL
      delete (llmOptsFromInput as any).azureBaseURL
    }
  }

  if (inputArgs.provider !== undefined) {
    if (!providers.includes(inputArgs.provider))
      handleCliError(`Invalid provider "${inputArgs.provider}"`, `Available providers: ${providers.join(', ')}`)

    llmOptsFromInput.provider = inputArgs.provider as Provider
  }
  if (inputArgs.model !== undefined)
    llmOptsFromInput.model = inputArgs.model

  if (inputArgs.apiKey !== undefined)
    llmOptsFromInput.apiKey = inputArgs.apiKey

  if (inputArgs.temperature !== undefined) {
    const t = Number(inputArgs.temperature)
    if (Number.isNaN(t))
      handleCliError(`Invalid temperature "${inputArgs.temperature}"`)

    llmOptsFromInput.temperature = t
  }

  if (inputArgs.mode !== undefined) {
    if (!['auto', 'json', 'custom'].includes(inputArgs.mode))
      handleCliError(`Invalid mode "${inputArgs.mode}"`, 'Available modes: auto, json, custom')

    llmOptsFromInput.mode = inputArgs.mode
  }

  if (inputArgs.azureResourceName !== undefined)
    (llmOptsFromInput as Partial<AzureLLMProviderOptions>).resourceName = inputArgs.azureResourceName
  if (inputArgs.azureApiVersion !== undefined)
    (llmOptsFromInput as Partial<AzureLLMProviderOptions>).apiVersion = inputArgs.azureApiVersion
  if (inputArgs.azureBaseURL !== undefined)
    (llmOptsFromInput as Partial<AzureLLMProviderOptions>).baseURL = inputArgs.azureBaseURL

  if (Object.keys(llmOptsFromInput).length > 0)
    outputConfig.options = llmOptsFromInput as LLMProviderOptions

  if (inputArgs.adapters)
    outputConfig.adapters = inputArgs.adapters

  return outputConfig
}
