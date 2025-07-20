import type { DeepRequired } from '..'
import type { ResolvedConfig } from '@/config'
import path from 'node:path'
import process from 'node:process'

const cwd = process.env.INIT_CWD || process.cwd()
export function r(file: string, config: DeepRequired<ResolvedConfig>) {
  if (config.adapter === 'json' || (Array.isArray(config.adapter) && config.adapter.includes('json')))
    return path.join(config.adapters?.json?.directory || 'locales', file)

  return path.join(cwd, file)
}
