import type { Mock, Mocked } from 'vitest'
import fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import syncCommand from '@/commands/sync'
import { resolveConfig } from '@/config'
import { loadI18nConfig } from '@/config/i18n'
import * as consoleUtils from '@/utils/console'
import * as generalUtils from '@/utils/general'
import * as llmUtils from '@/utils/llm'
import { baseArgsToRun, createVfsHelpers, mockI18nConfigResult, mockResolvedConfig } from '../test-helpers'

vi.mock('node:fs')
vi.mock('@/config', async () => {
  const actual = await vi.importActual('@/config')
  return {
    ...actual,
    resolveConfig: vi.fn(),
  }
})
vi.mock('@/config/i18n', async () => {
  const actual = await vi.importActual('@/config/i18n')
  return {
    ...actual,
    loadI18nConfig: vi.fn(),
  }
})

const mockTranslateKeys = vi.spyOn(llmUtils, 'translateKeys')
const mockDeletionGuard = vi.spyOn(llmUtils, 'deletionGuard')

const mockConsoleLog = vi.spyOn(consoleUtils.console, 'log')
vi.spyOn(consoleUtils.console, 'logL')
const mockConsoleLoading = vi.spyOn(consoleUtils.console, 'loading').mockImplementation(async (_message, callback) => {
  await callback()
})
vi.spyOn(generalUtils, 'catchError').mockImplementation(fn => fn as any)

const { setupVirtualFile, getVirtualFileContent, resetVfs, expectVirtualFileContent } = createVfsHelpers()
const mockFs = fs as Mocked<typeof fs>

describe('sync command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetVfs()

    const stdout = process.stdout as any
    stdout.moveCursor = vi.fn()
    stdout.cursorTo = vi.fn()
    stdout.clearLine = vi.fn()
    stdout.write = vi.fn()
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
    Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true })

    ;(resolveConfig as Mock).mockResolvedValue({ config: mockResolvedConfig })
    ;(loadI18nConfig as Mock).mockResolvedValue(mockI18nConfigResult)

    mockTranslateKeys.mockImplementation(async (keysToTranslate, _config, _i18n, _withLocaleJsons) => {
      const translated: Record<string, any> = {}
      for (const locale in keysToTranslate) {
        translated[locale] = {}
        for (const keyPath in keysToTranslate[locale]) {
          const originalValue = (keysToTranslate[locale] as any)[keyPath]
          translated[locale][keyPath] = `${originalValue} (${locale})`
        }
      }
      return translated
    })
    mockDeletionGuard.mockResolvedValue(true)

    mockFs.readFileSync.mockImplementation((path) => {
      const content = getVirtualFileContent(path.toString())
      if (content === undefined) {
        const e = new Error(`ENOENT: no such file or directory, open '${path.toString()}'`) as any
        e.code = 'ENOENT'
        throw e
      }
      return JSON.stringify(content)
    })
    mockFs.writeFileSync.mockImplementation((path, data) => {
      setupVirtualFile(path.toString(), JSON.parse(data.toString()))
    })
    mockFs.existsSync.mockImplementation((path: fs.PathLike) => getVirtualFileContent(path.toString()) !== undefined)

    setupVirtualFile('locales/en-US.json', { greeting: 'Hello', farewell: 'Goodbye' })
    setupVirtualFile('locales/es-ES.json', { greeting: 'Hola' })
  })

  afterEach(() => {
    resetVfs()
  })

  it('should sync missing keys for a target locale', async () => {
    const args = {
      ...baseArgsToRun,
      _: ['es-ES'],
      locale: ['es-ES'],
    }

    mockTranslateKeys.mockResolvedValueOnce({
      'es-ES': { farewell: 'Goodbye (es-ES)' },
    })

    await syncCommand.run!({ args } as any)

    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'es-ES': { farewell: 'Goodbye' } },
      mockResolvedConfig,
      mockResolvedConfig.i18n,
      {},
    )

    expectVirtualFileContent('locales/es-ES.json', {
      greeting: 'Hola',
      farewell: 'Goodbye (es-ES)',
    })
    expect(mockConsoleLoading).toHaveBeenCalled()
    expect(mockDeletionGuard).toHaveBeenCalled()
  })

  it('should skip sync if locale is already in sync (shape matches)', async () => {
    setupVirtualFile('locales/es-ES.json', { greeting: 'Hola', farewell: 'Adiós' })

    const args = {
      ...baseArgsToRun,
      _: ['es-ES'],
      locale: ['es-ES'],
    }

    await syncCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, 'Skipped: **es-ES**')
    expect(mockTranslateKeys).not.toHaveBeenCalled()
    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.success, 'All locales are up to date.')
  })

  it('should force sync an entire locale', async () => {
    const args = {
      ...baseArgsToRun,
      _: ['es-ES'],
      locale: ['es-ES'],
      force: true,
    }

    mockTranslateKeys.mockResolvedValueOnce({
      'es-ES': { greeting: 'Hello (es-ES)', farewell: 'Goodbye (es-ES)' },
    })

    await syncCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, 'Force syncing entire JSON for locale: **es-ES**')
    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'es-ES': { greeting: 'Hello', farewell: 'Goodbye' } },
      mockResolvedConfig,
      mockResolvedConfig.i18n,
      {},
    )
    expectVirtualFileContent('locales/es-ES.json', {
      greeting: 'Hello (es-ES)',
      farewell: 'Goodbye (es-ES)',
    })
    expect(mockConsoleLoading).toHaveBeenCalled()
    expect(mockDeletionGuard).toHaveBeenCalled()
  })

  it('should sync all non-default locales when no specific locale is provided in args._', async () => {
    setupVirtualFile('locales/fr-FR.json', {})
    const tempI18nConfig = { ...mockResolvedConfig.i18n, locales: ['en-US', 'es-ES', 'fr-FR'] }
    const tempConfig = { ...mockResolvedConfig, i18n: tempI18nConfig }
    ;(resolveConfig as Mock).mockResolvedValue({ config: tempConfig })

    const args = {
      ...baseArgsToRun,
      _: [],
      locale: 'all',
    }

    mockTranslateKeys.mockResolvedValueOnce({
      'es-ES': { farewell: 'Goodbye (es-ES)' },
      'fr-FR': { greeting: 'Hello (fr-FR)', farewell: 'Goodbye (fr-FR)' },
    })

    await syncCommand.run!({ args } as any)

    expect(mockTranslateKeys).toHaveBeenCalledWith(
      {
        'es-ES': { farewell: 'Goodbye' },
        'fr-FR': { greeting: 'Hello', farewell: 'Goodbye' },
      },
      tempConfig,
      tempI18nConfig,
      {},
    )

    expectVirtualFileContent('locales/es-ES.json', {
      greeting: 'Hola',
      farewell: 'Goodbye (es-ES)',
    })
    expectVirtualFileContent('locales/fr-FR.json', {
      greeting: 'Hello (fr-FR)',
      farewell: 'Goodbye (fr-FR)',
    })
  })

  it('should do nothing if "def" locale is specified', async () => {
    const args = {
      ...baseArgsToRun,
      _: ['def'],
      locale: ['def'],
    }

    await syncCommand.run!({ args } as any)
    expect(mockTranslateKeys).not.toHaveBeenCalled()
    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.success, 'All locales are up to date.')
  })

  it('should create a new locale file if it does not exist', async () => {
    const tempI18nConfig = { ...mockResolvedConfig.i18n, locales: ['en-US', 'fr-FR'] }
    const tempConfig = { ...mockResolvedConfig, i18n: tempI18nConfig }
    ;(resolveConfig as Mock).mockResolvedValue({ config: tempConfig })

    const args = {
      ...baseArgsToRun,
      _: ['fr-FR'],
      locale: ['fr-FR'],
    }

    mockTranslateKeys.mockResolvedValueOnce({
      'fr-FR': { greeting: 'Hello (fr-FR)', farewell: 'Goodbye (fr-FR)' },
    })

    await syncCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.warning, `File not found for locale **fr-FR**. Creating a new one.`)
    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'fr-FR': { greeting: 'Hello', farewell: 'Goodbye' } },
      tempConfig,
      tempI18nConfig,
      {},
    )
    expectVirtualFileContent('locales/fr-FR.json', {
      greeting: 'Hello (fr-FR)',
      farewell: 'Goodbye (fr-FR)',
    })
  })

  it('should use --with flag to provide context', async () => {
    setupVirtualFile('locales/ja-JP.json', { context: { example: 'コンテキスト例' } })
    const tempI18nConfig = { ...mockResolvedConfig.i18n, locales: ['en-US', 'es-ES', 'ja-JP'] }
    const tempConfig = { ...mockResolvedConfig, i18n: tempI18nConfig }
    ;(resolveConfig as Mock).mockResolvedValue({ config: tempConfig })
    const args = {
      ...baseArgsToRun,
      _: ['es-ES'],
      locale: ['es-ES'],
      with: ['ja-JP'],
    }

    mockTranslateKeys.mockResolvedValueOnce({
      'es-ES': { farewell: 'Goodbye (es-ES)' },
    })

    await syncCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, 'With: **ja-JP**')
    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'es-ES': { farewell: 'Goodbye' } },
      tempConfig,
      tempI18nConfig,
      { 'ja-JP': { context: { example: 'コンテキスト例' } } },
    )
  })

  it('should use --with="both" to include default and target locales in context', async () => {
    setupVirtualFile('locales/en-US.json', { greeting: 'Hello', farewell: 'Goodbye' })
    setupVirtualFile('locales/es-ES.json', { greeting: 'Hola' })

    const tempI18nConfig = { ...mockResolvedConfig.i18n, locales: ['en-US', 'es-ES'] }
    const tempConfig = { ...mockResolvedConfig, i18n: tempI18nConfig }
    ;(resolveConfig as Mock).mockResolvedValue({ config: tempConfig })

    const args = {
      ...baseArgsToRun,
      _: ['es-ES'],
      locale: ['es-ES'],
      with: ['both'],
    }

    mockTranslateKeys.mockResolvedValueOnce({
      'es-ES': { farewell: 'Adiós' },
    })

    await syncCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, 'With: **en-US**, **es-ES**')
    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'es-ES': { farewell: 'Goodbye' } },
      tempConfig,
      tempI18nConfig,
      {
        'en-US': { greeting: 'Hello', farewell: 'Goodbye' },
        'es-ES': { greeting: 'Hola' },
      },
    )
  })

  it('should handle debug mode', async () => {
    const args = {
      ...baseArgsToRun,
      _: ['es-ES'],
      locale: ['es-ES'],
      debug: true,
    }
    const tempConfig = { ...mockResolvedConfig, debug: true }
    ;(resolveConfig as Mock).mockResolvedValue({ config: tempConfig })

    mockTranslateKeys.mockResolvedValueOnce({
      'es-ES': { farewell: 'Goodbye (es-ES)' },
    })

    await syncCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, expect.stringContaining('To sync:'))
    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, expect.stringContaining('Translations:'))
  })

  it('should sync nested keys correctly', async () => {
    setupVirtualFile('locales/en-US.json', {
      common: { greeting: 'Hello', farewell: 'Goodbye' },
      user: { profile: { edit: 'Edit Profile' } },
    })
    setupVirtualFile('locales/es-ES.json', {
      common: { greeting: 'Hola' },
    })

    const args = {
      ...baseArgsToRun,
      _: ['es-ES'],
      locale: ['es-ES'],
    }

    mockTranslateKeys.mockResolvedValueOnce({
      'es-ES': {
        'common.farewell': 'Goodbye (es-ES)',
        'user.profile.edit': 'Edit Profile (es-ES)',
      },
    })

    await syncCommand.run!({ args } as any)

    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'es-ES': { 'common.farewell': 'Goodbye', 'user.profile.edit': 'Edit Profile' } },
      mockResolvedConfig,
      mockResolvedConfig.i18n,
      {},
    )

    expectVirtualFileContent('locales/es-ES.json', {
      common: { greeting: 'Hola', farewell: 'Goodbye (es-ES)' },
      user: { profile: { edit: 'Edit Profile (es-ES)' } },
    })
  })

  it('should handle empty default locale file gracefully', async () => {
    resetVfs()
    setupVirtualFile('locales/en-US.json', {})
    setupVirtualFile('locales/es-ES.json', {})

    const args = {
      ...baseArgsToRun,
      _: ['es-ES'],
      locale: ['es-ES'],
    }

    await syncCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, 'Skipped: **es-ES**')
    expect(mockTranslateKeys).not.toHaveBeenCalled()
    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.success, 'All locales are up to date.')
  })

  it('should handle force sync of an empty default locale file', async () => {
    resetVfs()
    setupVirtualFile('locales/en-US.json', {})
    setupVirtualFile('locales/es-ES.json', { existing: 'data' })

    const args = {
      ...baseArgsToRun,
      _: ['es-ES'],
      locale: ['es-ES'],
      force: true,
    }

    mockTranslateKeys.mockResolvedValueOnce({ 'es-ES': {} })

    await syncCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, 'Force syncing entire JSON for locale: **es-ES**')
    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'es-ES': {} },
      mockResolvedConfig,
      mockResolvedConfig.i18n,
      {},
    )
    expectVirtualFileContent('locales/es-ES.json', {})
  })

  it('should handle file system read error for target locale (not ENOENT)', async () => {
    const fsError = new Error('Disk read error');
    (fsError as any).code = 'EIO'
    mockFs.readFileSync.mockImplementation((path) => {
      if (path.toString().includes('es-ES.json'))
        throw fsError
      const content = getVirtualFileContent(path.toString())
      if (content === undefined) {
        const e = new Error(`ENOENT: no such file or directory, open '${path.toString()}'`) as any
        e.code = 'ENOENT'
        throw e
      }
      return JSON.stringify(content)
    })

    const args = { ...baseArgsToRun, _: ['es-ES'], locale: ['es-ES'] }
    await expect(syncCommand.run!({ args } as any)).rejects.toThrow('Disk read error')
  })

  it('should handle multiple locales specified in args._', async () => {
    setupVirtualFile('locales/fr-FR.json', { greeting: 'Bonjour' })
    const tempI18nConfig = { ...mockResolvedConfig.i18n, locales: ['en-US', 'es-ES', 'fr-FR'] }
    const tempConfig = { ...mockResolvedConfig, i18n: tempI18nConfig }
    ;(resolveConfig as Mock).mockResolvedValue({ config: tempConfig })

    const args = {
      ...baseArgsToRun,
      _: ['es-ES', 'fr-FR'],
      locale: ['es-ES', 'fr-FR'],
    }

    mockTranslateKeys.mockResolvedValueOnce({
      'es-ES': { farewell: 'Goodbye (es-ES)' },
      'fr-FR': { farewell: 'Goodbye (fr-FR)' },
    })

    await syncCommand.run!({ args } as any)

    expect(mockTranslateKeys).toHaveBeenCalledWith(
      {
        'es-ES': { farewell: 'Goodbye' },
        'fr-FR': { farewell: 'Goodbye' },
      },
      tempConfig,
      tempI18nConfig,
      {},
    )

    expectVirtualFileContent('locales/es-ES.json', {
      greeting: 'Hola',
      farewell: 'Goodbye (es-ES)',
    })
    expectVirtualFileContent('locales/fr-FR.json', {
      greeting: 'Bonjour',
      farewell: 'Goodbye (fr-FR)',
    })
  })

  it('should have --with CLI flag override config value', async () => {
    setupVirtualFile('locales/ja-JP.json', { context: { example: 'コンテキスト例' } })
    const tempI18nConfig = { ...mockResolvedConfig.i18n, locales: ['en-US', 'es-ES', 'ja-JP'] }
    const tempConfig = { ...mockResolvedConfig, i18n: tempI18nConfig, with: 'def' }
    ;(resolveConfig as Mock).mockResolvedValue({ config: tempConfig })
    const args = {
      ...baseArgsToRun,
      _: ['es-ES'],
      locale: ['es-ES'],
      with: ['ja-JP'],
    }

    mockTranslateKeys.mockResolvedValueOnce({
      'es-ES': { farewell: 'Goodbye (es-ES)' },
    })

    await syncCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, 'With: **ja-JP**')
    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'es-ES': { farewell: 'Goodbye' } },
      tempConfig,
      tempI18nConfig,
      { 'ja-JP': { context: { example: 'コンテキスト例' } } },
    )
  })

  it('should process locales in batches based on batchSize', async () => {
    setupVirtualFile('locales/fr-FR.json', { greeting: 'Bonjour' })
    setupVirtualFile('locales/de-DE.json', { greeting: 'Hallo' })

    const tempI18nConfig = { ...mockResolvedConfig.i18n, locales: ['en-US', 'es-ES', 'fr-FR', 'de-DE'] }
    const tempConfig = {
      ...mockResolvedConfig,
      i18n: tempI18nConfig,
      limits: { ...mockResolvedConfig.limits, locale: 1 },
    }
    ;(resolveConfig as Mock).mockResolvedValue({ config: tempConfig })

    mockTranslateKeys.mockImplementation(async (keysToTranslate) => {
      const translated: Record<string, any> = {}
      for (const locale in keysToTranslate) {
        translated[locale] = {}
        for (const keyPath in keysToTranslate[locale])
          translated[locale][keyPath] = `${(keysToTranslate[locale] as any)[keyPath]} (${locale})`
      }
      return translated
    })

    const args = {
      ...baseArgsToRun,
      _: [],
      locale: 'all',
    }

    await syncCommand.run!({ args } as any)

    expect(mockTranslateKeys).toHaveBeenCalledTimes(3)
  })
})
