import type { LocaleJson } from '../utils'
import fs from 'node:fs'
import { defineCommand } from 'citty'
import { allAdapters } from '@/engine'
import { allArgs, resolveConfig } from '../config'
import { loadI18nConfig } from '../config/i18n'
import { console, findNestedKey, ICONS, normalizeLocales, provideSuggestions, r } from '../utils'
import { saveUndoState } from '../utils/undo'

export default defineCommand({
  meta: {
    name: 'del',
    description: 'remove one or more keys from every locale',
  },
  args: {
    ...allArgs,
    key: {
      type: 'positional',
      description: 'the keys to remove (space-separated)',
      required: true,
      valueHint: 'a.b.c',
    },
  },
  async run({ args }) {
    const { config } = await resolveConfig(args)

    const adaptersToRun = Array.isArray(config.adapter) ? config.adapter : [config.adapter]

    for (const adapterId of adaptersToRun) {
      const adapter = allAdapters[adapterId as keyof typeof allAdapters]
      if (!adapter || !adapter.supportedCommands?.includes('del')) {
        if (config.debug)
          console.log(ICONS.info, `Skipping adapter **${adapterId}** for command \`del\`.`)
        continue
      }

      const { i18n } = await loadI18nConfig(config as any)

      const keys = args._ as string[]
      if (keys.length === 1) {
        const defaultLocaleJson = JSON.parse(fs.readFileSync(r(`${i18n.defaultLocale}.json`, config), { encoding: 'utf8' })) as LocaleJson
        if (provideSuggestions(defaultLocaleJson, keys[0]))
          return
      }

      let locales = typeof args.locale === 'string' ? [args.locale] : args.locale || []
      locales = normalizeLocales(locales, i18n)
      const localesToCheck = locales.length > 0 ? locales : i18n.locales

      const filesToModify = localesToCheck.map(locale => r(`${locale}.json`, config))
      saveUndoState(filesToModify, config as any)

      const deletedKeysByLocale: Record<string, string[]> = {}

      for (const locale of localesToCheck) {
        const localeJson = JSON.parse(fs.readFileSync(r(`${locale}.json`, config), { encoding: 'utf8' })) as LocaleJson

        for (const key of keys) {
          const nestedKey = findNestedKey(localeJson, key.trim())
          if (nestedKey.value !== undefined) {
            nestedKey.delete()

            if (!deletedKeysByLocale[locale])
              deletedKeysByLocale[locale] = []

            deletedKeysByLocale[locale].push(key)
            fs.writeFileSync(r(`${locale}.json`, config), `${JSON.stringify(localeJson, null, 2)}\n`, { encoding: 'utf8' })
          }
          else {
            console.log(ICONS.info, `Skipped: **${locale}** *(key \`${key}\` not found)*`)
          }
        }
      }

      const deletedLocalesByKey: Record<string, string[]> = {}

      for (const locale in deletedKeysByLocale) {
        for (const key of deletedKeysByLocale[locale]) {
          if (!deletedLocalesByKey[key])
            deletedLocalesByKey[key] = []
          deletedLocalesByKey[key].push(locale)
        }
      }

      for (const key of Object.keys(deletedLocalesByKey))
        console.log(ICONS.success, `Deleted key \`${key}\` from ${deletedLocalesByKey[key].map(l => `**${l}**`).join(', ')}`)
    }
  },
})
