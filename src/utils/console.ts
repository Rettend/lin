import { Console } from 'node:console'
import process from 'node:process'
import c from 'picocolors'
import { erase } from 'sisteransi'
import wrap from 'wrap-ansi'

export const ICONS = {
  success: c.green('✔'),
  error: c.red('✖'),
  warning: c.yellow('⚠'),
  info: c.blue('ℹ'),
  note: c.dim('●'),
  result: c.cyan('>.. '),
}

export function formatLog(message: any): string {
  if (typeof message !== 'string')
    return message

  return (message as string)
    .replace(/`([^`]+)`/g, (_, p1) => `${c.cyan(p1)}`)
    .replace(/\*\*([^*]+)\*\*/g, (_, p1) => `${c.bold(p1)}`)
    .replace(/\*([^*]+)\*/g, (_, p1) => `${c.italic(p1)}`)
    .replace(/__([^_]+)__/g, (_, p1) => `${c.underline(p1)}`)
}

export function generateScoreDots(score: number | undefined, color: (str: string) => string): string {
  if (score === undefined)
    return ''
  const filled = '●'
  const empty = '○'
  let dots = ''
  for (let i = 0; i < 5; i++)
    dots += i < score ? filled : empty

  return `${color(dots)} ${color(String(score))}`
}

class ConsoleExtended extends Console {
  public isInSection = false

  log(...messages: any[]): void {
    const prefix = this.isInSection ? '│ ' : ''
    let message = messages.map(m => formatLog(m)).join(' ')

    const iconValues = Object.values(ICONS)
    for (const icon of iconValues) {
      if (message.startsWith(icon)) {
        message = `${icon}  ${message.slice(icon.length).trimStart()}`
        break
      }
    }
    super.log(`${prefix}${message}`)
  }

  logL(...messages: any[]): void {
    const prefix = this.isInSection ? '│ ' : ''
    let message = messages.map(m => formatLog(m)).join(' ')

    const iconValues = Object.values(ICONS)
    for (const icon of iconValues) {
      if (message.startsWith(icon)) {
        message = `${icon}  ${message.slice(icon.length).trimStart()}`
        break
      }
    }
    process.stdout.write(`${prefix}${message}`)
  }

  async section<T>(title: string, callback: () => Promise<T>): Promise<T> {
    const header = `┌─ ${title}`
    process.stdout.write(`${c.dim(header)}\n`)

    this.isInSection = true
    const originalLog = this.log
    const originalWrite = process.stdout.write
    let capturedOutput = ''
    let hasWarning = false

    const customWrite = (chunk: any, ...args: any[]): boolean => {
      const str = chunk.toString()
      capturedOutput += str
      if (str.includes(ICONS.warning))
        hasWarning = true

      return originalWrite.call(process.stdout, chunk, ...args)
    }

    process.stdout.write = customWrite as any

    try {
      const result = await callback()

      const wrappedOutput = wrap(capturedOutput, process.stdout.columns, { hard: true, trim: false })
      const visibleLines = wrappedOutput.split('\n').length - 1

      // Move cursor back to the header line
      process.stdout.moveCursor(0, -(visibleLines + 1))
      process.stdout.cursorTo(0)
      process.stdout.write(erase.down())

      // Rewrite header with final color
      const colorizer = hasWarning ? c.yellow : c.green
      process.stdout.write(`${colorizer(header)}\n`)

      // Rewrite captured output with colored pipe
      const coloredPipe = colorizer('│')
      const rewrittenOutput = wrappedOutput
        .split('\n')
        .slice(0, -1)
        .map((line) => {
          if (!line.length)
            return line
          const i = line.indexOf('│ ')
          if (i !== -1)
            return line.substring(0, i) + coloredPipe + line.substring(i + 1)

          return `${coloredPipe} ${line}`
        })
        .join('\n')

      if (rewrittenOutput)
        process.stdout.write(`${rewrittenOutput}\n`)

      return result
    }
    catch (e: any) {
      this.log(ICONS.error, e.message)
      const wrappedOutput = wrap(capturedOutput, process.stdout.columns, { hard: true, trim: false })
      const visibleLines = wrappedOutput.split('\n').length - 1
      process.stdout.moveCursor(0, -(visibleLines + 1))
      process.stdout.cursorTo(0)
      process.stdout.write(erase.down())
      process.stdout.write(`${c.red(header)}\n`)
      const coloredPipe = c.red('│')
      const lines = wrappedOutput.split('\n')
      if (lines[lines.length - 1] === '')
        lines.pop()
      const rewrittenOutput = lines
        .map((line) => {
          if (!line.length)
            return line
          const i = line.indexOf('│ ')
          if (i !== -1)
            return line.substring(0, i) + coloredPipe + line.substring(i + 1)

          return `${coloredPipe} ${line}`
        })
        .join('\n')
      if (rewrittenOutput)
        process.stdout.write(`${rewrittenOutput}\n`)
      throw e
    }
    finally {
      this.isInSection = false
      this.log = originalLog
      process.stdout.write = originalWrite
    }
  }

  async loading<T>(message: string, callback: () => Promise<T>): Promise<T> {
    if (!process.stdout.isTTY) {
      this.log(`${ICONS.note} ${message}`)
      try {
        const result = await callback()
        this.log(`${ICONS.success} ${message}`)
        return result
      }
      catch (error) {
        this.log(`${ICONS.error} ${message}`)
        throw error
      }
    }

    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let i = 0
    const prefix = this.isInSection ? '│ ' : ''

    const interval = setInterval(() => {
      process.stdout.clearLine(0)
      process.stdout.cursorTo(0)
      process.stdout.write(`${prefix}${c.yellow(frames[i])} ${formatLog(message)}`)
      i = (i + 1) % frames.length
    }, 80)

    const stopLoading = (success: boolean) => {
      clearInterval(interval)
      process.stdout.clearLine(0)
      process.stdout.cursorTo(0)
      const symbol = success ? ICONS.success : ICONS.error
      this.log(`${symbol} ${message}`)
    }

    try {
      const result = await callback()
      stopLoading(true)
      return result
    }
    catch (errorFromCallback) {
      try {
        stopLoading(false)
      }
      catch (errorDuringCleanup) {
        super.log('Error during loading indicator cleanup:', errorDuringCleanup)
      }
      throw errorFromCallback
    }
  }
}

export const console = new ConsoleExtended(process.stdout, process.stderr)
