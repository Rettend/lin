import type { Status } from '@rttnd/llm'
import type { ArgDef, BooleanArgDef, StringArgDef } from 'citty'
import type { integrations, providers } from './constants'
import type { I18nConfig } from '@/config/i18n'

export interface ModelDefinition {
  value: string
  alias: string
  mode?: 'auto' | 'json' | 'tool'
  iq?: number
  speed?: number
}

export type Provider = (typeof providers)[number]
export type Models = Record<Provider, ModelDefinition[]>

interface LLMOptions {
  /** Optional API key for the provider. If not set, the SDK will try to use the default environment variables. */
  apiKey?: string
  temperature?: number
  maxOutputTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  seed?: number
  /**
   * The output mode to use for the LLM.
   * @value auto: AI SDK will use the best mode for the provider
   * @value json: use native JSON mode or JSON schema in prompt
   * @value tool: use tool calling to extract JSON
   * @default 'auto'
   */
  mode?: 'auto' | 'json' | 'tool'
}

export interface AzureLLMProviderOptions extends LLMOptions {
  provider: 'azure'
  /**
   * For Azure, this is your deployment name.
   */
  model: string
  /** Azure resource name. Defaults to AZURE_OPENAI_RESOURCE_NAME env var. */
  resourceName?: string
  /** Custom API version. Defaults to a version like '2024-05-01-preview'. */
  apiVersion?: string
  /** URL prefix for API calls. Overrides resourceName if set. */
  baseURL?: string
  /**
   * Use deployment-based URLs for API calls.
   * Useful for compatibility with Azure OpenAI models or deployments that require the legacy endpoint format.
   */
  useDeploymentBasedUrls?: boolean
}

type NonAzureProviderOptionsMap = {
  [P in Exclude<Provider, 'azure'>]: {
    provider: P
    /**
     * The model to use for the specified provider.
     * e.g., "gpt-4.1-mini" for "openai" provider.
     */
    model: string
  } & LLMOptions
}

export type NonAzureLLMProviderOptions = NonAzureProviderOptionsMap[Exclude<Provider, 'azure'>]

export type LLMProviderOptions = AzureLLMProviderOptions | NonAzureLLMProviderOptions

export type PresetOptions = Partial<LLMProviderOptions> & { context?: string }

export type Integration = (typeof integrations)[number]

export interface ParserConfig {
  /**
   * An array of globs to search for translation keys.
   * @default ['src/**\/*.{js,jsx,ts,tsx,vue,svelte,astro}']
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
   * The adapter(s) to use.
   * If not provided, all configured adapters will be used.
   */
  adapter?: string | string[]

  /**
   * Enable/disable undo history.
   * @default true
   */
  undo: boolean
}

export interface JsonAdapterConfig {
  sort?: 'abc' | 'def'
  /**
   * Directory containing locale JSON files. Defaults to 'locales'.
   */
  directory: string
}

export interface MarkdownAdapterConfig {
  files: string[]
  localesDir?: string
  output?: string
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
   * Configuration for batching translation requests.
   */
  limits: {
    /**
     * The number of locales to translate in a single batch.
     * @default 10
     */
    locale: number

    /**
     * The number of keys to include in a single batch for translation.
     * @default 50
     */
    key: number

    /**
     * The maximum number of characters for the values in a single batch.
     * This is used as a proxy for token limit.
     * @default 4000
     */
    char: number
  }

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

  adapters?: {
    json?: JsonAdapterConfig
    markdown?: MarkdownAdapterConfig
  }

  registry?: {
    baseUrl?: string
    status?: Status[]
  }
}

export type Config = CommonConfig & LinConfig

/**
 * The resolved configuration object that is passed to most functions.
 * It is a deep merge of the user's config file, CLI arguments, and defaults.
 * The `i18n` property is guaranteed to be present.
 */
export type ResolvedConfig = Omit<Config, 'i18n'> & { i18n: I18nConfig }

export type ConfigToArgDef<T> = {
  [K in keyof T]: T[K] extends boolean
    ? BooleanArgDef
    : T[K] extends string
      ? StringArgDef
      : ArgDef
}
