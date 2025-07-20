import { describe, expect, it, vi } from 'vitest'
import { resolveConfig } from '@/config'
import * as i18n from '@/config/i18n'

vi.mock('@/config/i18n')

describe('config with adapters', () => {
  const mockLoadI18n = () =>
    vi.spyOn(i18n, 'loadI18nConfig').mockResolvedValue({
      i18n: {
        locales: ['en', 'fr'],
        defaultLocale: 'en',
      },
      sources: [],
    })

  it('should correctly merge file and CLI adapter configs', async () => {
    const mockedLoadI18nConfig = mockLoadI18n()

    const fileConfig = {
      adapters: {
        json: { sort: 'abc' },
        markdown: { files: ['**/*.md'] },
      },
    }

    const { config } = await resolveConfig({
      ...fileConfig,
      adapter: 'markdown',
    })

    expect(config.adapters.json).toEqual({ directory: './locales', sort: 'abc' })
    expect(config.adapters.markdown).toEqual({
      files: ['**/*.md'],
    })
    expect(config.adapter).toEqual(['markdown'])

    mockedLoadI18nConfig.mockRestore()
  })

  it('should expand "all" to the list of configured adapters', async () => {
    const mockedLoadI18nConfig = mockLoadI18n()

    const fileConfig = {
      adapters: {
        json: { directory: './locales' },
        markdown: { files: ['**/*.md'] },
      },
      adapter: 'all',
    }

    const { config } = await resolveConfig(fileConfig)

    expect(config.adapter).toEqual(['json', 'markdown'])

    mockedLoadI18nConfig.mockRestore()
  })

  it('should handle an array of adapters from the CLI', async () => {
    const mockedLoadI18nConfig = mockLoadI18n()

    const { config } = await resolveConfig({
      adapter: ['json', 'markdown'],
      adapters: {
        json: { directory: './locales' },
        markdown: { files: ['**/*.md'] },
      },
    })

    expect(config.adapter).toEqual(['json', 'markdown'])
    expect(config.adapters.json).toBeDefined()
    expect(config.adapters.markdown).toBeDefined()

    mockedLoadI18nConfig.mockRestore()
  })

  it('should use "all" if adapter CLI arg is an empty array', async () => {
    const mockedLoadI18nConfig = mockLoadI18n()

    const { config } = await resolveConfig({
      adapter: [],
      adapters: {
        json: { directory: './locales' },
        markdown: { files: ['**/*.md'] },
      },
    })

    expect(config.adapter).toEqual(['json', 'markdown'])

    mockedLoadI18nConfig.mockRestore()
  })
})
