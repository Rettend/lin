import type { AzureLLMProviderOptions, Config, Provider } from '../config'
import type { I18nConfig } from '../config/i18n'
import type { LocaleJson } from './locale'
import type { DeepRequired } from '@/types'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createAzure } from '@ai-sdk/azure'
import { createCerebras } from '@ai-sdk/cerebras'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import { createXai } from '@ai-sdk/xai'
import { confirm } from '@clack/prompts'
import { createRegistry } from '@rttnd/llm'
import { generateObject } from 'ai'
import { merge } from 'lodash-es'
import { z } from 'zod'
import { providers } from '../config'
import { console, formatLog, ICONS } from './console'
import { handleCliError } from './general'
import { mergeMissingTranslations } from './locale'
import { flattenObject } from './nested'

let registryInstance: ReturnType<typeof createRegistry> | null = null

export function getRegistry(config?: Partial<Config>) {
  if (!registryInstance) {
    registryInstance = createRegistry({
      baseUrl: config?.registry?.baseUrl || 'https://llm.rettend.me',
      cache: 'fs',
    })
  }
  return registryInstance
}

export function destroyRegistry() {
  if (registryInstance) {
    registryInstance.destroy()
    registryInstance = null
  }
}

export async function deletionGuard(keyCountsBefore: Record<string, number>, keyCountsAfter: Record<string, number>, locales: string[], silent = false): Promise<boolean> {
  const negativeDiffs: Record<string, number> = {}
  const allAffectedLocales = Object.keys(keyCountsAfter)
  for (const locale of allAffectedLocales) {
    const diff = (keyCountsAfter[locale] || 0) - (keyCountsBefore[locale] || 0)
    if (diff < 0)
      negativeDiffs[locale] = diff
  }

  if (Object.keys(negativeDiffs).length > 0) {
    if (silent)
      return true
    const result = await confirm({
      message: formatLog(`${ICONS.warning} This will remove ${Object.keys(negativeDiffs).map(l => `\`${-negativeDiffs[l]}\` keys from **${l}**`).join(', ')}. Continue?`),
      initialValue: false,
    })
    if (typeof result !== 'boolean' || !result)
      return false
  }

  if (!silent) {
    console.logL(ICONS.result)
    for (const [index, locale] of allAffectedLocales.entries()) {
      const diff = (keyCountsAfter[locale] || 0) - (keyCountsBefore[locale] || 0)
      const isLast = index === allAffectedLocales.length - 1
      if (allAffectedLocales.length === 1 || isLast)
        console.logL(`${locale} (${diff > 0 ? '+' : ''}${diff})`)
      else
        console.logL(`${locale} (${diff > 0 ? '+' : ''}${diff}), `)
    }
    console.log()
  }
  return true
}

function getInstance(provider: Provider) {
  switch (provider) {
    case 'openai':
      return createOpenAI
    case 'anthropic':
      return createAnthropic
    case 'google':
      return createGoogleGenerativeAI
    case 'xai':
      return createXai
    case 'mistral':
      return createMistral
    case 'groq':
      return createGroq
    case 'cerebras':
      return createCerebras
    case 'azure':
      return createAzure
    default:
      handleCliError(`Unsupported provider: ${provider}`, `Supported providers are: ${providers.join(', ')}.`)
  }
}

export async function translateKeys(
  keysToTranslate: Record<string, LocaleJson>,
  config: DeepRequired<Config>,
  i18n: I18nConfig,
  withLocaleJsons?: Record<string, LocaleJson>,
): Promise<Record<string, LocaleJson>> {
  const allTranslatedKeys: Record<string, LocaleJson> = {}
  const { key: keyBatchSize, char: charLimit } = config.limits

  for (const locale of Object.keys(keysToTranslate)) {
    const localeKeys = keysToTranslate[locale]
    const flatKeys = Object.entries(flattenObject(localeKeys))
    allTranslatedKeys[locale] = {}

    let currentBatch: Record<string, any> = {}
    let currentKeyCount = 0
    let currentCharCount = 0

    for (const [key, value] of flatKeys) {
      const valueLength = value.toString().length

      if (
        currentKeyCount > 0
        && (currentKeyCount + 1 > keyBatchSize || currentCharCount + valueLength > charLimit)
      ) {
        const translatedBatch = await translateSingleBatch(
          { [locale]: currentBatch },
          config,
          i18n,
          withLocaleJsons,
        )
        merge(allTranslatedKeys, translatedBatch)
        currentBatch = {}
        currentKeyCount = 0
        currentCharCount = 0
      }

      currentBatch[key] = value
      currentKeyCount++
      currentCharCount += valueLength
    }

    if (currentKeyCount > 0) {
      const translatedBatch = await translateSingleBatch(
        { [locale]: currentBatch },
        config,
        i18n,
        withLocaleJsons,
      )
      merge(allTranslatedKeys, translatedBatch)
    }
  }
  return allTranslatedKeys
}

async function translateSingleBatch(
  keysToTranslate: Record<string, LocaleJson>,
  config: DeepRequired<Config>,
  i18n: I18nConfig,
  withLocaleJsons?: Record<string, LocaleJson>,
): Promise<Record<string, LocaleJson>> {
  const keysForLlm: Record<string, LocaleJson> = {}
  const passthroughKeys: Record<string, LocaleJson> = {}

  for (const locale in keysToTranslate) {
    const allKeys = keysToTranslate[locale]
    const nonEmpty: LocaleJson = {}
    const empty: LocaleJson = {}
    for (const key in allKeys) {
      if (allKeys[key])
        nonEmpty[key] = allKeys[key]
      else
        empty[key] = ''
    }
    if (Object.keys(nonEmpty).length > 0)
      keysForLlm[locale] = nonEmpty

    if (Object.keys(empty).length > 0)
      passthroughKeys[locale] = empty
  }

  if (Object.keys(keysForLlm).length === 0) {
    const result: Record<string, LocaleJson> = {}
    for (const locale in passthroughKeys)
      result[locale] = mergeMissingTranslations({}, passthroughKeys[locale])

    return result
  }

  const provider = config.options.provider
  const modelId = config.options.model
  if (!provider || !modelId)
    handleCliError(`Provider or modelId missing in config.options.`, [`Provider: ${provider}`, `Model: ${modelId}`])

  const providerFactory = getInstance(provider)

  const clientOptions: { apiKey?: string, [key: string]: any } = {}
  if (config.options.apiKey)
    clientOptions.apiKey = config.options.apiKey

  if (provider === 'azure') {
    const azureOptions = config.options as AzureLLMProviderOptions
    if (azureOptions.resourceName)
      clientOptions.resourceName = azureOptions.resourceName
    if (azureOptions.apiVersion)
      clientOptions.apiVersion = azureOptions.apiVersion
    if (azureOptions.baseURL)
      clientOptions.baseURL = azureOptions.baseURL
    if (azureOptions.useDeploymentBasedUrls)
      clientOptions.useDeploymentBasedUrls = azureOptions.useDeploymentBasedUrls
  }

  const providerClient = providerFactory(clientOptions)
  const model = providerClient.languageModel(modelId as string)

  const system = `For each locale, translate the values from the default locale (${i18n.defaultLocale}) language to the corresponding languages (denoted by the locale keys).
Return a JSON object where each top key is a locale, and the value is an object containing the translations for that locale.
${config.context ? `Additional information from user: ${config.context}` : ''}
${withLocaleJsons && Object.keys(withLocaleJsons).length > 0 ? `Other locale JSONs from the user's codebase for context: ${JSON.stringify(withLocaleJsons)}\nAlways use dot notation when dealing with nested keys: ui.about.title` : ''}
Example input:
{"fr-FR": {"ui.home.title": "Home"}}
Example output:
{"fr-FR": {"ui.home.title": "Accueil"}}`

  const prompt = JSON.stringify(keysForLlm)

  const { data: modelDefinition } = await getRegistry(config as Partial<Config>).getModel(provider, modelId)
  const mode = (modelDefinition as any)?.mode || config.options.mode || 'auto'
  const generateObjectMode = (mode === 'json' || mode === 'tool') ? mode : 'auto'

  const schemaShape: Record<string, z.ZodTypeAny> = {}
  for (const [locale, keys] of Object.entries(keysForLlm)) {
    const localeShape: Record<string, z.ZodTypeAny> = {}
    for (const key of Object.keys(keys))
      localeShape[key] = z.string()

    schemaShape[locale] = z.object(localeShape)
  }
  const dynamicSchema = z.object(schemaShape)

  const { object: translatedJson } = await generateObject({
    model,
    schema: dynamicSchema,
    system,
    prompt,
    temperature: config.options.temperature,
    maxOutputTokens: config.options.maxOutputTokens,
    topP: config.options.topP,
    frequencyPenalty: config.options.frequencyPenalty,
    presencePenalty: config.options.presencePenalty,
    seed: config.options.seed,
    mode: generateObjectMode,
  })

  // if (config.debug)
  //   console.log('\n', ICONS.info, `System Prompt: ${system}`)
  // if (config.debug)
  //   console.log('\n', ICONS.info, `Prompt: ${prompt}`)

  const result = { ...translatedJson } as Record<string, LocaleJson>
  for (const locale in passthroughKeys) {
    if (result[locale])
      result[locale] = mergeMissingTranslations(result[locale], passthroughKeys[locale])
    else
      result[locale] = mergeMissingTranslations({} as LocaleJson, passthroughKeys[locale])
  }
  return result as Record<string, LocaleJson>
}
