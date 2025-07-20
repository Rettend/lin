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
    provider: 'google',
    model: 'gemini-2.5-flash',
  },
  presets: {
    'grok': {
      provider: 'azure',
      model: 'grok-3',
      mode: 'json',
    },
    'ds': {
      provider: 'azure',
      model: 'DeepSeek-R1-0528',
      mode: 'custom',
    },
    'kimi': {
      provider: 'groq',
      model: 'moonshotai/kimi-k2-instruct',
    },
    'fast-ds': {
      provider: 'groq',
      model: 'deepseek-r1-distill-llama-70b',
    },
  },
})
