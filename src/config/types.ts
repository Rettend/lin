import type { ArgDef, BooleanArgDef, StringArgDef } from 'citty'
import type { availableModels, integrations, providers } from './constants'
import type { I18nConfig } from '@/config/i18n'

export interface ModelDefinition {
  value: string
  alias: string
  mode?: 'auto' | 'json' | 'custom'
  iq?: number
  speed?: number
}

export type Provider = (typeof providers)[number]

export type Models = Record<Provider, ModelDefinition[]>

type ModelValue<P extends Provider> = (typeof availableModels)[P][number]['value']

interface LLMOptions {
  /** Optional API key for the provider. If not set, the SDK will try to use the default environment variables. */
  apiKey?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  seed?: number
  /**
   * The output mode to use for the LLM.
   * @value auto: AI SDK will use the best mode for the provider
   * @value json: use native JSON mode or JSON schema in prompt
   * @value custom: use Lin's custom json output parser
   * @default 'auto'
   */
  mode?: 'auto' | 'json' | 'custom'
}

export interface AzureLLMProviderOptions extends LLMOptions {
  provider: 'azure'
  /**
   * For Azure, this is your deployment name.
   */
  model: ModelValue<'azure'> | (string & {})
  /** Azure resource name. Defaults to AZURE_OPENAI_RESOURCE_NAME env var. */
  resourceName?: string
  /** Custom API version. Defaults to a version like '2024-05-01-preview'. */
  apiVersion?: string
  /** URL prefix for API calls. Overrides resourceName if set. */
  baseURL?: string
}

type NonAzureProviderOptionsMap = {
  [P in Exclude<Provider, 'azure'>]: {
    provider: P
    /**
     * The model to use for the specified provider.
     * e.g., "gpt-4.1-mini" for "openai" provider.
     */
    model: ModelValue<P> | (string & {})
  } & LLMOptions
}

export type NonAzureLLMProviderOptions = NonAzureProviderOptionsMap[Exclude<Provider, 'azure'>]

export type LLMProviderOptions = AzureLLMProviderOptions | NonAzureLLMProviderOptions

export type PresetOptions = Partial<LLMProviderOptions> & { context?: string }

export type Integration = (typeof integrations)[number]

export interface ParserConfig {
  /**
   * An array of globs to search for translation keys.
   * @default ['src/**\/*.{js,jsx,ts,tsx,vue,svelte}']
   */
  input: string[]
  [key: string]: any
}

export interface CommonConfig {
  /**
   * the locale to use
   * @field all: every locale
   * @field def: the default locale
   * @field en-US: a specific locale
   * @default all
   */
  locale: string

  /**
   * project root
   * @default process.cwd()
   */
  cwd: string

  /**
   * debug mode
   * @default false
   */
  debug: boolean

  /**
   * Enable/disable undo history.
   * @default true
   */
  undo: boolean
}

export interface LinConfig {
  /**
   * extra information to include in the LLM system prompt
   */
  context: string

  /**
   * The i18n integration used.
   * If empty, `lin` will try to auto-detect the framework.
   * @default ''
   */
  integration: Integration | ''

  /**
   * The i18n configuration object.
   * @default undefined
   */
  i18n?: I18nConfig

  /**
   * Defines which locale files to include in the LLM's context window.
   * @see "Context profiles" in README.md for more details.
   * @default 'none'
   */
  with: 'none' | 'def' | 'tgt' | 'both' | 'all' | (string & {}) | string[]

  /**
   * The number of locales to translate in a single batch.
   * @default 10
   */
  batchSize: number

  /**
   * LLM options
   */
  options: LLMProviderOptions

  /**
   * Saved model configurations that can be activated with the --model flag.
   */
  presets?: Record<string, PresetOptions>

  /**
   * Configuration for the key parser.
   */
  parser?: ParserConfig
}

export type Config = CommonConfig & LinConfig

/**
 * Represents the configuration object after all sources (files, CLI, defaults)
 * have been merged and the i18n settings have been fully resolved.
 */
export type ResolvedConfig = Omit<Config, 'i18n'> & { i18n: I18nConfig }

export type ConfigToArgDef<T> = {
  [K in keyof T]: T[K] extends boolean
    ? BooleanArgDef
    : T[K] extends string
      ? StringArgDef
      : ArgDef
}
