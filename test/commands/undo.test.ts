import type { MockedFunction } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import undoCommand from '@/commands/undo'
import * as configModule from '@/config'
import * as consoleModule from '@/utils/console'
import { UNDO_DIR, UNDO_FILE, UNDO_FILE_NON_EXISTENT } from '@/utils/undo'
import { baseArgsToRun, mockResolvedConfig } from '../test-helpers'

vi.mock('node:fs')
vi.mock('@/config')
vi.mock('@/utils/console', async () => {
  const actual = await vi.importActual('@/utils/console')
  return {
    ...actual,
    console: {
      log: vi.fn(),
      loading: vi.fn((_message: string, callback: () => Promise<any>) => callback()),
    },
    ICONS: {
      success: '✓',
      info: 'ℹ',
    },
  }
})

describe('undo command', () => {
  let mockReadFileSync: MockedFunction<typeof fs.readFileSync>
  let mockWriteFileSync: MockedFunction<typeof fs.writeFileSync>
  let mockUnlinkSync: MockedFunction<typeof fs.unlinkSync>
  let mockExistsSync: MockedFunction<typeof fs.existsSync>
  let mockResolveConfig: MockedFunction<typeof configModule.resolveConfig>
  let mockConsoleLog: MockedFunction<any>
  let vfs: Record<string, string>

  const undoFileVfsKey = path.join(mockResolvedConfig.cwd, UNDO_DIR, UNDO_FILE).replace(/\\/g, '/')

  beforeEach(() => {
    vi.clearAllMocks()
    vfs = {}

    mockReadFileSync = fs.readFileSync as MockedFunction<typeof fs.readFileSync>
    mockWriteFileSync = fs.writeFileSync as MockedFunction<typeof fs.writeFileSync>
    mockUnlinkSync = fs.unlinkSync as MockedFunction<typeof fs.unlinkSync>
    mockExistsSync = fs.existsSync as MockedFunction<typeof fs.existsSync>
    mockResolveConfig = configModule.resolveConfig as MockedFunction<typeof configModule.resolveConfig>
    mockConsoleLog = consoleModule.console.log as MockedFunction<typeof consoleModule.console.log>

    mockResolveConfig.mockResolvedValue({ config: mockResolvedConfig, sources: ['lin.config.js'], dependencies: [] })

    mockExistsSync.mockImplementation(p => Object.prototype.hasOwnProperty.call(vfs, p.toString().replace(/\\/g, '/')))
    mockReadFileSync.mockImplementation((p) => {
      const pathStr = p.toString().replace(/\\/g, '/')
      if (vfs[pathStr])
        return vfs[pathStr]
      throw new Error(`ENOENT: no such file or directory, open '${p.toString()}'`)
    })
    mockWriteFileSync.mockImplementation((p, data) => {
      vfs[p.toString().replace(/\\/g, '/')] = data as string
    })
    mockUnlinkSync.mockImplementation((p) => {
      delete vfs[p.toString().replace(/\\/g, '/')]
    })
  })

  it('should log "Nothing to undo." if undo file does not exist', async () => {
    mockExistsSync.mockReturnValue(false)
    await undoCommand.run?.({
      args: baseArgsToRun as any,
      rawArgs: [],
      cmd: undoCommand.meta as any,
    })

    expect(mockConsoleLog).toHaveBeenCalledWith(consoleModule.ICONS.info, 'Nothing to undo.')
    expect(mockWriteFileSync).not.toHaveBeenCalled()
    expect(mockUnlinkSync).not.toHaveBeenCalled()
  })

  it('should restore files from the undo state and delete the undo file', async () => {
    const localeFilePath1 = path.join(mockResolvedConfig.adapters.json?.directory || '', 'en-US.json').replace(/\\/g, '/')
    const localeFilePath2 = path.join(mockResolvedConfig.adapters.json?.directory || '', 'es-ES.json').replace(/\\/g, '/')

    const originalContent1 = { greeting: 'Hello' }
    const stringifiedOriginalContent1 = JSON.stringify(originalContent1, null, 2)

    const undoData = {
      [localeFilePath1]: stringifiedOriginalContent1,
      [localeFilePath2]: UNDO_FILE_NON_EXISTENT,
    }

    vfs[undoFileVfsKey] = JSON.stringify(undoData)
    vfs[localeFilePath1] = JSON.stringify({ greeting: 'Hello', farewell: 'Goodbye' })
    vfs[localeFilePath2] = JSON.stringify({ greeting: 'Hola' })

    await undoCommand.run?.({
      args: baseArgsToRun as any,
      rawArgs: [],
      cmd: undoCommand.meta as any,
    })

    expect(vfs[localeFilePath1]).toBe(stringifiedOriginalContent1)
    expect(vfs[localeFilePath2]).toBeUndefined()
    expect(vfs[undoFileVfsKey]).toBeUndefined()

    expect(mockWriteFileSync).toHaveBeenCalledWith(localeFilePath1, stringifiedOriginalContent1, 'utf-8')
    expect(mockUnlinkSync).toHaveBeenCalledWith(localeFilePath2)
    const expectedUndoFilePath = path.join(mockResolvedConfig.cwd, UNDO_DIR, UNDO_FILE)
    expect(mockUnlinkSync).toHaveBeenCalledWith(expectedUndoFilePath)
  })
})
