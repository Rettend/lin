import type { Mock, Mocked } from 'vitest'
import fs from 'node:fs'
import { text as clackText } from '@clack/prompts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import addCommand from '@/commands/add'
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
vi.mock('@clack/prompts', async () => {
  const actual = await vi.importActual('@clack/prompts')
  return {
    ...actual,
    text: vi.fn(),
  }
})

const mockProvideSuggestions = vi.spyOn(generalUtils, 'provideSuggestions')
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

describe('add command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetVfs()

    ;(resolveConfig as Mock).mockResolvedValue({ config: mockResolvedConfig })
    ;(loadI18nConfig as Mock).mockResolvedValue(mockI18nConfigResult)
    ;(clackText as Mock).mockResolvedValue('Test Translation from Prompt')
    mockProvideSuggestions.mockReturnValue(false)

    mockTranslateKeys.mockImplementation(async (keysToTranslate, _config, _i18n, _withLocaleJsons) => {
      const translated: Record<string, any> = {}
      for (const locale in keysToTranslate) {
        translated[locale] = {}
        for (const key in keysToTranslate[locale]) {
          const originalValue = (keysToTranslate[locale] as any)[key]
          translated[locale][key] = `${originalValue} (${locale})`
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

    setupVirtualFile('locales/en-US.json', { existing: { key: 'Hello' } })
    setupVirtualFile('locales/es-ES.json', { existing: { key: 'Hola' } })
  })

  afterEach(() => {
    resetVfs()
  })

  it('should call provideSuggestions when no translation is given', async () => {
    mockProvideSuggestions.mockReturnValue(true)
    const args = {
      ...baseArgsToRun,
      key: 'new.key',
      _: ['new.key'],
      locale: 'all',
    }

    await addCommand.run!({ args } as any)

    expect(mockProvideSuggestions).toHaveBeenCalledWith(expect.anything(), 'new.key', { suggestOnExact: true })
    expect(mockTranslateKeys).not.toHaveBeenCalled()
  })

  it('should add a new key with translation from CLI arguments', async () => {
    const cliTranslation = 'Test Translation from CLI'
    const args = {
      ...baseArgsToRun,
      key: 'another.key',
      _: ['another.key', cliTranslation],
      locale: 'all',
    }

    await addCommand.run!({ args } as any)

    expect(clackText).not.toHaveBeenCalled()
    expect(mockProvideSuggestions).not.toHaveBeenCalled()

    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'es-ES': { 'another.key': cliTranslation } },
      mockResolvedConfig,
      mockResolvedConfig.i18n,
      {},
    )

    expectVirtualFileContent('locales/en-US.json', {
      existing: { key: 'Hello' },
      another: { key: cliTranslation },
    })
    expectVirtualFileContent('locales/es-ES.json', {
      existing: { key: 'Hola' },
      another: { key: `${cliTranslation} (es-ES)` },
    })
    expect(mockDeletionGuard).toHaveBeenCalled()
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should create a new locale file if it does not exist and add the key', async () => {
    const translation = 'New File Translation'
    const args = {
      ...baseArgsToRun,
      key: 'new.key.for.new.file',
      _: ['new.key.for.new.file', translation],
      locale: 'all',
    }

    resetVfs()
    setupVirtualFile('locales/en-US.json', { existing: { key: 'Hello' } })

    await addCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.warning, `File not found for locale **es-ES**. Creating a new one.`)

    expectVirtualFileContent('locales/en-US.json', {
      existing: { key: 'Hello' },
      new: { key: { for: { new: { file: translation } } } },
    })
    expectVirtualFileContent('locales/es-ES.json', {
      new: { key: { for: { new: { file: `${translation} (es-ES)` } } } },
    })
    expect(mockDeletionGuard).toHaveBeenCalled()
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should handle multi-word translations from CLI', async () => {
    const args = {
      ...baseArgsToRun,
      key: 'multi.word',
      _: ['multi.word', 'This', 'is', 'a', 'multi', 'word', 'translation'],
      locale: 'all',
    }

    await addCommand.run!({ args } as any)

    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'es-ES': { 'multi.word': 'This is a multi word translation' } },
      mockResolvedConfig,
      mockResolvedConfig.i18n,
      {},
    )

    expectVirtualFileContent('locales/en-US.json', {
      existing: { key: 'Hello' },
      multi: { word: 'This is a multi word translation' },
    })
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should show suggestions even if key exists when no translation is provided', async () => {
    setupVirtualFile('locales/en-US.json', { existing: { key: 'Hello' } })
    mockProvideSuggestions.mockReturnValue(true)
    const args = {
      ...baseArgsToRun,
      key: 'existing.key',
      _: ['existing.key'],
    }

    await addCommand.run!({ args } as any)

    expect(mockProvideSuggestions).toHaveBeenCalledWith(expect.anything(), 'existing.key', { suggestOnExact: true })
    expect(mockConsoleLog).not.toHaveBeenCalledWith(consoleUtils.ICONS.info, expect.stringContaining('already exists'))
    expect(mockTranslateKeys).not.toHaveBeenCalled()
  })

  it('should prompt for translation if key is new and no suggestions are found', async () => {
    const args = {
      ...baseArgsToRun,
      key: 'new.from.prompt',
      _: ['new.from.prompt'],
    }
    ;(clackText as Mock).mockResolvedValue('Prompted Translation')
    mockProvideSuggestions.mockReturnValue(false)

    await addCommand.run!({ args } as any)

    expect(mockProvideSuggestions).toHaveBeenCalledWith(expect.anything(), 'new.from.prompt', { suggestOnExact: true })
    expect(clackText).toHaveBeenCalledWith({
      message: `Enter ${mockResolvedConfig.i18n.defaultLocale} translation for key \`new.from.prompt\``,
      placeholder: 'Press [ENTER] to skip',
    })
    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'es-ES': { 'new.from.prompt': 'Prompted Translation' } },
      mockResolvedConfig,
      mockResolvedConfig.i18n,
      {},
    )
    expectVirtualFileContent('locales/en-US.json', {
      existing: { key: 'Hello' },
      new: { from: { prompt: 'Prompted Translation' } },
    })
  })

  it('should exit if prompt is cancelled', async () => {
    const args = {
      ...baseArgsToRun,
      key: 'new.from.prompt',
      _: ['new.from.prompt'],
    }
    ;(clackText as Mock).mockResolvedValue(Symbol('cancelled'))
    mockProvideSuggestions.mockReturnValue(false)

    await addCommand.run!({ args } as any)

    expect(mockProvideSuggestions).toHaveBeenCalledWith(expect.anything(), 'new.from.prompt', { suggestOnExact: true })
    expect(clackText).toHaveBeenCalled()
    expect(mockTranslateKeys).not.toHaveBeenCalled()
  })

  it('should skip existing keys without --force flag', async () => {
    setupVirtualFile('locales/en-US.json', { existing: { key: 'Hello' } })
    setupVirtualFile('locales/es-ES.json', { existing: { key: 'Hola' } })

    const args = {
      ...baseArgsToRun,
      key: 'existing.key',
      _: ['existing.key', 'New translation'],
      locale: 'all',
      force: false,
    }

    await addCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, 'Skipped: **en-US**')
    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, 'Skipped: **es-ES**')
    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.success, 'All locales are up to date.')
    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.note, 'Keys: 1')
    expect(mockTranslateKeys).not.toHaveBeenCalled()
  })

  it('should overwrite existing keys with --force flag', async () => {
    setupVirtualFile('locales/en-US.json', { existing: { key: 'Hello' } })
    setupVirtualFile('locales/es-ES.json', { existing: { key: 'Hola' } })

    const args = {
      ...baseArgsToRun,
      key: 'existing.key',
      _: ['existing.key', 'Overwritten translation'],
      locale: 'all',
      force: true,
    }

    await addCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, 'Overwriting translation for locales: **en-US**, **es-ES**')
    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'es-ES': { 'existing.key': 'Overwritten translation' } },
      mockResolvedConfig,
      mockResolvedConfig.i18n,
      {},
    )

    expectVirtualFileContent('locales/en-US.json', {
      existing: { key: 'Overwritten translation' },
    })
    expectVirtualFileContent('locales/es-ES.json', {
      existing: { key: 'Overwritten translation (es-ES)' },
    })
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should handle specific locale targeting', async () => {
    const args = {
      ...baseArgsToRun,
      key: 'specific.locale',
      _: ['specific.locale', 'Specific translation'],
      locale: ['es-ES'],
    }

    await addCommand.run!({ args } as any)

    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'es-ES': { 'specific.locale': 'Specific translation' } },
      mockResolvedConfig,
      mockResolvedConfig.i18n,
      {},
    )

    expectVirtualFileContent('locales/en-US.json', { existing: { key: 'Hello' } })
    expectVirtualFileContent('locales/es-ES.json', {
      existing: { key: 'Hola' },
      specific: { locale: 'Specific translation (es-ES)' },
    })
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should handle default locale only', async () => {
    const args = {
      ...baseArgsToRun,
      key: 'default.only',
      _: ['default.only', 'Default only translation'],
      locale: ['en-US'],
    }

    await addCommand.run!({ args } as any)

    expect(mockTranslateKeys).not.toHaveBeenCalled()

    expectVirtualFileContent('locales/en-US.json', {
      existing: { key: 'Hello' },
      default: { only: 'Default only translation' },
    })
    expectVirtualFileContent('locales/es-ES.json', { existing: { key: 'Hola' } })
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should use --with flag to provide context', async () => {
    setupVirtualFile('locales/ja-JP.json', { context: { example: 'コンテキスト例' } })

    const tempI18nConfig = { ...mockResolvedConfig.i18n, locales: ['en-US', 'es-ES', 'ja-JP'] }
    const tempConfig = { ...mockResolvedConfig, i18n: tempI18nConfig }
    ;(resolveConfig as Mock).mockResolvedValue({ config: tempConfig })

    const args = {
      ...baseArgsToRun,
      key: 'with.context',
      _: ['with.context', 'Context translation'],
      locale: 'all',
      with: ['ja-JP'],
    }

    await addCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, 'With: **ja-JP**')
    expect(mockTranslateKeys).toHaveBeenCalledWith(
      {
        'es-ES': { 'with.context': 'Context translation' },
        'ja-JP': { 'with.context': 'Context translation' },
      },
      tempConfig,
      tempI18nConfig,
      { 'ja-JP': { context: { example: 'コンテキスト例' } } },
    )
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should handle debug mode', async () => {
    const args = {
      ...baseArgsToRun,
      key: 'debug.key',
      _: ['debug.key', 'Debug translation'],
      locale: 'all',
      debug: true,
    }

    const tempConfig = { ...mockResolvedConfig, debug: true }
    ;(resolveConfig as Mock).mockResolvedValue({ config: tempConfig })

    await addCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, expect.stringContaining('To translate:'))
    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, expect.stringContaining('Translations:'))
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should handle nested key structures', async () => {
    const args = {
      ...baseArgsToRun,
      key: 'deeply.nested.key.structure',
      _: ['deeply.nested.key.structure', 'Deeply nested value'],
      locale: 'all',
    }

    await addCommand.run!({ args } as any)

    expectVirtualFileContent('locales/en-US.json', {
      existing: { key: 'Hello' },
      deeply: { nested: { key: { structure: 'Deeply nested value' } } },
    })
    expectVirtualFileContent('locales/es-ES.json', {
      existing: { key: 'Hola' },
      deeply: { nested: { key: { structure: 'Deeply nested value (es-ES)' } } },
    })
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should handle deletion guard rejection', async () => {
    mockDeletionGuard.mockResolvedValue(false)

    const args = {
      ...baseArgsToRun,
      key: 'guard.rejected',
      _: ['guard.rejected', 'Rejected translation'],
      locale: 'all',
    }

    await addCommand.run!({ args } as any)

    expect(mockDeletionGuard).toHaveBeenCalled()
    expect(mockFs.writeFileSync).not.toHaveBeenCalled()
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should handle file system errors during read', async () => {
    const fsError = new Error('File system error')
    // @ts-expect-error - code is a property of NodeJS.ErrnoException
    fsError.code = 'EACCES' // Not ENOENT

    mockFs.readFileSync.mockImplementation((path) => {
      if (path.toString().includes('es-ES'))
        throw fsError
      const content = getVirtualFileContent(path.toString())
      return JSON.stringify(content)
    })

    const args = {
      ...baseArgsToRun,
      key: 'fs.error',
      _: ['fs.error', 'FS error translation'],
      locale: 'all',
    }

    await expect(addCommand.run!({ args } as any)).rejects.toThrow('File system error')
  })

  it('should handle empty translation input without calling LLM', async () => {
    const args = {
      ...baseArgsToRun,
      key: 'empty.translation',
      _: ['empty.translation', ''],
      locale: 'all',
    }

    await addCommand.run!({ args } as any)

    expect(mockTranslateKeys).not.toHaveBeenCalled()

    expectVirtualFileContent('locales/en-US.json', {
      existing: { key: 'Hello' },
      empty: { translation: '' },
    })
    expectVirtualFileContent('locales/es-ES.json', {
      existing: { key: 'Hola' },
      empty: { translation: '' },
    })
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should handle multiple locales with --with flag', async () => {
    setupVirtualFile('locales/fr-FR.json', { common: { greeting: 'Bonjour' } })
    setupVirtualFile('locales/de-DE.json', { common: { greeting: 'Hallo' } })

    const tempI18nConfig = { ...mockResolvedConfig.i18n, locales: ['en-US', 'es-ES', 'fr-FR', 'de-DE'] }
    const tempConfig = { ...mockResolvedConfig, i18n: tempI18nConfig }
    ;(resolveConfig as Mock).mockResolvedValue({ config: tempConfig })

    const args = {
      ...baseArgsToRun,
      key: 'multi.with',
      _: ['multi.with', 'Multi with translation'],
      locale: 'all',
      with: ['fr-FR', 'de-DE'],
    }

    await addCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, 'With: **fr-FR**, **de-DE**')
    expect(mockTranslateKeys).toHaveBeenCalledWith(
      expect.objectContaining({
        'es-ES': { 'multi.with': 'Multi with translation' },
        'fr-FR': { 'multi.with': 'Multi with translation' },
        'de-DE': { 'multi.with': 'Multi with translation' },
      }),
      tempConfig,
      tempI18nConfig,
      {
        'fr-FR': { common: { greeting: 'Bonjour' } },
        'de-DE': { common: { greeting: 'Hallo' } },
      },
    )
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should handle partial overwrites with --force', async () => {
    setupVirtualFile('locales/en-US.json', { existing: { key: 'Hello' }, other: { key: 'Other' } })
    setupVirtualFile('locales/es-ES.json', { other: { key: 'Otro' } }) // Missing existing.key

    const args = {
      ...baseArgsToRun,
      key: 'existing.key',
      _: ['existing.key', 'Force overwrite'],
      locale: 'all',
      force: true,
    }

    await addCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, 'Overwriting translation for locale: **en-US**')
    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'es-ES': { 'existing.key': 'Force overwrite' } },
      mockResolvedConfig,
      mockResolvedConfig.i18n,
      {},
    )

    expectVirtualFileContent('locales/en-US.json', {
      existing: { key: 'Force overwrite' },
      other: { key: 'Other' },
    })
    expectVirtualFileContent('locales/es-ES.json', {
      other: { key: 'Otro' },
      existing: { key: 'Force overwrite (es-ES)' },
    })
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should handle translation failures gracefully', async () => {
    const translationError = new Error('Translation API failed')
    mockTranslateKeys.mockRejectedValue(translationError)

    const args = {
      ...baseArgsToRun,
      key: 'translation.error',
      _: ['translation.error', 'Error translation'],
      locale: 'all',
    }

    await expect(addCommand.run!({ args } as any)).rejects.toThrow('Translation API failed')
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should handle complex existing structures when adding nested keys', async () => {
    setupVirtualFile('locales/en-US.json', {
      existing: { key: 'Hello' },
      deeply: { nested: { existing: 'structure' } },
    })
    setupVirtualFile('locales/es-ES.json', {
      existing: { key: 'Hola' },
      deeply: { different: { structure: 'estructura' } },
    })

    const args = {
      ...baseArgsToRun,
      key: 'deeply.nested.new.key',
      _: ['deeply.nested.new.key', 'New nested value'],
      locale: 'all',
    }

    await addCommand.run!({ args } as any)

    expectVirtualFileContent('locales/en-US.json', {
      existing: { key: 'Hello' },
      deeply: { nested: { existing: 'structure', new: { key: 'New nested value' } } },
    })
    expectVirtualFileContent('locales/es-ES.json', {
      existing: { key: 'Hola' },
      deeply: { different: { structure: 'estructura' }, nested: { new: { key: 'New nested value (es-ES)' } } },
    })
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should handle single locale string (not array)', async () => {
    const args = {
      ...baseArgsToRun,
      key: 'single.string.locale',
      _: ['single.string.locale', 'Single string locale'],
      locale: 'es-ES',
    }

    await addCommand.run!({ args } as any)

    expect(mockTranslateKeys).toHaveBeenCalledWith(
      { 'es-ES': { 'single.string.locale': 'Single string locale' } },
      mockResolvedConfig,
      mockResolvedConfig.i18n,
      {},
    )

    expectVirtualFileContent('locales/en-US.json', { existing: { key: 'Hello' } })
    expectVirtualFileContent('locales/es-ES.json', {
      existing: { key: 'Hola' },
      single: { string: { locale: 'Single string locale (es-ES)' } },
    })
    expect(mockConsoleLoading).toHaveBeenCalled()
  })

  it('should show current key count when no keys need translation', async () => {
    setupVirtualFile('locales/en-US.json', { existing: { key: 'Hello' } })
    setupVirtualFile('locales/es-ES.json', { existing: { key: 'Hola' } })

    const args = {
      ...baseArgsToRun,
      key: 'existing.key',
      _: ['existing.key', 'Already exists'],
      locale: 'all',
    }

    await addCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.success, 'All locales are up to date.')
    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.note, 'Keys: 1')
    expect(mockTranslateKeys).not.toHaveBeenCalled()
  })

  it('should have --with CLI flag override config value', async () => {
    setupVirtualFile('locales/ja-JP.json', { context: { example: 'コンテキスト例' } })

    const tempI18nConfig = { ...mockResolvedConfig.i18n, locales: ['en-US', 'es-ES', 'ja-JP'] }
    const tempConfig = { ...mockResolvedConfig, i18n: tempI18nConfig, with: 'def' }
    ;(resolveConfig as Mock).mockResolvedValue({ config: tempConfig })

    const args = {
      ...baseArgsToRun,
      key: 'with.override',
      _: ['with.override', 'Override translation'],
      locale: 'all',
      with: ['ja-JP'],
    }

    await addCommand.run!({ args } as any)

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleUtils.ICONS.info, 'With: **ja-JP**')
    expect(mockTranslateKeys).toHaveBeenCalledWith(
      expect.objectContaining({
        'es-ES': { 'with.override': 'Override translation' },
        'ja-JP': { 'with.override': 'Override translation' },
      }),
      tempConfig,
      tempI18nConfig,
      { 'ja-JP': { context: { example: 'コンテキスト例' } } },
    )
  })

  it('should compute correct diff count for added key', async () => {
    const args = {
      ...baseArgsToRun,
      key: 'diff.count',
      _: ['diff.count', 'Diff Count Translation'],
      locale: ['en-US'],
    }

    await addCommand.run!({ args } as any)

    expect(mockDeletionGuard).toHaveBeenCalled()
    const before = mockDeletionGuard.mock.calls[0][0]
    const after = mockDeletionGuard.mock.calls[0][1]
    expect(after['en-US'] - before['en-US']).toBe(1)
  })

  it('should process locales in batches based on batchSize', async () => {
    const tempI18nConfig = { ...mockResolvedConfig.i18n, locales: ['en-US', 'es-ES', 'fr-FR'] }
    const tempConfig = {
      ...mockResolvedConfig,
      i18n: tempI18nConfig,
      limits: { ...mockResolvedConfig.limits, locale: 1 },
    }
    ;(resolveConfig as Mock).mockResolvedValue({ config: tempConfig })

    setupVirtualFile('locales/fr-FR.json', { existing: { key: 'Bonjour' } })

    const args = {
      ...baseArgsToRun,
      key: 'batch.test',
      _: ['batch.test', 'Batch test translation'],
      locale: 'all',
    }

    await addCommand.run!({ args } as any)

    expect(mockTranslateKeys).toHaveBeenCalledTimes(2)
  })
})
