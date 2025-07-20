import type { I18nConfig, ResolvedConfig } from '@/config'
import type { DeepRequired } from '@/types'
import { expect } from 'vitest'

export const mockResolvedConfig: DeepRequired<ResolvedConfig> = {
  locale: 'all',
  cwd: '/test/project',
  debug: false,
  context: '',
  with: 'none',
  undo: false,
  integration: '',
  adapter: ['json'],
  adapters: {
    json: {
      directory: 'locales',
      sort: 'def',
    },
    markdown: {
      files: ['**/*.md'],
      localesDir: '.lin/markdown',
    },
  },
  parser: {
    input: ['src/**/*.{js,jsx,ts,tsx,vue,svelte,astro}'],
  },
  i18n: {
    locales: ['en-US', 'es-ES'],
    defaultLocale: 'en-US',
  },
  options: {
    provider: 'openai',
    model: 'gpt-4.1-mini',
    mode: 'auto',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 1000,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    seed: 42,
  },
  presets: {},
  limits: {
    locale: 10,
    key: 50,
    char: 4000,
  },
}

export const mockI18nConfigResult: { i18n: I18nConfig, sources: string[] } = {
  i18n: {
    locales: ['en-US', 'es-ES'],
    defaultLocale: 'en-US',
  },
  sources: ['i18n.config.js'],
}

export const baseArgsToRun = {
  cwd: mockResolvedConfig.cwd,
  debug: mockResolvedConfig.debug,
  context: mockResolvedConfig.context,
  integration: mockResolvedConfig.integration,
  options: mockResolvedConfig.options,
  provider: mockResolvedConfig.options.provider,
  model: mockResolvedConfig.options.model,
  apiKey: mockResolvedConfig.options.apiKey,
  temperature: mockResolvedConfig.options.temperature,
  undo: mockResolvedConfig.undo,
}

export function createVfsHelpers() {
  let virtualFileSystem: Record<string, string> = {}

  const setupVirtualFile = (filePath: string, content: object | string) => {
    virtualFileSystem[filePath.replace(/\\/g, '/')] = typeof content === 'string'
      ? content
      : JSON.stringify(content, null, 2)
  }

  const getVirtualFileContent = (filePath: string): object | string | undefined => {
    const fileContent = virtualFileSystem[filePath.replace(/\\/g, '/')]
    if (fileContent) {
      try {
        return JSON.parse(fileContent)
      }
      catch {
        return fileContent
      }
    }
    return undefined
  }

  const expectVirtualFileContent = (filePath: string, expectedContent: object) => {
    expect(getVirtualFileContent(filePath)).toEqual(expectedContent)
  }

  const resetVfs = () => {
    virtualFileSystem = {}
  }

  const getVfs = () => virtualFileSystem

  return {
    setupVirtualFile,
    getVirtualFileContent,
    expectVirtualFileContent,
    resetVfs,
    getVfs,
  }
}
