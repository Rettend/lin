import type { Plugin } from 'vite'
import { loadI18nConfig } from './config/i18n'

export default function linVitePlugin(): Plugin {
  const virtualModuleId = 'virtual:lin/config'
  const resolvedVirtualModuleId = `\0${virtualModuleId}`

  return {
    name: 'vite-plugin-lin',
    resolveId(id) {
      if (id === virtualModuleId)
        return resolvedVirtualModuleId
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        const { i18n } = await loadI18nConfig()
        return `
          export const locales = ${JSON.stringify(i18n.locales)}
          export const defaultLocale = ${JSON.stringify(i18n.defaultLocale)}
        `
      }
    },
  }
}
