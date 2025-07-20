import type { Literal, Parent, Root } from 'mdast'
import type { FormatAdapter } from './index'
import matter from 'gray-matter'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'
import { SKIP, visit } from 'unist-util-visit'
import { flattenObject } from '@/utils'

interface ExtractionState {
  paragraph: number
  heading: number
  listItem: number
}

function makeKey(relPath: string, type: keyof ExtractionState, index: number): string {
  return `${relPath}::${type}[${index}]`
}

function getRelativeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^[./]+/, '')
}

export const markdownAdapter: FormatAdapter = {
  supportedCommands: ['check', 'sync', 'translate'],

  extract(filePath: string, source: string) {
    const { content: mdContent, data: frontmatter } = matter(source)

    const relPath = getRelativeFilePath(filePath)
    const units: Record<string, string> = {}

    for (const [k, v] of Object.entries(frontmatter)) {
      if (typeof v === 'string')
        units[`${relPath}::frontmatter.${k}`] = v
    }

    const tree = unified().use(remarkParse).use(remarkMdx).parse(mdContent) as Root
    const counters: ExtractionState = { paragraph: 0, heading: 0, listItem: 0 }

    visit(tree, (node) => {
      const skipTypes = ['code', 'inlineCode', 'html', 'jsx']
      if (skipTypes.includes(node.type))
        return SKIP

      switch (node.type) {
        case 'paragraph': {
          const index = counters.paragraph++
          const text = getLiteralText(node as Parent)
          if (text.trim())
            units[makeKey(relPath, 'paragraph', index)] = text
          break
        }
        case 'heading': {
          const index = counters.heading++
          const text = getLiteralText(node as Parent)
          if (text.trim())
            units[makeKey(relPath, 'heading', index)] = text
          break
        }
        case 'listItem': {
          const index = counters.listItem++
          const text = getLiteralText(node as Parent)
          if (text.trim())
            units[makeKey(relPath, 'listItem', index)] = text
          break
        }
      }
    })

    return units
  },

  render(filePath: string, source: string, translations: Record<string, string | object>) {
    let changed = false

    const relPath = getRelativeFilePath(filePath)
    const { content: mdContent, data: frontmatter } = matter(source)
    const flatTranslations = flattenObject(translations)

    let fmChanged = false
    const newFrontmatter: Record<string, any> = { ...frontmatter }
    for (const key of Object.keys(frontmatter)) {
      const tKey = `${relPath}::frontmatter.${key}`
      if (flatTranslations[tKey] && flatTranslations[tKey] !== frontmatter[key]) {
        newFrontmatter[key] = flatTranslations[tKey]
        fmChanged = true
      }
    }

    const tree = unified().use(remarkParse).use(remarkMdx).parse(mdContent) as Root
    const counters: ExtractionState = { paragraph: 0, heading: 0, listItem: 0 }

    visit(tree, (node) => {
      const skipTypes = ['code', 'inlineCode', 'html', 'jsx']
      if (skipTypes.includes((node as any).type))
        return SKIP

      let tKey: string | undefined
      switch (node.type) {
        case 'paragraph':
          tKey = makeKey(relPath, 'paragraph', counters.paragraph++)
          break
        case 'heading':
          tKey = makeKey(relPath, 'heading', counters.heading++)
          break
        case 'listItem':
          tKey = makeKey(relPath, 'listItem', counters.listItem++)
          break
      }
      if (tKey && flatTranslations[tKey]) {
        const parent = node as Parent
        replaceLiteralText(parent, flatTranslations[tKey] as string)
        changed = true
      }
    })

    const processed = unified()
      .use(remarkStringify as any, { bullet: '-', fences: true, entities: 'escape' } as any)
      .stringify(tree as any) as string

    let finalText = processed
    if (fmChanged) {
      const matterResult = matter.stringify(processed, newFrontmatter)
      finalText = matterResult
      changed = true
    }

    return { text: finalText, changed }
  },
}

function getLiteralText(parent: Parent): string {
  let result = ''
  for (const child of parent.children) {
    if ('value' in child && typeof (child as Literal).value === 'string')
      result += (child as Literal).value
    else if ((child as Parent).children)
      result += getLiteralText(child as Parent)
  }
  return result
}

function replaceLiteralText(parent: Parent, newText: string) {
  let applied = false
  for (const child of parent.children) {
    if ('value' in child && typeof (child as Literal).value === 'string' && !applied) {
      (child as Literal).value = newText
      applied = true
    }
    else if ((child as Parent).children && !applied) {
      replaceLiteralText(child as Parent, newText)
    }
  }
}
