import type { LocaleJson } from '@/utils'
import { jsonAdapter } from './json'
import { markdownAdapter } from './markdown'

export interface FormatAdapter {
  /**
   * (Optional) The set of CLI commands this adapter supports.
   * Used by commands to gate functionality.
   */
  supportedCommands?: string[]

  /**
   * Extract translatable units from a given file.
   * The returned object should be a flat map where keys are unique identifiers
   * (e.g. path::paragraph[0]) and values are the original text.
   */
  extract: (filePath: string, source: string) => Record<string, string>

  /**
   * Render the file with the provided translations applied.
   * Returns the new file text and a flag indicating if a change was made.
   */
  render: (
    filePath: string,
    source: string,
    translations: LocaleJson,
  ) => { text: string, changed: boolean }
}

export { jsonAdapter } from './json'
export { markdownAdapter } from './markdown'

export const allAdapters = {
  json: jsonAdapter,
  markdown: markdownAdapter,
}
