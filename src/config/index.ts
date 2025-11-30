import type { DeepRequired } from './../types'
import type { I18nConfig } from './i18n'
import type * as ConfigTypes from './types'
import process from 'node:process'
import deepmerge from 'deepmerge'
import { loadConfig } from 'unconfig'
import { SvelteLexer } from '../parsers'
import { handleCliError } from './../utils'
import * as ConfigConstants from './constants'
import { normalizeArgs } from './helpers'
import { DEFAULT_I18N_CONFIG, loadI18nConfig } from './i18n'

export {
  allArgs,
  commonArgs,
  llmArgs,
} from './args'

export {
  DEFAULT_CONFIG,
  integrations,
  providers,
} from './constants'

export {
  DEFAULT_I18N_CONFIG,
  type I18nConfig,
  loadI18nConfig,
} from './i18n'

export type {
  AzureLLMProviderOptions,
  CommonConfig,
  Config,
  Integration,
  LinConfig as LLMConfig,
  LLMProviderOptions,
  ModelDefinition,
  Models,
  Provider,
  ResolvedConfig,
} from './types'

export async function resolveConfig(
  args: Record<string, any>,
): Promise<ReturnType<typeof loadConfig<DeepRequired<ConfigTypes.ResolvedConfig>>>> {
  const cliProvidedArgs = normalizeArgs(args)

  const { config: loadedFromFileConfig, sources, dependencies } = await loadConfig<ConfigTypes.Config>({
    sources: [
      {
        files: ['lin.config'],
      },
      {
        files: ['.linrc'],
      },
      {
        files: 'package.json',
        extensions: [],
        rewrite(config: any) {
          return config?.lin
        },
      },
      {
        files: ['vite.config', 'nuxt.config'],
        async rewrite(config) {
          const resolved = await (typeof config === 'function' ? config() : config)
          return resolved?.lin
        },
      },
    ],
    cwd: cliProvidedArgs.cwd || process.cwd(),
    merge: false,
    defaults: ConfigConstants.DEFAULT_CONFIG,
  })

  const potentialPresetName = cliProvidedArgs.options?.model
  const presetFromFile = potentialPresetName && loadedFromFileConfig.presets?.[potentialPresetName]

  let presetAsConfig: Partial<ConfigTypes.Config> = {}
  if (presetFromFile) {
    const { context: presetContext, ...presetOptions } = presetFromFile
    presetAsConfig = { options: presetOptions as ConfigTypes.LLMProviderOptions }
    if (presetContext)
      presetAsConfig.context = presetContext

    if (cliProvidedArgs.options)
      delete (cliProvidedArgs.options as any).model
  }

  const configForI18nResolution = deepmerge.all([
    loadedFromFileConfig,
    presetAsConfig,
    cliProvidedArgs,
  ]) as ConfigTypes.Config
  const { i18n: loadedI18nObject } = await loadI18nConfig(configForI18nResolution)

  const resolvedI18nObject
    = cliProvidedArgs.i18n && typeof cliProvidedArgs.i18n === 'object'
      ? { ...DEFAULT_I18N_CONFIG, ...cliProvidedArgs.i18n }
      : loadedI18nObject

  const finalMergedConfig = deepmerge.all(
    [
      ConfigConstants.DEFAULT_CONFIG,
      loadedFromFileConfig,
      presetAsConfig,
      cliProvidedArgs,
      { i18n: resolvedI18nObject },
    ],
    { arrayMerge: (_t, s) => s },
  ) as DeepRequired<ConfigTypes.ResolvedConfig>

  const isJsonConfigured = !!finalMergedConfig.adapters.json?.directory
  const isMarkdownConfigured = !!finalMergedConfig.adapters.markdown?.files?.length
  const configuredAdapters = [
    ...(isJsonConfigured ? ['json'] as const : []),
    ...(isMarkdownConfigured ? ['markdown'] as const : []),
  ]

  const normalize = (a: string) => {
    if (a === 'md' || a === 'mdx')
      return 'markdown'
    if (a === 'j')
      return 'json'
    return a
  }
  let requestedAdapters = (
    Array.isArray(finalMergedConfig.adapter) ? finalMergedConfig.adapter : [finalMergedConfig.adapter]
  ).map(normalize)

  if (requestedAdapters.includes('all')) {
    requestedAdapters = configuredAdapters
    if (requestedAdapters.length === 0)
      handleCliError('No adapters are configured.', 'Please configure at least one adapter in your lin.config.ts.')
  }

  const knownAdapters = ['json', 'markdown'] as const
  for (const adapterId of requestedAdapters) {
    if (!knownAdapters.includes(adapterId as any))
      handleCliError(`Invalid adapter: "${adapterId}"`, `Valid adapters are: ${knownAdapters.join(', ')}.`)

    if (!configuredAdapters.includes(adapterId as any)) {
      if (adapterId === 'json') {
        handleCliError(
          `The 'json' adapter is not configured.`,
          `Please add a 'directory' property for it in your lin.config.ts.`,
        )
      }
      if (adapterId === 'markdown') {
        handleCliError(
          `The 'markdown' adapter is not configured.`,
          `Please add a 'files' array for it in your lin.config.ts.`,
        )
      }
    }
  }

  finalMergedConfig.adapter = requestedAdapters

  const isSvelteProject = finalMergedConfig.integration === 'svelte' || finalMergedConfig.parser.input.some(glob => glob.includes('.svelte'))
  const hasCustomSvelteLexer = loadedFromFileConfig.parser?.lexers?.svelte

  if (isSvelteProject && !hasCustomSvelteLexer) {
    if (!finalMergedConfig.parser.lexers)
      (finalMergedConfig.parser as any).lexers = {}

    if (!(finalMergedConfig.parser.lexers as any).svelte) {
      (finalMergedConfig.parser.lexers as any).svelte = [SvelteLexer]
      if (finalMergedConfig.debug)
        // eslint-disable-next-line no-console
        console.log('  [debug] Added SvelteLexer to parser config')
    }
  }

  if (finalMergedConfig.options.provider !== 'azure') {
    delete (finalMergedConfig.options as any).resourceName
    delete (finalMergedConfig.options as any).apiVersion
    delete (finalMergedConfig.options as any).baseURL
  }

  const { provider, model } = finalMergedConfig.options

  if (!provider || !model) {
    handleCliError(
      `Provider or model not configured.`,
      `Please configure them in your lin.config.ts or via CLI arguments.`,
    )
  }

  return { config: finalMergedConfig, sources, dependencies }
}

export function defineConfig(
  config: Partial<Omit<ConfigTypes.Config, 'locale' | 'debug'>>,
): Partial<ConfigTypes.Config> {
  return config as Partial<ConfigTypes.Config>
}

export function defineI18nConfig(config: I18nConfig): I18nConfig {
  return config
}
