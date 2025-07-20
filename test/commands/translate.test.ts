import type { Mock, Mocked } from 'vitest'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import checkCommand from '@/commands/check'
import syncCommand from '@/commands/sync'
import translateCommand from '@/commands/translate'
import { resolveConfig } from '@/config'
import { saveUndoState } from '@/utils/undo'
import { baseArgsToRun, mockResolvedConfig } from '../test-helpers'

vi.mock('@/commands/check', () => ({
  default: {
    run: vi.fn(),
    meta: { name: 'check' },
  },
}))
vi.mock('@/commands/sync', () => ({
  default: {
    run: vi.fn(),
    meta: { name: 'sync' },
  },
}))
vi.mock('@/config', async () => {
  const actual = await vi.importActual('@/config')
  return {
    ...actual,
    resolveConfig: vi.fn(),
  }
})
vi.mock('@/utils/undo', () => ({
  saveUndoState: vi.fn(),
}))

const mockCheckRun = checkCommand.run as Mock
const mockSyncRun = syncCommand.run as Mock
const mockSaveUndoState = saveUndoState as Mocked<typeof saveUndoState>

describe('translate command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(resolveConfig as Mock).mockResolvedValue({ config: mockResolvedConfig })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should call check and sync commands with correct arguments', async () => {
    const args = {
      ...baseArgsToRun,
      _: [],
      silent: false,
      prune: false,
    }

    await translateCommand.run!({ args } as any)

    expect(mockCheckRun).toHaveBeenCalledOnce()
    expect(mockCheckRun).toHaveBeenCalledWith(expect.objectContaining({
      args: expect.objectContaining({
        ...args,
        silent: false,
        fix: true,
        keys: false,
        info: false,
        undo: false,
      }),
      rawArgs: [],
      cmd: checkCommand.meta,
    }))

    expect(mockSyncRun).toHaveBeenCalledOnce()
    expect(mockSyncRun).toHaveBeenCalledWith(expect.objectContaining({
      args: expect.objectContaining({
        ...args,
        force: false,
        undo: false,
        silent: false,
      }),
      rawArgs: [],
      cmd: syncCommand.meta,
    }))
  })

  it('should handle its own undo state when undo is enabled', async () => {
    const args = {
      ...baseArgsToRun,
      _: [],
      silent: true,
      undo: true,
    }
    const configWithUndo = { ...mockResolvedConfig, undo: true }
    ;(resolveConfig as Mock).mockResolvedValue({ config: configWithUndo })

    await translateCommand.run!({ args } as any)

    expect(mockSaveUndoState).toHaveBeenCalledOnce()
    expect(mockSaveUndoState).toHaveBeenCalledWith(
      [path.join('locales', 'en-US.json'), path.join('locales', 'es-ES.json')],
      configWithUndo,
    )

    expect(mockCheckRun).toHaveBeenCalledWith(expect.objectContaining({
      args: expect.objectContaining({ undo: false }),
    }))
    expect(mockSyncRun).toHaveBeenCalledWith(expect.objectContaining({
      args: expect.objectContaining({ undo: false }),
    }))
  })

  it('should not save undo state when undo is disabled in config', async () => {
    const args = {
      ...baseArgsToRun,
      _: [],
      silent: true,
      undo: false,
    }
    const configWithoutUndo = { ...mockResolvedConfig, undo: false }
    ;(resolveConfig as Mock).mockResolvedValue({ config: configWithoutUndo })

    await translateCommand.run!({ args } as any)

    expect(mockSaveUndoState).not.toHaveBeenCalled()
  })
})
