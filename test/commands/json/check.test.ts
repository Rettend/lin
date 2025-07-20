import type { MockedFunction } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { confirm } from '@clack/prompts'
import { glob } from 'glob'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import checkCommand from '@/commands/check'
import * as configModule from '@/config'
import * as i18nConfigModule from '@/config/i18n'
import * as utilsModule from '@/utils'
import * as consoleModule from '@/utils/console'
import { baseArgsToRun, createVfsHelpers, mockI18nConfigResult, mockResolvedConfig } from '../../test-helpers'

const actualNodePath = await vi.importActual<typeof path>('node:path')
const actualUtils = await vi.importActual<typeof utilsModule>('@/utils')

const mockParse = vi.fn()
vi.mock('i18next-parser', () => {
  const MockParserClass = vi.fn().mockImplementation(() => ({
    parse: mockParse,
  }))
  class MockBaseLexer {
    constructor() {}
    functionPattern() {
      return '(t|i18n.t)'
    }
  }
  return {
    default: MockParserClass,
    parser: MockParserClass,
    BaseLexer: MockBaseLexer,
  }
})
vi.mock('glob', () => ({
  glob: vi.fn(() => Promise.resolve([])),
}))
vi.mock('@clack/prompts')

vi.mock('node:fs')
vi.mock('node:process', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:process')>()
  return {
    default: {
      ...mod,
      exitCode: 0,
    },
  }
})
vi.mock('@/config')
vi.mock('@/config/i18n')
vi.mock('@/utils', async () => {
  const actual = await vi.importActual('@/utils') as typeof utilsModule
  return {
    ...actual,
    countKeys: vi.fn(),
    shapeMatches: vi.fn(),
    findMissingKeys: vi.fn(),
    sortKeys: vi.fn(),
    mergeMissingTranslations: vi.fn(),
    catchError: vi.fn((fn: any) => fn),
    checkArg: vi.fn(),
    normalizeLocales: vi.fn((locales, i18n) => actual.normalizeLocales(locales, i18n)),
    cleanupEmptyObjects: vi.fn(actual.cleanupEmptyObjects),
  }
})
vi.mock('@/utils/console', async () => {
  const actual = await vi.importActual('@/utils/console') as typeof consoleModule
  return {
    ...actual,
    console: {
      log: vi.fn(),
      logL: vi.fn(),
      loading: vi.fn((_message: string, callback: () => Promise<any>) => callback()),
      section: vi.fn(async (_title: string, callback: () => Promise<any>) => {
        return await callback()
      }),
    },
    ICONS: actual.ICONS,
  }
})
vi.mock('picocolors', () => ({
  default: {
    red: vi.fn(str => `red(${str})`),
    dim: vi.fn(str => `dim(${str})`),
    cyan: vi.fn(str => `cyan(${str})`),
    bold: vi.fn(str => `bold(${str})`),
    green: vi.fn(str => `green(${str})`),
    yellow: vi.fn(str => `yellow(${str})`),
    blue: vi.fn(str => `blue(${str})`),
    magenta: vi.fn(str => `magenta(${str})`),
    italic: vi.fn(str => `italic(${str})`),
    underline: vi.fn(str => `underline(${str})`),
  },
}))

describe('check command (JSON)', () => {
  let mockReadFileSync: MockedFunction<typeof fs.readFileSync>
  let mockWriteFileSync: MockedFunction<typeof fs.writeFileSync>
  let mockExistsSync: MockedFunction<typeof fs.existsSync>
  let mockResolveConfig: MockedFunction<typeof configModule.resolveConfig>
  let mockLoadI18nConfig: MockedFunction<typeof i18nConfigModule.loadI18nConfig>
  let mockConsoleLog: MockedFunction<any>
  let mockConsoleLogL: MockedFunction<any>
  let mockPathDirname: MockedFunction<typeof path.dirname>
  let mockPathBasename: MockedFunction<typeof path.basename>
  let mockCountKeys: MockedFunction<typeof utilsModule.countKeys>
  let mockShapeMatches: MockedFunction<typeof utilsModule.shapeMatches>
  let mockFindMissingKeys: MockedFunction<typeof utilsModule.findMissingKeys>
  let mockSortKeys: MockedFunction<typeof utilsModule.sortKeys>
  let mockMergeMissingTranslations: MockedFunction<typeof utilsModule.mergeMissingTranslations>
  let mockConfirm: MockedFunction<typeof confirm>
  let mockGlob: MockedFunction<typeof glob>

  const { setupVirtualFile, resetVfs, getVfs } = createVfsHelpers()

  const defaultEnJson = { a: 'Hello', b: 'World', c: { d: 'Nested' } }
  const completeEsJson = { a: 'Hola', b: 'Mundo', c: { d: 'Anidado' } }
  const incompleteEsJson = { a: 'Hola' }

  beforeEach(() => {
    vi.clearAllMocks()
    resetVfs()
    process.exitCode = 0

    mockReadFileSync = fs.readFileSync as MockedFunction<typeof fs.readFileSync>
    mockWriteFileSync = fs.writeFileSync as MockedFunction<typeof fs.writeFileSync>
    mockExistsSync = fs.existsSync as MockedFunction<typeof fs.existsSync>
    mockResolveConfig = configModule.resolveConfig as MockedFunction<typeof configModule.resolveConfig>
    mockLoadI18nConfig = i18nConfigModule.loadI18nConfig as MockedFunction<typeof i18nConfigModule.loadI18nConfig>
    mockConsoleLog = vi.spyOn(consoleModule.console, 'log') as MockedFunction<any>
    mockConsoleLogL = vi.spyOn(consoleModule.console, 'logL') as MockedFunction<any>
    mockPathDirname = vi.spyOn(path, 'dirname') as MockedFunction<typeof path.dirname>
    mockPathBasename = vi.spyOn(path, 'basename') as MockedFunction<typeof path.basename>
    mockConfirm = confirm as MockedFunction<typeof confirm>
    mockGlob = glob as MockedFunction<typeof glob>

    mockCountKeys = utilsModule.countKeys as MockedFunction<typeof utilsModule.countKeys>
    mockShapeMatches = utilsModule.shapeMatches as MockedFunction<typeof utilsModule.shapeMatches>
    mockFindMissingKeys = utilsModule.findMissingKeys as MockedFunction<typeof utilsModule.findMissingKeys>
    mockSortKeys = utilsModule.sortKeys as MockedFunction<typeof utilsModule.sortKeys>
    mockMergeMissingTranslations = utilsModule.mergeMissingTranslations as MockedFunction<typeof utilsModule.mergeMissingTranslations>

    mockShapeMatches.mockReturnValue(true)
    mockFindMissingKeys.mockReturnValue({})
    mockMergeMissingTranslations.mockImplementation(actualUtils.mergeMissingTranslations)

    mockResolveConfig.mockResolvedValue({ config: mockResolvedConfig, sources: ['lin.config.js'], dependencies: [] })
    mockLoadI18nConfig.mockResolvedValue(mockI18nConfigResult)
    mockCountKeys.mockImplementation(obj => actualUtils.countKeys(obj))

    mockReadFileSync.mockImplementation((filePath) => {
      const fsMap = getVfs()
      const normalizedPath = filePath.toString().replace(/\\/g, '/')
      const rawFileContent = fsMap[normalizedPath]
      if (rawFileContent === undefined) {
        const error = new Error(`ENOENT: no such file or directory, open '${filePath.toString()}'`)
        // @ts-expect-error - code is a property of NodeJS.ErrnoException
        error.code = 'ENOENT'
        throw error
      }
      return rawFileContent
    })
    mockWriteFileSync.mockImplementation((filePath, data) => {
      setupVirtualFile(filePath.toString(), JSON.parse(data.toString()))
    })
    mockExistsSync.mockImplementation((path) => {
      return getVfs()[path.toString().replace(/\\/g, '/')] !== undefined
    })

    setupVirtualFile('locales/en-US.json', defaultEnJson)
    setupVirtualFile('locales/es-ES.json', completeEsJson)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const runCheckCommand = (args: Record<string, any> = {}) => {
    const fullArgs = { ...baseArgsToRun, sort: undefined, locale: undefined, fix: false, info: false, keys: false, prune: false, silent: false, ...args }
    return checkCommand.run?.({
      args: fullArgs as any,
      rawArgs: [],
      cmd: checkCommand.meta as any,
    })
  }

  describe('info flag', () => {
    it('should show info when --info flag is passed', async () => {
      mockResolveConfig.mockResolvedValue({ config: mockResolvedConfig, sources: ['/path/to/lin.config.js'], dependencies: [] })
      mockLoadI18nConfig.mockResolvedValue({ ...mockI18nConfigResult, sources: ['/path/to/i18n.config.ts'] })
      mockPathDirname.mockImplementation(p => actualNodePath.dirname(p))
      mockPathBasename.mockImplementation(p => actualNodePath.basename(p))

      await runCheckCommand({ info: true })

      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.note, `Lin config path: /path/to\\\`lin.config.js\``)
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.note, `I18n config path: /path/to\\\`i18n.config.ts\``)
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.note, `Provider: \`openai\``)
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.note, `Model: \`gpt-4.1-mini\``)
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.note, `Temperature: \`0.7\``)
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.note, 'Keys: `3`')
      expect(mockConsoleLogL.mock.calls[0][1]).toContain('Locales (`2`): ')
      expect(mockConsoleLogL.mock.calls[1][0]).toContain('**en-US** (`3`)')
    })

    it('should not show info by default', async () => {
      await runCheckCommand()
      expect(mockConsoleLog).not.toHaveBeenCalledWith(consoleModule.ICONS.note, expect.stringContaining('Lin config path'))
      expect(mockConsoleLog).not.toHaveBeenCalledWith(consoleModule.ICONS.note, expect.stringContaining('I18n config path'))
    })
  })

  describe('[Mode: Code Analysis (default)]', () => {
    beforeEach(() => {
      mockGlob.mockResolvedValue(['src/test.ts'])
      setupVirtualFile('src/test.ts', 'const t = (key) => key;')
    })

    it('should report that all keys are in sync', async () => {
      mockParse.mockReturnValue([{ key: 'a' }, { key: 'b' }, { key: 'c.d' }])
      setupVirtualFile('locales/en-US.json', defaultEnJson)

      await runCheckCommand()

      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.success, 'All keys are in sync.')
    })

    it('should report missing keys', async () => {
      mockParse.mockReturnValue([{ key: 'a' }, { key: 'new.key' }])
      setupVirtualFile('locales/en-US.json', { a: '1' })

      await runCheckCommand()

      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.warning, 'Found `1` missing keys in default locale')
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.note, 'Samples: `new.key`')
    })

    it('should fix missing keys with --fix', async () => {
      mockParse.mockReturnValue([{ key: 'a' }, { key: 'new.key' }])
      setupVirtualFile('locales/en-US.json', { a: '1' })

      await runCheckCommand({ fix: true })

      const updatedJson = JSON.parse(getVfs()['locales/en-US.json'])
      expect(updatedJson).toEqual({ a: '1', new: { key: '' } })
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.success, 'Missing keys added.')
    })

    it('should fix missing keys with --fix and use default value', async () => {
      mockParse.mockReturnValue([{ key: 'a' }, { key: 'new.key', defaultValue: 'New Key Default' }])
      setupVirtualFile('locales/en-US.json', { a: '1' })

      await runCheckCommand({ fix: true })

      const updatedJson = JSON.parse(getVfs()['locales/en-US.json'])
      expect(updatedJson).toEqual({ a: '1', new: { key: 'New Key Default' } })
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.success, 'Missing keys added.')
    })

    it('should report unused keys', async () => {
      mockParse.mockReturnValue([{ key: 'a' }])
      setupVirtualFile('locales/en-US.json', { a: '1', b: '2' })

      await runCheckCommand()

      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.warning, 'Found `1` unused keys in default locale')
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.note, 'Samples: `b`')
    })

    it('should remove unused keys with --prune', async () => {
      mockConfirm.mockResolvedValue(true)
      mockParse.mockReturnValue([{ key: 'a' }])
      setupVirtualFile('locales/en-US.json', { a: '1', b: '2' })
      setupVirtualFile('locales/es-ES.json', { a: 'uno', b: 'dos' })

      await runCheckCommand({ prune: true })

      expect(mockConfirm).toHaveBeenCalled()

      const enJson = JSON.parse(getVfs()['locales/en-US.json'])
      expect(enJson).toEqual({ a: '1' })

      const esJson = JSON.parse(getVfs()['locales/es-ES.json'])
      expect(esJson).toEqual({ a: 'uno' })

      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.success, 'Unused keys removed.')
    })
  })

  describe('[Mode: Key Comparison (`--keys`)]', () => {
    it('should log success if all locales are up to date', async () => {
      mockFindMissingKeys.mockReturnValue({})
      await runCheckCommand({ keys: true })
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.success, 'All locales are up to date.')
    })

    it('should report missing keys and set exit code to 1', async () => {
      setupVirtualFile('locales/es-ES.json', incompleteEsJson)
      mockFindMissingKeys.mockReturnValue({ 'b': 'World', 'c.d': 'Nested' })

      await runCheckCommand({ keys: true })

      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.warning, 'Locale **es-ES** is missing `2` keys')
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.note, 'Samples: `b`, `c.d`')
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.error, 'Missing keys detected. Run with `--fix` to add empty keys.')
      expect(process.exitCode).toBe(1)
      expect(mockWriteFileSync).not.toHaveBeenCalled()
    })
  })

  describe('fix flag (with --keys flag)', () => {
    it('should add missing keys with empty strings when --fix is used', async () => {
      setupVirtualFile('locales/es-ES.json', incompleteEsJson)
      mockFindMissingKeys.mockReturnValue({ 'b': 'World', 'c.d': 'Nested' })

      await runCheckCommand({ keys: true, fix: true })

      const expectedJson = { a: 'Hola', b: '', c: { d: '' } }
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('es-ES.json'),
        `${JSON.stringify(expectedJson, null, 2)}\n`,
        { encoding: 'utf8' },
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.success, 'Missing keys added successfully.')
      expect(process.exitCode).toBe(0)
    })
  })

  describe('sorting', () => {
    it('should sort alphabetically when sort arg is "abc"', async () => {
      const unsortedJson = { b: 'World', a: 'Hello' }
      const sortedJson = { a: 'Hello', b: 'World' }
      setupVirtualFile('locales/en-US.json', unsortedJson)
      setupVirtualFile('locales/es-ES.json', unsortedJson)
      mockShapeMatches.mockReturnValue(true)
      mockSortKeys.mockImplementation((obj, _ref) => {
        const sorted: any = {}
        Object.keys(obj).sort().forEach(key => sorted[key] = obj[key])
        return sorted
      })

      await runCheckCommand({ sort: 'abc' })

      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.info, 'Sorting locales **alphabetically**')
      expect(mockWriteFileSync).toHaveBeenCalledTimes(2)
      expect(mockWriteFileSync).toHaveBeenCalledWith(expect.stringContaining('en-US.json'), `${JSON.stringify(sortedJson, null, 2)}\n`, { encoding: 'utf8' })
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.success, 'Sorted locales: **en-US**, **es-ES**')
    })

    it('should skip sorting for locales that are not up to date', async () => {
      setupVirtualFile('locales/es-ES.json', incompleteEsJson)
      mockShapeMatches.mockReturnValueOnce(true).mockReturnValueOnce(false)
      mockFindMissingKeys.mockReturnValue({ 'b': 'World', 'c.d': 'Nested' })
      mockSortKeys.mockImplementation((obj, _ref) => obj)

      await runCheckCommand({ sort: 'abc' })

      expect(mockConsoleLog).toHaveBeenCalledWith(
        consoleModule.ICONS.warning,
        expect.stringContaining('Locale **es-ES** is not up to date. Skipping...'),
        expect.anything(),
      )
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1) // only en-US
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.success, 'Sorted locales: **en-US**')
    })
  })

  describe('--silent flag', () => {
    beforeEach(() => {
      mockGlob.mockResolvedValue(['src/test.ts'])
      setupVirtualFile('src/test.ts', 'const t = (key) => key;')
    })

    it('should produce minimal output for missing keys', async () => {
      mockParse.mockReturnValue([{ key: 'a' }, { key: 'new.key' }])
      setupVirtualFile('locales/en-US.json', { a: '1' })

      await runCheckCommand({ silent: true })

      expect(mockConsoleLog).toHaveBeenCalledWith('Missing keys: 1')
      expect(mockConsoleLog).not.toHaveBeenCalledWith(consoleModule.ICONS.warning, expect.any(String))
    })

    it('should produce minimal output for unused keys', async () => {
      mockParse.mockReturnValue([{ key: 'a' }])
      setupVirtualFile('locales/en-US.json', { a: '1', b: '2' })

      await runCheckCommand({ silent: true })

      expect(mockConsoleLog).toHaveBeenCalledWith('Unused keys: 1')
      expect(mockConsoleLog).not.toHaveBeenCalledWith(consoleModule.ICONS.warning, expect.any(String))
    })

    it('should not show a confirmation prompt when removing unused keys', async () => {
      mockConfirm.mockResolvedValue(false) // Should be ignored
      mockParse.mockReturnValue([{ key: 'a' }])
      setupVirtualFile('locales/en-US.json', { a: '1', b: '2' })
      setupVirtualFile('locales/es-ES.json', { a: 'uno', b: 'dos' })

      await runCheckCommand({ prune: true, silent: true })

      expect(mockConfirm).not.toHaveBeenCalled()
      const enJson = JSON.parse(getVfs()['locales/en-US.json'])
      expect(enJson).toEqual({ a: '1' })
    })

    it('should not use the loading spinner', async () => {
      const mockConsoleLoading = vi.spyOn(consoleModule.console, 'loading')
      mockParse.mockReturnValue([{ key: 'a' }, { key: 'b' }, { key: 'c.d' }])
      setupVirtualFile('locales/en-US.json', defaultEnJson)

      await runCheckCommand({ silent: true })

      expect(mockConsoleLoading).not.toHaveBeenCalled()
    })
  })
})
