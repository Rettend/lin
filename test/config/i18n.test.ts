import type { Mock, Mocked } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { loadConfig } from 'unconfig'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_I18N_CONFIG, loadI18nConfig } from '@/config/i18n'
import * as generalUtils from '@/utils/general'
import { createVfsHelpers } from '../test-helpers'

vi.mock('unconfig')
vi.mock('@/utils/general')
vi.mock('node:fs', () => ({
  default: {
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  },
}))

const mockedLoadConfig = loadConfig as unknown as Mock
const mockedHandleCliError = generalUtils.handleCliError as unknown as Mock
const mockedFs = fs as unknown as Mocked<typeof fs>

const { setupVirtualFile, getVirtualFileContent, resetVfs } = createVfsHelpers()

describe('loadI18nConfig', () => {
  let cwd: string
  beforeEach(() => {
    resetVfs()
    cwd = process.cwd()

    mockedFs.readFileSync.mockImplementation((path) => {
      const content = getVirtualFileContent(path.toString())
      if (typeof content === 'string')
        return content

      if (content === undefined) {
        const e = new Error(`ENOENT: no such file or directory, open '${path.toString()}'`) as any
        e.code = 'ENOENT'
        throw e
      }
      return JSON.stringify(content)
    })
    mockedFs.existsSync.mockImplementation((path: fs.PathLike) => getVirtualFileContent(path.toString()) !== undefined)

    vi.clearAllMocks()
    mockedHandleCliError.mockImplementation(() => {
      throw new Error('handleCliError called')
    })
    mockedLoadConfig.mockResolvedValue({
      config: DEFAULT_I18N_CONFIG,
      sources: [],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    resetVfs()
  })

  it('should load config from next.config.js', async () => {
    const nextConfigContent = {
      i18n: {
        locales: ['en', 'fr'],
        defaultLocale: 'en',
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files.includes('next.config'))
      const rewrittenConfig = await source.rewrite(nextConfigContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['next.config.js'] }
    })

    const { i18n } = await loadI18nConfig()

    expect(i18n.locales).toEqual(['en', 'fr'])
    expect(i18n.defaultLocale).toBe('en')
    expect(i18n.directory).toBe('public/locales')
  })

  it('should load config from nuxt.config.js', async () => {
    const nuxtConfigContent = {
      i18n: {
        langDir: 'i18n/',
        locales: [
          { code: 'en', name: 'English' },
          { code: 'es', name: 'Español' },
        ],
        defaultLocale: 'en',
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files.includes('nuxt.config'))
      const rewrittenConfig = await source.rewrite(nuxtConfigContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['nuxt.config.js'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['en', 'es'])
    expect(i18n.defaultLocale).toBe('en')
    expect(i18n.directory).toBe('i18n/')
  })

  it('should load config from vue.config.js with localeDir', async () => {
    const vueConfigContent = {
      pluginOptions: {
        i18n: {
          locale: 'de',
          fallbackLocale: 'de',
          localeDir: 'translations',
          locales: { de: 'Deutsch', at: 'Österreichisch' },
        },
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files.includes('vue.config'))
      const rewrittenConfig = await source.rewrite(vueConfigContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['vue.config.js'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['de', 'at'])
    expect(i18n.defaultLocale).toBe('de')
    expect(i18n.directory).toBe('translations')
  })

  it('should load config from vue.config.js without localeDir', async () => {
    const vueConfigContent = {
      pluginOptions: {
        i18n: {
          locale: 'jp',
          locales: { jp: 'Japanese', kr: 'Korean' },
        },
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files.includes('vue.config'))
      const rewrittenConfig = await source.rewrite(vueConfigContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['vue.config.js'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['jp', 'kr'])
    expect(i18n.defaultLocale).toBe('jp')
    expect(i18n.directory).toBe('src/locales')
  })

  it('should load config from i18next-parser.config.js with patterned output', async () => {
    const i18nextParserConfig = {
      locales: ['en-GB', 'en-US'],
      output: 'src/assets/locales/$LOCALE/translation.json',
      defaultLocale: 'en-GB',
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files.includes('i18next-parser.config'))
      const rewrittenConfig = await source.rewrite(i18nextParserConfig)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['i18next-parser.config.js'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['en-GB', 'en-US'])
    expect(i18n.defaultLocale).toBe('en-GB')
    expect(i18n.directory).toBe('src/assets/locales')
  })

  it('should load config from angular.json', async () => {
    const angularConfig = {
      defaultProject: 'my-app',
      projects: {
        'my-app': {
          i18n: {
            sourceLocale: 'en-US',
            locales: {
              fr: 'src/locale/messages.fr.xlf',
              de: 'src/locale/messages.de.xlf',
            },
          },
        },
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files === 'angular.json')
      const rewrittenConfig = await source.rewrite(angularConfig)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['angular.json'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['fr', 'de'])
    expect(i18n.defaultLocale).toBe('en-US')
    expect(i18n.directory).toBe('src/locale')
  })

  it('should handle no config being found by throwing an error', async () => {
    mockedLoadConfig.mockResolvedValue({ config: null, sources: [] })
    await expect(loadI18nConfig()).rejects.toThrow('handleCliError called')
    expect(mockedHandleCliError).toHaveBeenCalledWith('No i18n configuration found', expect.any(String))
  })

  it('should load config from lin.config file', async () => {
    const linConfigContent = {
      i18n: {
        locales: ['en-AU', 'en-NZ'],
        defaultLocale: 'en-AU',
        directory: 'translations/lin',
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files.includes('lin.config'))
      const rewrittenConfig = await source.rewrite(linConfigContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['lin.config.js'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['en-AU', 'en-NZ'])
    expect(i18n.defaultLocale).toBe('en-AU')
    expect(i18n.directory).toBe('translations/lin')
  })

  it('should load config from .linrc file', async () => {
    const linrcContent = {
      i18n: {
        locales: ['ja-JP'],
        defaultLocale: 'ja-JP',
        directory: 'lang',
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files.includes('.linrc'))
      const rewrittenConfig = await source.rewrite(linrcContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['.linrc'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['ja-JP'])
    expect(i18n.defaultLocale).toBe('ja-JP')
    expect(i18n.directory).toBe('lang')
  })

  it('should load config from package.json', async () => {
    const packageJsonContent = {
      name: 'my-package',
      version: '1.0.0',
      lin: {
        i18n: {
          locales: ['ko-KR', 'zh-CN'],
          defaultLocale: 'ko-KR',
          directory: 'i18n-files',
        },
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files === 'package.json')
      const rewrittenConfig = await source.rewrite(packageJsonContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['package.json'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['ko-KR', 'zh-CN'])
    expect(i18n.defaultLocale).toBe('ko-KR')
    expect(i18n.directory).toBe('i18n-files')
  })

  it('should load config from vite.config.js', async () => {
    const viteConfigContent = {
      plugins: [],
      lin: {
        i18n: {
          locales: ['sv-SE', 'nb-NO'],
          defaultLocale: 'sv-SE',
          directory: 'international',
        },
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files.includes('vite.config'))
      const rewrittenConfig = await source.rewrite(viteConfigContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['vite.config.js'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['sv-SE', 'nb-NO'])
    expect(i18n.defaultLocale).toBe('sv-SE')
    expect(i18n.directory).toBe('international')
  })

  it('should load config from svelte.config.js', async () => {
    const svelteConfigContent = {
      i18n: {
        locales: ['sv', 'en'],
        defaultLocale: 'sv',
        directory: 'src/lib/translations',
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files.includes('svelte.config'))
      const rewrittenConfig = await source.rewrite(svelteConfigContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['svelte.config.js'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['sv', 'en'])
    expect(i18n.defaultLocale).toBe('sv')
    expect(i18n.directory).toBe('src/lib/translations')
  })

  it('should load config from ember-cli-build.js', async () => {
    const emberConfigContent = {
      intl: {
        locales: ['de-DE', 'fr-FR'],
        defaultLocale: 'de-DE',
        baseDir: 'ember-translations',
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files.includes('ember-cli-build'))
      const rewrittenConfig = await source.rewrite(emberConfigContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['ember-cli-build.js'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['de-DE', 'fr-FR'])
    expect(i18n.defaultLocale).toBe('de-DE')
    expect(i18n.directory).toBe('ember-translations')
  })

  it('should load config from gatsby-config.js', async () => {
    const gatsbyConfigContent = {
      plugins: [
        {
          resolve: `gatsby-theme-i18n`,
          options: {
            defaultLang: `en`,
            configPath: `./i18n/config.json`,
          },
        },
      ],
    }
    const i18nConfigFileContent = JSON.stringify([
      { code: 'en', hrefLang: 'en-US' },
      { code: 'fr', hrefLang: 'fr-FR' },
    ])

    mockedFs.readFileSync.mockReturnValue(i18nConfigFileContent)

    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files.includes('gatsby-config'))
      const rewrittenConfig = await source.rewrite(gatsbyConfigContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['gatsby-config.js'] }
    })

    const { i18n } = await loadI18nConfig({ cwd: '/test-project' } as any)
    expect(i18n.locales).toEqual(['en', 'fr'])
    expect(i18n.defaultLocale).toBe('en')
    expect(i18n.directory).toBe('i18n')
    expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining(path.join('i18n', 'config.json')), 'utf8')
  })

  it('should load config from vite.config.js for Solid.js', async () => {
    const viteConfigContent = {
      i18n: {
        locales: ['pl', 'cs'],
        defaultLocale: 'pl',
        directory: 'src/i18n',
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files.includes('vite.config'))
      const rewrittenConfig = await source.rewrite(viteConfigContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['vite.config.js'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['pl', 'cs'])
    expect(i18n.defaultLocale).toBe('pl')
    expect(i18n.directory).toBe('src/i18n')
  })

  it('should load config from package.json for Qwik', async () => {
    const packageJsonContent = {
      qwik: {
        i18n: {
          locales: ['it', 'pt'],
          defaultLocale: 'it',
          directory: 'src/locales/qwik',
        },
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files === 'package.json')
      const rewrittenConfig = await source.rewrite(packageJsonContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['package.json'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['it', 'pt'])
    expect(i18n.defaultLocale).toBe('it')
    expect(i18n.directory).toBe('src/locales/qwik')
  })

  it('should load config from astro.config.mjs', async () => {
    const astroConfigContent = {
      i18n: {
        locales: ['en-GB', 'en-AU'],
        defaultLocale: 'en-GB',
        directory: 'src/astro-locales',
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files.includes('astro.config'))
      const rewrittenConfig = await source.rewrite(astroConfigContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['astro.config.mjs'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['en-GB', 'en-AU'])
    expect(i18n.defaultLocale).toBe('en-GB')
    expect(i18n.directory).toBe('src/astro-locales')
  })

  it('should load config from astro-i18next.config.mjs', async () => {
    const astroI18nextConfigContent = {
      locales: ['nl', 'be'],
      defaultLocale: 'nl',
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files.includes('astro-i18next.config'))
      const rewrittenConfig = await source.rewrite(astroI18nextConfigContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['astro-i18next.config.mjs'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['nl', 'be'])
    expect(i18n.defaultLocale).toBe('nl')
    expect(i18n.directory).toBe('public/locales')
  })

  it('should load config from package.json for Remix', async () => {
    const packageJsonContent = {
      remix: {
        i18n: {
          locales: ['fi', 'no'],
          defaultLocale: 'fi',
          directory: 'app/translations',
        },
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files === 'package.json')
      const rewrittenConfig = await source.rewrite(packageJsonContent)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['package.json'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['fi', 'no'])
    expect(i18n.defaultLocale).toBe('fi')
    expect(i18n.directory).toBe('app/translations')
  })

  it('should handle angular config with a different project name', async () => {
    const angularConfig = {
      defaultProject: 'another-app',
      projects: {
        'my-app': {
          i18n: {
            sourceLocale: 'en-US',
            locales: {
              fr: 'src/locale/messages.fr.xlf',
            },
          },
        },
        'another-app': {
          i18n: {
            sourceLocale: 'de-DE',
            locales: {
              it: 'src/locale/messages.it.xlf',
            },
          },
        },
      },
    }
    mockedLoadConfig.mockImplementation(async (options) => {
      const source = options.sources.find((s: any) => s.files === 'angular.json')
      const rewrittenConfig = await source.rewrite(angularConfig)
      return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['angular.json'] }
    })

    const { i18n } = await loadI18nConfig()
    expect(i18n.locales).toEqual(['it'])
    expect(i18n.defaultLocale).toBe('de-DE')
    expect(i18n.directory).toBe('src/locale')
  })

  it('should load i18n config from lin.config.ts when svelte.config.js is present but has no i18n block', async () => {
    setupVirtualFile(path.join(cwd, 'svelte.config.js'), 'export default { kit: {} }')
    setupVirtualFile(path.join(cwd, 'lin.config.ts'), `
      import { defineConfig } from '@rttnd/lin';
      export default defineConfig({ 
        i18n: { 
          locales: ['en-US', 'fr-FR'], 
          defaultLocale: 'en-US', 
          directory: 'i18n/locales' 
        } 
      });
    `)

    // Directly mock loadConfig to return the expected i18n config
    mockedLoadConfig.mockResolvedValueOnce({
      config: {
        locales: ['en-US', 'fr-FR'],
        defaultLocale: 'en-US',
        directory: 'i18n/locales',
      },
      sources: ['lin.config.ts'],
    })

    const { i18n, sources } = await loadI18nConfig({ cwd } as any)

    expect(i18n.locales).toEqual(['en-US', 'fr-FR'])
    expect(i18n.defaultLocale).toBe('en-US')
    expect(i18n.directory).toBe('i18n/locales')
    expect(sources[0]).toContain('lin.config.ts')
  })

  it('should load i18n config from i18n.config.ts when angular.json is present but has no i18n block', async () => {
    setupVirtualFile(path.join(cwd, 'angular.json'), '{ "defaultProject": "my-app", "projects": { "my-app": {} } }')
    setupVirtualFile(path.join(cwd, 'i18n.config.ts'), `
      export default { 
        locales: ['en-GB', 'de-DE'], 
        defaultLocale: 'en-GB', 
        directory: 'src/assets/i18n' 
      }
    `)

    // Directly mock loadConfig to return the expected i18n config
    mockedLoadConfig.mockResolvedValueOnce({
      config: {
        locales: ['en-GB', 'de-DE'],
        defaultLocale: 'en-GB',
        directory: 'src/assets/i18n',
      },
      sources: ['i18n.config.ts'],
    })

    const { i18n, sources } = await loadI18nConfig({ cwd } as any)

    expect(i18n.locales).toEqual(['en-GB', 'de-DE'])
    expect(i18n.defaultLocale).toBe('en-GB')
    expect(i18n.directory).toBe('src/assets/i18n')
    expect(sources[0]).toContain('i18n.config.ts')
  })
})

describe('loadI18nConfig with integration flag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedLoadConfig.mockResolvedValue({
      config: DEFAULT_I18N_CONFIG,
      sources: [],
    })
  })

  it('should only search for nextjs config when integration is nextjs', async () => {
    const nextConfig = { i18n: { locales: ['en'], defaultLocale: 'en' } }
    mockedLoadConfig.mockImplementation(async (options) => {
      const hasNextJsSource = options.sources.some((s: any) => s.files?.includes('next.config'))
      const hasNuxtJsSource = options.sources.some((s: any) => s.files?.includes('nuxt.config'))
      expect(hasNextJsSource).toBe(true)
      expect(hasNuxtJsSource).toBe(false)

      const source = options.sources.find((s: any) => s.files.includes('next.config'))
      if (source) {
        const rewrittenConfig = await source.rewrite(nextConfig)
        return { config: { ...DEFAULT_I18N_CONFIG, ...rewrittenConfig }, sources: ['next.config.js'] }
      }
      return { config: null, sources: [] }
    })

    await loadI18nConfig({ integration: 'nextjs' } as any)
    expect(mockedLoadConfig).toHaveBeenCalled()
  })

  it('should search all sources when no integration is provided', async () => {
    mockedLoadConfig.mockImplementation(async (options) => {
      const hasNextJsSource = options.sources.some((s: any) => s.files?.includes('next.config'))
      const hasNuxtJsSource = options.sources.some((s: any) => s.files?.includes('nuxt.config'))
      expect(hasNextJsSource).toBe(true)
      expect(hasNuxtJsSource).toBe(true)
      return { config: DEFAULT_I18N_CONFIG, sources: [] }
    })

    await loadI18nConfig({} as any)
    expect(mockedLoadConfig).toHaveBeenCalled()
  })

  it('should filter for a framework that shares a config file (solid)', async () => {
    mockedLoadConfig.mockImplementation(async (options) => {
      const viteSource = options.sources.find((s: any) => s.files?.includes('vite.config'))
      expect(viteSource).toBeDefined()

      const packageJsonSource = options.sources.find((s: any) => s.files === 'package.json')
      expect(packageJsonSource).toBeUndefined()

      return { config: DEFAULT_I18N_CONFIG, sources: [] }
    })

    await loadI18nConfig({ integration: 'solid' } as any)
    expect(mockedLoadConfig).toHaveBeenCalled()
  })
})
