import process from 'node:process'
import { vi } from 'vitest'
import * as consoleUtils from '@/utils/console'
import * as generalUtils from '@/utils/general'

export function mockConsole() {
  const mockConsoleLog = vi.spyOn(consoleUtils.console, 'log')
  vi.spyOn(consoleUtils.console, 'logL')
  const mockConsoleLoading = vi.spyOn(consoleUtils.console, 'loading').mockImplementation(async (_message, callback) => {
    await callback()
  })
  vi.spyOn(generalUtils, 'catchError').mockImplementation(fn => fn as any)

  return {
    mockConsoleLog,
    mockConsoleLoading,
  }
}

export function mockProcessStdout() {
  const stdout = process.stdout as any
  stdout.moveCursor = vi.fn()
  stdout.cursorTo = vi.fn()
  stdout.clearLine = vi.fn()
  stdout.write = vi.fn()
  Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
  Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true })
}
