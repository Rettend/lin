import type { MockedFunction } from 'vitest'
import fs from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import delCommand from '@/commands/del'
import * as configModule from '@/config'
import * as i18nConfigModule from '@/config/i18n'
import * as consoleModule from '@/utils/console'
import { baseArgsToRun, createVfsHelpers, mockI18nConfigResult, mockResolvedConfig } from '../test-helpers'

vi.mock('node:fs')
vi.mock('@/config')
vi.mock('@/config/i18n')
vi.mock('@/utils/console', async () => {
  const actual = await vi.importActual('@/utils/console')
  return {
    ...actual,
    console: {
      log: vi.fn(),
      logL: vi.fn(),
      loading: vi.fn((_message: string, callback: () => Promise<any>) => callback()),
    },
    ICONS: {
      success: '✓',
      info: 'ℹ',
    },
    formatLog: vi.fn(str => str),
  }
})

describe('del command', () => {
  let mockReadFileSync: MockedFunction<typeof fs.readFileSync>
  let mockWriteFileSync: MockedFunction<typeof fs.writeFileSync>
  let mockResolveConfig: MockedFunction<typeof configModule.resolveConfig>
  let mockLoadI18nConfig: MockedFunction<typeof i18nConfigModule.loadI18nConfig>
  let mockConsoleLog: MockedFunction<any>

  const { setupVirtualFile, getVirtualFileContent, expectVirtualFileContent, resetVfs } = createVfsHelpers()

  beforeEach(() => {
    vi.clearAllMocks()
    resetVfs()

    mockReadFileSync = fs.readFileSync as MockedFunction<typeof fs.readFileSync>
    mockWriteFileSync = fs.writeFileSync as MockedFunction<typeof fs.writeFileSync>
    mockResolveConfig = configModule.resolveConfig as MockedFunction<typeof configModule.resolveConfig>
    mockLoadI18nConfig = i18nConfigModule.loadI18nConfig as MockedFunction<typeof i18nConfigModule.loadI18nConfig>
    mockConsoleLog = consoleModule.console.log as MockedFunction<typeof consoleModule.console.log>

    mockResolveConfig.mockResolvedValue({ config: mockResolvedConfig, sources: ['lin.config.js'], dependencies: [] })
    mockLoadI18nConfig.mockResolvedValue(mockI18nConfigResult)

    mockReadFileSync.mockImplementation((path) => {
      const fileContent = getVirtualFileContent(path.toString())
      if (fileContent !== undefined)
        return JSON.stringify(fileContent, null, 2)

      const error = new Error(`ENOENT: no such file or directory, open '${path.toString()}'`)
      // @ts-expect-error - code is a property of NodeJS.ErrnoException
      error.code = 'ENOENT'
      throw error
    })

    mockWriteFileSync.mockImplementation((path, data) => {
      try {
        const jsonData = JSON.parse(data as string)
        setupVirtualFile(path.toString(), jsonData)
      }
      catch (e) {
        console.error('Data written by command was not valid JSON:', data, e)
        throw new Error('Test setup error: Data written by command to VFS was not valid JSON string for setupVirtualFile')
      }
    })
  })

  it('should be ready for test cases', () => {
    expect(true).toBe(true)
  })

  it('should delete a single top-level key from all configured locales', async () => {
    setupVirtualFile('locales/en-US.json', { greeting: 'Hello', farewell: 'Goodbye' })
    setupVirtualFile('locales/es-ES.json', { greeting: 'Hola', farewell: 'Adiós' })

    const argsToRun = {
      ...baseArgsToRun,
      _: ['greeting'],
      key: 'greeting',
      locale: undefined,
    }

    await delCommand.run?.({
      args: argsToRun as any,
      rawArgs: ['greeting'],
      cmd: delCommand.meta as any,
    })

    expect(mockWriteFileSync).toHaveBeenCalledTimes(2)
    if (mockResolvedConfig.adapters?.json) {
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        `${mockResolvedConfig.adapters.json.directory}\\en-US.json`,
        `${JSON.stringify({ farewell: 'Goodbye' }, null, 2)}\n`,
        { encoding: 'utf8' },
      )
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        `${mockResolvedConfig.adapters.json.directory}\\es-ES.json`,
        `${JSON.stringify({ farewell: 'Adiós' }, null, 2)}\n`,
        { encoding: 'utf8' },
      )
    }

    expectVirtualFileContent('locales/en-US.json', { farewell: 'Goodbye' })
    expectVirtualFileContent('locales/es-ES.json', { farewell: 'Adiós' })

    expect(mockConsoleLog).toHaveBeenCalledWith(
      consoleModule.ICONS.success,
      'Deleted key `greeting` from **en-US**, **es-ES**',
    )
  })

  it('should skip and log when a key is not found in one locale but delete from another', async () => {
    setupVirtualFile('locales/en-US.json', { onlyKey: 'Hello' })
    setupVirtualFile('locales/es-ES.json', { keyToDelete: 'Hola', anotherKey: 'Adiós' })
    setupVirtualFile('locales/fr-FR.json', { keyToDelete: 'Bonjour', yetAnother: 'Au revoir' })

    const tempI18nConfig = { ...mockResolvedConfig.i18n, locales: ['en-US', 'es-ES', 'fr-FR'] }
    const tempConfig = { ...mockResolvedConfig, i18n: tempI18nConfig }
    mockResolveConfig.mockResolvedValue({ config: tempConfig, sources: ['lin.config.js'], dependencies: [] })
    mockLoadI18nConfig.mockResolvedValue({
      i18n: tempI18nConfig,
      sources: ['i18n.config.js'],
    })

    const argsToRun = {
      ...baseArgsToRun,
      _: ['keyToDelete'],
      key: 'keyToDelete',
      locale: undefined,
    }

    await delCommand.run?.({
      args: argsToRun as any,
      rawArgs: ['keyToDelete'],
      cmd: delCommand.meta as any,
    })

    expect(mockWriteFileSync).toHaveBeenCalledTimes(2)
    if (tempConfig.adapters?.json) {
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        `${tempConfig.adapters.json.directory}\\es-ES.json`,
        `${JSON.stringify({ anotherKey: 'Adiós' }, null, 2)}\n`,
        { encoding: 'utf8' },
      )
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        `${tempConfig.adapters.json.directory}\\fr-FR.json`,
        `${JSON.stringify({ yetAnother: 'Au revoir' }, null, 2)}\n`,
        { encoding: 'utf8' },
      )
    }

    expectVirtualFileContent('locales/en-US.json', { onlyKey: 'Hello' })
    expectVirtualFileContent('locales/es-ES.json', { anotherKey: 'Adiós' })
    expectVirtualFileContent('locales/fr-FR.json', { yetAnother: 'Au revoir' })

    expect(mockConsoleLog).toHaveBeenCalledWith(
      consoleModule.ICONS.info,
      'Skipped: **en-US** *(key `keyToDelete` not found)*',
    )
    expect(mockConsoleLog).toHaveBeenCalledWith(
      consoleModule.ICONS.success,
      'Deleted key `keyToDelete` from **es-ES**, **fr-FR**',
    )

    mockResolveConfig.mockResolvedValue({ config: mockResolvedConfig, sources: ['lin.config.js'], dependencies: [] })
    mockLoadI18nConfig.mockResolvedValue(mockI18nConfigResult)
  })

  it('should throw an error if a configured locale file is missing', async () => {
    setupVirtualFile('locales/en-US.json', { keyToDelete: 'Hello' })

    const testLocales = ['en-US', 'de-DE']
    const tempI18nConfig = { ...mockResolvedConfig.i18n, locales: testLocales }
    const tempConfig = { ...mockResolvedConfig, i18n: tempI18nConfig }
    mockResolveConfig.mockResolvedValue({ config: tempConfig, sources: ['lin.config.js'], dependencies: [] })
    mockLoadI18nConfig.mockResolvedValue({
      i18n: tempI18nConfig,
      sources: ['i18n.config.js'],
    })

    const argsToRun = {
      ...baseArgsToRun,
      _: ['keyToDelete'],
      key: 'keyToDelete',
      locale: undefined,
    }

    await expect(delCommand.run?.({
      args: argsToRun as any,
      rawArgs: ['keyToDelete'],
      cmd: delCommand.meta as any,
    })).rejects.toThrow(/ENOENT: no such file or directory/)

    expect(mockWriteFileSync).toHaveBeenCalledTimes(1)
    if (tempConfig.adapters?.json) {
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        `${tempConfig.adapters.json.directory}\\en-US.json`,
        `${JSON.stringify({}, null, 2)}\n`,
        { encoding: 'utf8' },
      )
    }
    expectVirtualFileContent('locales/en-US.json', {})

    mockResolveConfig.mockResolvedValue({ config: mockResolvedConfig, sources: ['lin.config.js'], dependencies: [] })
    mockLoadI18nConfig.mockResolvedValue(mockI18nConfigResult)
  })

  it('should delete a key from a specific locale when specified with -l', async () => {
    setupVirtualFile('locales/en-US.json', { greeting: 'Hello', farewell: 'Goodbye' })
    setupVirtualFile('locales/es-ES.json', { greeting: 'Hola', farewell: 'Adiós' })

    const argsToRun = {
      ...baseArgsToRun,
      _: ['greeting'],
      key: 'greeting',
      locale: ['en-US'],
    }

    await delCommand.run?.({
      args: argsToRun as any,
      rawArgs: ['greeting', '-l', 'en-US'],
      cmd: delCommand.meta as any,
    })

    expect(mockWriteFileSync).toHaveBeenCalledTimes(1)
    if (mockResolvedConfig.adapters?.json) {
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        `${mockResolvedConfig.adapters.json.directory}\\en-US.json`,
        `${JSON.stringify({ farewell: 'Goodbye' }, null, 2)}\n`,
        { encoding: 'utf8' },
      )
    }

    expectVirtualFileContent('locales/en-US.json', { farewell: 'Goodbye' })
    expectVirtualFileContent('locales/es-ES.json', { greeting: 'Hola', farewell: 'Adiós' })

    expect(mockConsoleLog).toHaveBeenCalledWith(
      consoleModule.ICONS.success,
      'Deleted key `greeting` from **en-US**',
    )
    expect(mockConsoleLog).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('es-ES'),
    )
  })
})
