import type { Config } from './types'
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
    model: 'gpt-4o',
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
  registry: {
    baseUrl: 'https://llm.rettend.me',
    status: ['latest', 'preview'],
  },
} satisfies Config
