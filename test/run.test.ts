import type { Mock, Mocked } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveConfig } from '@/config'
import { loadI18nConfig } from '@/config/i18n'
import { run } from '@/run'
import { createVfsHelpers, mockI18nConfigResult, mockResolvedConfig } from './test-helpers'

const {
  setupVirtualFile,
  getVirtualFileContent,
  resetVfs,
} = createVfsHelpers()

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

const mockFs = fs as Mocked<typeof fs>

mockFs.readFileSync.mockImplementation((p: Parameters<typeof fs.readFileSync>[0]) => {
  const content = getVirtualFileContent(p.toString())
  if (content === undefined) {
    const err: any = new Error(`ENOENT: no such file or directory, open '${p.toString()}'`)
    err.code = 'ENOENT'
    throw err
  }
  return typeof content === 'string' ? content : JSON.stringify(content)
})
mockFs.existsSync.mockImplementation((p: fs.PathLike) => getVirtualFileContent(p.toString()) !== undefined)

const mockedResolveConfig = resolveConfig as Mock
const mockedLoadI18nConfig = loadI18nConfig as Mock

function seedLocales() {
  resetVfs()
  setupVirtualFile('locales/en-US.json', { hello: 'Hello' })
  setupVirtualFile('locales/es-ES.json', {})
}

const virtualCwd = path.resolve('/')

mockedResolveConfig.mockResolvedValue({ config: { ...mockResolvedConfig, cwd: virtualCwd } })
mockedLoadI18nConfig.mockResolvedValue(mockI18nConfigResult)

describe('run()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedLocales()

    const stdout = process.stdout as any
    stdout.moveCursor = vi.fn()
    stdout.cursorTo = vi.fn()
    stdout.clearLine = vi.fn()
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
    Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true })
  })

  it('should perform a dry run, capture output silently, and return intended writes', async () => {
    const { output, writes, deletes, result } = await run(
      'check',
      ['--keys', '--fix', '-l', 'es-ES'],
      { dry: true, output: 'silent' },
    )

    expect(result).toBeDefined()
    expect(output).toMatch(/Missing keys added|All locales are up to date/)

    expect(fs.existsSync('locales/es-ES.json')).toBe(true)
    const realEs = JSON.parse(mockFs.readFileSync('locales/es-ES.json', 'utf-8'))
    expect(realEs).toEqual({})

    expect(writes).toBeDefined()
    const esPath = path.join('locales', 'es-ES.json')
    expect(writes![esPath]).toContain('"hello"')
    expect(deletes).toEqual([])
  })

  it('should capture output while still printing when output="capture"', async () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any)

    await run('check', ['--keys', '--fix', '-l', 'es-ES'], { dry: true, output: 'capture' })

    expect(spy).toHaveBeenCalled()

    spy.mockRestore()
  })

  it('should behave normally when output="live" (no captured text returned)', async () => {
    const { output } = await run('models', [], { output: 'live', dry: true })
    expect(output).toBeUndefined()
  })
})
