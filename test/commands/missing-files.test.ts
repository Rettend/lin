import type { Mock, Mocked } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import addCommand from '@/commands/add'
import checkCommand from '@/commands/check'
import syncCommand from '@/commands/sync'
import undoCommand from '@/commands/undo'
import { resolveConfig } from '@/config'
import { loadI18nConfig } from '@/config/i18n'
import * as llmUtils from '@/utils/llm'
import { UNDO_DIR, UNDO_FILE } from '@/utils/undo'
import { mockConsole, mockProcessStdout } from '../mocks/console.mock'
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

mockConsole()

const { setupVirtualFile, getVirtualFileContent, resetVfs, expectVirtualFileContent } = createVfsHelpers()
const mockFs = fs as Mocked<typeof fs>

describe('missing files and directories handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetVfs()

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
      setupVirtualFile(path.toString(), data.toString())
    })
    mockFs.existsSync.mockImplementation((path: fs.PathLike) => {
      const p = path.toString()
      if (getVirtualFileContent(p) !== undefined) return true
      if ((mockFs as any).__dirs && (mockFs as any).__dirs.has(p)) return true
      return false
    })
    
    // Mock mkdirSync to track created directories
    ;(mockFs as any).__dirs = new Set<string>()
    mockFs.mkdirSync.mockImplementation((path: fs.PathLike, _options) => {
      (mockFs as any).__dirs.add(path.toString())
      return undefined
    })

    mockProcessStdout()
  })

  afterEach(() => {
    resetVfs()
  })

  describe('sync command', () => {
    it('should create default locale file and directory if missing', async () => {
      const args = {
        ...baseArgsToRun,
        _: ['es-ES'],
        locale: ['es-ES'],
      }

      mockTranslateKeys.mockResolvedValueOnce({
        'es-ES': { greeting: 'Hello (es-ES)' },
      })

      await syncCommand.run!({ args } as any)

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('locales'), { recursive: true })
      expectVirtualFileContent('locales/en-US.json', {})
    })
  })

  describe('add command', () => {
    it('should create default locale file and directory if missing', async () => {
      const args = {
        ...baseArgsToRun,
        key: 'new.key',
        _: ['new.key', 'New Value'],
        locale: 'all',
      }

      await addCommand.run!({ args } as any)

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('locales'), { recursive: true })
    })
  })

  describe('check command', () => {
    it('should create directory when fixing missing keys', async () => {
      setupVirtualFile('locales/en-US.json', { key: 'value' })
      
      const args = {
        ...baseArgsToRun,
        keys: true,
        fix: true,
        locale: ['es-ES'],
      }

      await checkCommand.run!({ args } as any)

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('locales'), { recursive: true })
    })
  })

  describe('undo command', () => {
    it('should create directory when restoring a file', async () => {
      const undoFilePath = path.join(mockResolvedConfig.cwd, UNDO_DIR, UNDO_FILE)
      const targetFile = path.join(mockResolvedConfig.cwd, 'locales/restored.json')
      
      setupVirtualFile(undoFilePath, JSON.stringify({
        [targetFile]: JSON.stringify({ restored: true })
      }))

      await undoCommand.run!({ args: baseArgsToRun } as any)

      // The key fix: ensure we are checking against the correct path format
      // In tests, paths might be normalized or handled differently.
      // But here, we expect mkdirSync to be called with the dirname of targetFile.
      const expectedDir = path.dirname(targetFile)
      
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expectedDir, { recursive: true })
      expectVirtualFileContent(targetFile, { restored: true })
    })
  })
})
