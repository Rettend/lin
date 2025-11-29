import { BaseLexer } from 'i18next-parser'

export class SvelteLexer extends BaseLexer {
  extract(content: string, filename?: string | undefined): any[] {
    const keys: any[] = []
    const pattern = new RegExp(`(?:^|[^\\w$])${this.functionPattern()}\\(\\s*(['"\`])(.+?)\\1(?:\\s*,\\s*(['"\`])(.+?)\\3)?\\s*\\)`, 'g')
    let match: RegExpExecArray | null = null
    do {
      match = pattern.exec(content)
      if (match) {
        const key = match[2]
        const defaultValue = match[4]
        if (key)
          keys.push(defaultValue ? { key, defaultValue, file: filename } : { key, file: filename })
      }
    } while (match)

    return keys
  }
}
