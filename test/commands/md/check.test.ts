import type { MockedFunction } from 'vitest'
import type { DeepRequired } from '@/types'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { glob } from 'glob'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import checkCommand from '@/commands/check'
import * as configModule from '@/config'
import * as i18nConfigModule from '@/config/i18n'
import * as consoleModule from '@/utils/console'
import { baseArgsToRun, createVfsHelpers, mockI18nConfigResult, mockResolvedConfig } from '../../test-helpers'

const markdownMockResolvedConfig: DeepRequired<configModule.ResolvedConfig> = {
  ...mockResolvedConfig,
  adapter: ['markdown'],
  adapters: {
    json: {
      directory: 'locales',
      sort: 'def',
    },
    markdown: {
      files: ['**/*.md'],
      localesDir: '.lin/markdown',
      output: '{locale}/{path}',
    },
  },
}

vi.mock('glob', () => ({
  glob: vi.fn(() => Promise.resolve([])),
}))
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

describe('check command (MD)', () => {
  let mockReadFileSync: MockedFunction<typeof fs.readFileSync>
  let mockWriteFileSync: MockedFunction<typeof fs.writeFileSync>
  let mockExistsSync: MockedFunction<typeof fs.existsSync>
  let mockMkdirSync: MockedFunction<typeof fs.mkdirSync>
  let mockResolveConfig: MockedFunction<typeof configModule.resolveConfig>
  let mockLoadI18nConfig: MockedFunction<typeof i18nConfigModule.loadI18nConfig>
  let mockConsoleLog: MockedFunction<any>
  let mockGlob: MockedFunction<typeof glob>

  const { setupVirtualFile, resetVfs, getVfs } = createVfsHelpers()

  const sourceMarkdownContent = '# Title\n\nSome paragraph.'
  const sourceUnits = {
    'docs/index.md::heading[0]': 'Title',
    'docs/index.md::paragraph[0]': 'Some paragraph.',
  }
  const translatedUnits = {
    'docs/index.md::heading[0]': 'Título',
    'docs/index.md::paragraph[0]': 'Un párrafo.',
  }
  const defaultSnapshotPath = '.lin/markdown/en-US.json'
  const targetSnapshotPath = '.lin/markdown/es-ES.json'

  beforeEach(() => {
    vi.clearAllMocks()
    resetVfs()
    process.exitCode = 0

    mockReadFileSync = fs.readFileSync as MockedFunction<typeof fs.readFileSync>
    mockWriteFileSync = fs.writeFileSync as MockedFunction<typeof fs.writeFileSync>
    mockExistsSync = fs.existsSync as MockedFunction<typeof fs.existsSync>
    mockMkdirSync = fs.mkdirSync as MockedFunction<typeof fs.mkdirSync>
    mockResolveConfig = configModule.resolveConfig as MockedFunction<typeof configModule.resolveConfig>
    mockLoadI18nConfig = i18nConfigModule.loadI18nConfig as MockedFunction<typeof i18nConfigModule.loadI18nConfig>
    mockConsoleLog = vi.spyOn(consoleModule.console, 'log') as MockedFunction<any>
    mockGlob = glob as MockedFunction<typeof glob>

    mockResolveConfig.mockResolvedValue({ config: markdownMockResolvedConfig, sources: ['lin.config.js'], dependencies: [] })
    mockLoadI18nConfig.mockResolvedValue(mockI18nConfigResult)
    mockGlob.mockResolvedValue(['docs/index.md'])

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
      setupVirtualFile(filePath.toString(), data.toString())
    })
    mockExistsSync.mockImplementation((path) => {
      return getVfs()[path.toString().replace(/\\/g, '/')] !== undefined
    })
    mockMkdirSync.mockImplementation(() => undefined)

    const sourceMarkdownPath = path.join(markdownMockResolvedConfig.cwd, 'docs/index.md')
    setupVirtualFile(sourceMarkdownPath, sourceMarkdownContent)
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

  describe('source snapshot checks', () => {
    it('should report that source snapshot is up to date', async () => {
      setupVirtualFile(defaultSnapshotPath, sourceUnits)
      setupVirtualFile(targetSnapshotPath, translatedUnits)

      await runCheckCommand()

      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.success, 'Markdown source snapshot is up to date.')
    })

    it('should report new content blocks in source files', async () => {
      setupVirtualFile(defaultSnapshotPath, {})

      await runCheckCommand()

      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.warning, 'Found `2` new content blocks in source files not present in the default snapshot.')
      expect(process.exitCode).toBe(1)
    })

    it('should fix new content blocks with --fix', async () => {
      setupVirtualFile(defaultSnapshotPath, {})
      setupVirtualFile(targetSnapshotPath, {})

      await runCheckCommand({ fix: true })

      const newDefaultSnapshot = JSON.parse(getVfs()[defaultSnapshotPath])
      expect(newDefaultSnapshot).toEqual(sourceUnits)

      const newTargetSnapshot = JSON.parse(getVfs()[targetSnapshotPath])
      expect(newTargetSnapshot).toEqual({
        'docs/index.md::heading[0]': '',
        'docs/index.md::paragraph[0]': '',
      })

      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.success, 'Added `2` new content blocks to the default snapshot.')
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.success, 'Added `2` missing keys to **es-ES** markdown snapshot.')
    })

    it('should report unused content blocks in snapshot', async () => {
      const extraUnit = { 'docs/index.md::paragraph[1]': 'Old paragraph' }
      setupVirtualFile(defaultSnapshotPath, { ...sourceUnits, ...extraUnit })

      await runCheckCommand()

      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.warning, 'Found `1` unused keys in default snapshot (content removed from source files).')
      expect(process.exitCode).toBe(1)
    })

    it('should remove unused content blocks with --prune', async () => {
      const extraUnit = { 'docs/old.md::paragraph[0]': 'Old paragraph' }
      setupVirtualFile(defaultSnapshotPath, { ...sourceUnits, ...extraUnit })
      setupVirtualFile(targetSnapshotPath, { ...translatedUnits, ...extraUnit })

      await runCheckCommand({ prune: true })

      const newDefaultSnapshot = JSON.parse(getVfs()[defaultSnapshotPath])
      expect(newDefaultSnapshot).toEqual(sourceUnits)
      const newTargetSnapshot = JSON.parse(getVfs()[targetSnapshotPath])
      expect(newTargetSnapshot).toEqual(translatedUnits)

      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.success, 'Removed `1` unused keys from all markdown snapshots.')
    })
  })

  describe('target locale snapshot checks', () => {
    it('should report missing keys in target locale', async () => {
      setupVirtualFile(defaultSnapshotPath, sourceUnits)
      setupVirtualFile(targetSnapshotPath, {})

      await runCheckCommand()

      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.warning, 'Markdown for **es-ES** is missing `2` keys.')
      expect(process.exitCode).toBe(1)
    })

    it('should add missing keys to target locale with --fix', async () => {
      const partialUnits = { ...translatedUnits }
      delete (partialUnits as any)['docs/index.md::paragraph[0]']

      setupVirtualFile(defaultSnapshotPath, sourceUnits)
      setupVirtualFile(targetSnapshotPath, partialUnits)

      await runCheckCommand({ fix: true })

      const newTargetSnapshot = JSON.parse(getVfs()[targetSnapshotPath])
      expect(newTargetSnapshot).toEqual({
        ...partialUnits,
        'docs/index.md::paragraph[0]': '',
      })
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.success, 'Added `1` missing keys to **es-ES** markdown snapshot.')
    })

    it('should report unused keys in target locale', async () => {
      const extraUnit = { 'docs/index.md::paragraph[1]': 'Old paragraph' }
      setupVirtualFile(defaultSnapshotPath, sourceUnits)
      setupVirtualFile(targetSnapshotPath, { ...translatedUnits, ...extraUnit })

      await runCheckCommand()

      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.warning, 'Markdown for **es-ES** has `1` unused keys.')
      expect(process.exitCode).toBe(1)
    })

    it('should remove unused keys from target locale with --prune', async () => {
      const extraUnit = { 'docs/index.md::paragraph[1]': 'Old paragraph' }
      setupVirtualFile(defaultSnapshotPath, sourceUnits)
      setupVirtualFile(targetSnapshotPath, { ...translatedUnits, ...extraUnit })

      await runCheckCommand({ prune: true })

      const newTargetSnapshot = JSON.parse(getVfs()[targetSnapshotPath])
      expect(newTargetSnapshot).toEqual(translatedUnits)
      expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.success, 'Removed `1` unused keys from **es-ES** markdown snapshot.')
    })
  })

  describe('--silent flag', () => {
    it('should produce no output when everything is up to date', async () => {
      setupVirtualFile(defaultSnapshotPath, sourceUnits)
      setupVirtualFile(targetSnapshotPath, translatedUnits)

      await runCheckCommand({ silent: true })

      expect(mockConsoleLog).not.toHaveBeenCalled()
    })

    it('should not show detailed warnings', async () => {
      setupVirtualFile(defaultSnapshotPath, {})

      await runCheckCommand({ silent: true })

      // In silent mode, there should be no output for checks, only for fixes.
      // The exit code is what matters.
      expect(mockConsoleLog).not.toHaveBeenCalled()
      expect(process.exitCode).toBe(1)
    })

    it('should still fix files with --fix and --silent', async () => {
      setupVirtualFile(defaultSnapshotPath, {})
      setupVirtualFile(targetSnapshotPath, {})

      await runCheckCommand({ fix: true, silent: true })

      const newDefaultSnapshot = JSON.parse(getVfs()[defaultSnapshotPath])
      expect(newDefaultSnapshot).toEqual(sourceUnits)

      const newTargetSnapshot = JSON.parse(getVfs()[targetSnapshotPath])
      expect(newTargetSnapshot).toEqual({
        'docs/index.md::heading[0]': '',
        'docs/index.md::paragraph[0]': '',
      })

      // In silent mode, there should be no output.
      expect(mockConsoleLog).not.toHaveBeenCalled()
    })
  })
})
