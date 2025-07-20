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
        directory: 'locales',
      },
      sources: [],
    })

  it('should handle adapters config from file correctly', async () => {
    const mockedLoadI18nConfig = mockLoadI18n()

    const rawConfig = {
      adapters: {
        json: {
          sort: 'abc',
        },
        markdown: {
          files: ['**/*.md'],
        },
      },
    }

    const { config } = await resolveConfig(rawConfig)

    expect(config.adapters).toBeDefined()
    expect(config.adapters.json).toEqual({ sort: 'abc' })
    expect(config.adapters.markdown).toEqual({ files: ['**/*.md'] })
    expect(config.adapter).toBeUndefined()

    mockedLoadI18nConfig.mockRestore()
  })

  it('should correctly parse the --adapter CLI argument', async () => {
    const mockedLoadI18nConfig = mockLoadI18n()

    const { config } = await resolveConfig({ adapter: ['json', 'markdown'] })

    expect(config.adapter).toBeDefined()
    expect(config.adapter).toEqual(['json', 'markdown'])
    expect(config.adapters.json).toBeDefined()

    mockedLoadI18nConfig.mockRestore()
  })
})
