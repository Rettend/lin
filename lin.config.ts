import process from 'node:process'
import { defineConfig } from './src'

export default defineConfig({
  i18n: {
    locales: ['en-US', 'hu-HU', 'ko-KR'],
    defaultLocale: 'en-US',
  },
  adapters: {
    json: {
      directory: './locales',
    },
    markdown: {
      files: ['docs/src/content/**/*.md', 'docs/src/content/**/*.mdx'],
    },
  },
  with: 'tgt',
  options: {
    provider: 'azure',
    model: 'gpt-5-mini',
    baseURL: process.env.AZURE_URL,
    useDeploymentBasedUrls: true,
    apiVersion: '2025-04-01-preview',
  },
  presets: {
    'grok': {
      provider: 'azure',
      model: 'grok-4-fast-non-reasoning',
    },
    'gemini': {
      provider: 'google',
      model: 'gemini-2.5-flash',
    },
    'kimi': {
      provider: 'groq',
      model: 'moonshotai/kimi-k2-instruct',
    },
    'glm': {
      provider: 'cerebras',
      model: 'zai-glm-4.6',
    },
  },
})
