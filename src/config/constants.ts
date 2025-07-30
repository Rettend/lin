import type { Config, Models, Provider } from './types'
import process from 'node:process'

export const providers = [
  'openai',
  'anthropic',
  'google',
  'xai',
  'mistral',
  'groq',
  'cerebras',
  'azure',
] as const

export const integrations = [
  'i18next',
  'nextjs',
  'nuxt',
  'vue-i18n',
  'angular',
  'svelte',
  'ember-intl',
  'gatsby',
  'solid',
  'qwik',
  'astro',
  'astro-i18next',
  'remix',
] as const

export const DEFAULT_CONFIG = {
  locale: '',
  cwd: process.cwd(),
  debug: false,
  undo: true,
  adapter: 'all',

  context: '',
  integration: '',
  with: 'none',
  limits: {
    locale: 10,
    key: 50,
    char: 4000,
  },

  options: {
    provider: 'openai',
    model: 'gpt-4.1-mini',
    apiKey: undefined,
    temperature: 0,
    mode: 'auto',
  },

  parser: {
    input: ['src/**/*.{js,jsx,ts,tsx,vue,svelte,astro}'],
  },
  adapters: {
    markdown: {
      files: [],
    },
  },
} satisfies Config

export const availableModels = {
  openai: [
    { value: 'gpt-4.1', alias: 'GPT 4.1', iq: 3, speed: 4 },
    { value: 'gpt-4.1-mini', alias: 'GPT 4.1 mini', iq: 3, speed: 5 },
    { value: 'gpt-4.1-nano', alias: 'GPT 4.1 nano', iq: 3, speed: 5 },
    { value: 'o4-mini', alias: 'o4 mini', iq: 5, speed: 1 },
    { value: 'o3', alias: 'o3', iq: 5, speed: 0 },
    { value: 'o3-mini', alias: 'o3 mini', iq: 4, speed: 1 },
    { value: 'gpt-4o', alias: 'GPT 4o', iq: 3, speed: 4 },
    { value: 'gpt-4o-mini', alias: 'GPT 4o mini', iq: 2, speed: 4 },
  ],
  anthropic: [
    { value: 'claude-opus-4-0', alias: 'Claude 4 Opus', iq: 4, speed: 3 },
    { value: 'claude-sonnet-4-0', alias: 'Claude 4 Sonnet', iq: 3, speed: 4 },
    { value: 'claude-3-7-sonnet-latest', alias: 'Claude 3.7 Sonnet', iq: 3, speed: 4 },
    { value: 'claude-3-5-sonnet-latest', alias: 'Claude 3.5 Sonnet', iq: 3, speed: 4 },
    { value: 'claude-3-5-haiku-latest', alias: 'Claude 3.5 Haiku', iq: 2, speed: 3 },
  ],
  google: [
    { value: 'gemini-2.5-pro', alias: 'Gemini 2.5 Pro', iq: 5, speed: 3 },
    { value: 'gemini-2.5-flash', alias: 'Gemini 2.5 Flash', iq: 4, speed: 4 },
    { value: 'gemini-2.5-flash-lite-preview-06-17', alias: 'Gemini 2.5 Flash Lite', iq: 3, speed: 5 },
  ],
  xai: [
    { value: 'grok-4', alias: 'Grok 4', iq: 5, speed: 1 },
    { value: 'grok-3', alias: 'Grok 3', iq: 4, speed: 4 },
    { value: 'grok-3-mini', alias: 'Grok 3 mini', iq: 3, speed: 4 },
    { value: 'grok-3-fast', alias: 'Grok 3 fast', iq: 4, speed: 4 },
    { value: 'grok-3-mini-fast', alias: 'Grok 3 mini fast', iq: 3, speed: 4 },
  ],
  mistral: [
    { value: 'mistral-large-latest', alias: 'Mistral Large', iq: 2, speed: 3 },
    { value: 'mistral-small-latest', alias: 'Mistral Small', iq: 2, speed: 5 },
    { value: 'open-mixtral-8x22b', alias: 'Open Mixtral 8x22B', iq: 2, speed: 4 },
    { value: 'open-mixtral-8x7b', alias: 'Open Mixtral 8x7B', iq: 1, speed: 4 },
    { value: 'open-mistral-7b', alias: 'Open Mistral 7B', iq: 1, speed: 4 },
  ],
  groq: [
    { value: 'moonshotai/kimi-k2-instruct', alias: 'Kimi K2', iq: 4, speed: 5 },
    { value: 'deepseek-r1-distill-llama-70b', alias: 'DeepSeek R1 Distill Llama 70B', iq: 3, speed: 4 },
    { value: 'qwen-qwq-32b', alias: 'QwQ 32B', iq: 3, speed: 3 },
    { value: 'meta-llama/llama-4-maverick-17b-128e-instruct', alias: 'Llama 4 Maverick', iq: 3, speed: 5 },
    { value: 'meta-llama/llama-4-scout-17b-16e-instruct', alias: 'Llama 4 Scout', iq: 3, speed: 5 },
    { value: 'llama-3.3-70b-versatile', alias: 'Llama 3.3 70B', iq: 3, speed: 5 },
    { value: 'llama-3.1-8b-instant', alias: 'Llama 3.1 8B Instant', iq: 2, speed: 5 },
    { value: 'gemma2-9b-it', alias: 'Gemma2 9B IT', iq: 2, speed: 5 },
  ],
  cerebras: [
    { value: 'qwen-3-235b-a22b-instruct-2507', alias: 'Qwen 3 235B 2507', iq: 4, speed: 5 },
    { value: 'qwen-3-32b', alias: 'Qwen 3 32B', iq: 3, speed: 5 },
    { value: 'deepseek-r1-distill-llama-70b', alias: 'DeepSeek R1 Distill Llama 70B', iq: 3, speed: 5 },
    { value: 'llama-4-scout-17b-16e-instruct', alias: 'Llama 4 Scout', iq: 3, speed: 5 },
    { value: 'llama3.1-8b', alias: 'Llama 3.1 8B', iq: 2, speed: 5 },
    { value: 'llama-3.3-70b', alias: 'Llama 3.3 70B', iq: 3, speed: 5 },
  ],
  azure: [
    { value: 'model-router', alias: 'Auto', mode: 'json', iq: 3, speed: 4 },
    { value: 'gpt-4.1', alias: 'GPT 4.1', mode: 'json', iq: 3, speed: 4 },
    { value: 'gpt-4.1-mini', alias: 'GPT 4.1 mini', mode: 'json', iq: 3, speed: 4 },
    { value: 'gpt-4.1-nano', alias: 'GPT 4.1 nano', mode: 'json', iq: 3, speed: 5 },
    { value: 'grok-3', alias: 'Grok 3', mode: 'json', iq: 4, speed: 4 },
    { value: 'grok-3-mini', alias: 'Grok 3 mini', mode: 'json', iq: 3, speed: 4 },
    { value: 'DeepSeek-R1-0528', alias: 'DeepSeek R1', mode: 'custom', iq: 4, speed: 1 },
    { value: 'DeepSeek-V3-0324', alias: 'DeepSeek V3', mode: 'custom', iq: 3, speed: 3 },
    { value: 'gpt-4o', alias: 'GPT 4o', mode: 'json', iq: 3, speed: 4 },
    { value: 'gpt-4o-mini', alias: 'GPT 4o mini', mode: 'json', iq: 2, speed: 4 },
    { value: 'Phi-4', alias: 'Phi 4', mode: 'json', iq: 3, speed: 2 },
  ],
} as const satisfies Models

export type ModelValue = (typeof availableModels)[Provider][number]['value']
export type ModelAlias = (typeof availableModels)[Provider][number]['alias']
