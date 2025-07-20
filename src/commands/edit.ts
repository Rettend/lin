import type { LocaleJson } from '../utils'
import fs from 'node:fs'
import { defineCommand } from 'citty'
import { allAdapters } from '@/engine'
import { allArgs, resolveConfig } from '../config'
import { console, ICONS, normalizeLocales, provideSuggestions, r } from '../utils'
import { saveUndoState } from '../utils/undo'

export default defineCommand({
  meta: {
    name: 'edit',
    description: 'edit a key in one or more locales',
  },
  args: {
    ...allArgs,
    key: {
      type: 'positional',
      description: 'the key to edit',
      required: true,
      valueHint: 'a.b.c',
    },
    value: {
      type: 'positional',
      description: 'the new value for the key',
      required: true,
      valueHint: 'The new translation',
    },
  },
  async run({ args }) {
    const { config } = await resolveConfig(args)

    const adaptersToRun = Array.isArray(config.adapter) ? config.adapter : [config.adapter]

    for (const adapterId of adaptersToRun) {
      const adapter = allAdapters[adapterId as keyof typeof allAdapters]
      if (!adapter || !adapter.supportedCommands?.includes('edit')) {
        if (config.debug)
          console.log(ICONS.info, `Skipping adapter **${adapterId}** for command \`edit\`.`)
        continue
      }

      const i18n = config.i18n

      const defaultLocaleJson = JSON.parse(fs.readFileSync(r(`${i18n.defaultLocale}.json`, i18n), { encoding: 'utf8' }))
      if (provideSuggestions(defaultLocaleJson, args.key as string))
        return

      let locales = typeof args.locale === 'string' ? [args.locale] : args.locale || []
      locales = normalizeLocales(locales, i18n)
      const localesToCheck = locales.length > 0 ? locales : i18n.locales

      const key = args.key as string
      const positionalArgs = [...(args._ as string[])]
      positionalArgs.shift()
      const value = positionalArgs.join(' ')

      const editedKeysByLocale: Record<string, string[]> = {}
      const contentsToWrite: Record<string, string> = {}

      for (const locale of localesToCheck) {
        const localeJsonPath = r(`${locale}.json`, i18n)
        let localeJson: LocaleJson
        try {
          localeJson = JSON.parse(fs.readFileSync(localeJsonPath, { encoding: 'utf8' })) as LocaleJson
        }
        catch (error: any) {
          if (error.code === 'ENOENT') {
            console.log(ICONS.info, `Skipped: **${locale}** *(file not found)*`)
            continue
          }
          else {
            throw error
          }
        }

        const keysArr = key.split('.')
        let current: any = localeJson
        for (let i = 0; i < keysArr.length - 1; i++)
          current = current?.[keysArr[i]]

        const lastKey = keysArr[keysArr.length - 1]
        if (current && typeof current === 'object' && lastKey in current) {
          current[lastKey] = value

          if (!editedKeysByLocale[locale])
            editedKeysByLocale[locale] = []

          editedKeysByLocale[locale].push(key)
          contentsToWrite[localeJsonPath] = `${JSON.stringify(localeJson, null, 2)}\n`
        }
        else {
          console.log(ICONS.info, `Skipped: **${locale}** *(key \`${key}\` not found)*`)
        }
      }

      if (Object.keys(contentsToWrite).length > 0) {
        saveUndoState(Object.keys(contentsToWrite), config as any)
        for (const [filePath, content] of Object.entries(contentsToWrite))
          fs.writeFileSync(filePath, content, { encoding: 'utf8' })
      }

      const editedLocalesByKey: Record<string, string[]> = {}

      for (const locale in editedKeysByLocale) {
        for (const key of editedKeysByLocale[locale]) {
          if (!editedLocalesByKey[key])
            editedLocalesByKey[key] = []
          editedLocalesByKey[key].push(locale)
        }
      }

      for (const key of Object.keys(editedLocalesByKey))
        console.log(ICONS.success, `Edited key \`${key}\` in ${editedLocalesByKey[key].map(l => `**${l}**`).join(', ')}`)
    }
  },
})
