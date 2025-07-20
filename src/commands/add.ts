import type { LocaleJson } from '@/utils'
import fs from 'node:fs'
import { text } from '@clack/prompts'
import { defineCommand } from 'citty'
import { allArgs, resolveConfig } from '@/config'
import { allAdapters } from '@/engine'
import {
  catchError,
  console,
  countKeys,
  deletionGuard,
  findNestedKey,
  ICONS,
  mergeMissingTranslations,
  normalizeLocales,
  provideSuggestions,
  r,
  resolveContextLocales,
  translateKeys,
} from '@/utils'
import { saveUndoState } from '@/utils/undo'

export default defineCommand({
  meta: {
    name: 'add',
    description: 'add a key to the locales with all the translations',
  },
  args: {
    ...allArgs,
    key: {
      type: 'positional',
      description: 'the key to add',
      required: true,
      valueHint: 'a.b.c',
    },
    translation: {
      type: 'positional',
      description: 'the text of the key for the default locale',
      required: false,
      valueHint: 'some translation text',
    },
    force: {
      alias: 'f',
      type: 'boolean',
      description: 'force add key overriding existing ones',
      default: false,
    },
    silent: {
      alias: 's',
      type: 'boolean',
      description: 'suppress all console output',
      default: false,
    },
  },
  async run({ args }) {
    const { config } = await resolveConfig(args)

    const adaptersToRun = Array.isArray(config.adapter) ? config.adapter : [config.adapter]

    for (const adapterId of adaptersToRun) {
      const adapter = allAdapters[adapterId as keyof typeof allAdapters]
      if (!adapter || !adapter.supportedCommands?.includes('add')) {
        if (config.debug)
          console.log(ICONS.info, `Skipping adapter **${adapterId}** for command \`add\`.`)
        continue
      }

      const i18n = config.i18n
      const batchSize = config.batchSize || Number.POSITIVE_INFINITY

      const key = args.key as string
      const positionalArgs = [...(args._ as string[])]
      positionalArgs.shift()
      let translation = positionalArgs.join(' ')
      const translationProvided = positionalArgs.length > 0

      const defaultLocaleJson = JSON.parse(fs.readFileSync(r(`${i18n.defaultLocale}.json`, i18n), { encoding: 'utf8' }))

      if (key.endsWith('.')) {
        provideSuggestions(defaultLocaleJson, key)
        return
      }

      if (!translationProvided) {
        const suggested = provideSuggestions(defaultLocaleJson, key, { suggestOnExact: true })
        if (suggested) {
          return
        }
        else {
          const promptValue = await text({
            message: `Enter ${i18n.defaultLocale} translation for key \`${key}\``,
            placeholder: 'Press [ENTER] to skip',
          })

          if (typeof promptValue === 'symbol' || promptValue === undefined || promptValue === '')
            return

          translation = promptValue
        }
      }

      const locales = typeof args.locale === 'string' ? [args.locale] : args.locale || []
      const localesToCheckRaw = locales.length > 0 ? locales : i18n.locales
      const localesToCheck = catchError(normalizeLocales)(localesToCheckRaw, i18n)

      const withOption = args.with !== undefined ? args.with : config.with

      if (args.debug) {
        console.log(ICONS.note, `Provider: \`${config.options.provider}\``)
        console.log(ICONS.note, `Model: \`${config.options.model}\``)
        if (config.options.temperature !== undefined)
          console.log(ICONS.note, `Temperature: \`${config.options.temperature}\``)
      }

      const keyCountsBefore: Record<string, number> = {}
      const keyCountsAfter: Record<string, number> = {}
      const translationsToWrite: Record<string, LocaleJson> = {}
      const finalTranslationsMap: Record<string, LocaleJson> = {}

      await console.loading(`Adding \`${key}\` to ${localesToCheck.map(l => `**${l}**`).join(', ')}`, async () => {
        const localeBatches: string[][] = []
        if (batchSize > 0) {
          for (let i = 0; i < localesToCheck.length; i += batchSize)
            localeBatches.push(localesToCheck.slice(i, i + batchSize))
        }
        else {
          localeBatches.push(localesToCheck)
        }

        for (const batch of localeBatches) {
          const withLocales = resolveContextLocales(withOption as any, i18n, batch)
          const withLocaleJsons: Record<string, LocaleJson> = {}
          for (const locale of withLocales) {
            try {
              withLocaleJsons[locale] = JSON.parse(fs.readFileSync(r(`${locale}.json`, i18n), { encoding: 'utf8' }))
            }
            catch (error: any) {
              if (config.debug) {
                if (error.code === 'ENOENT')
                  console.log(ICONS.info, `Skipping context for **${locale}** *(file not found)*`)
                else
                  console.log(ICONS.warning, `Could not read or parse context file for locale **${locale}**. Skipping.`)
              }
            }
          }
          const loadedContextLocales = Object.keys(withLocaleJsons)
          if (loadedContextLocales.length > 0)
            console.log(ICONS.info, `With: ${loadedContextLocales.map(l => `**${l}**`).join(', ')}`)

          const keysToTranslate: Record<string, LocaleJson> = {}
          const keysToTranslateAndDefault: Record<string, LocaleJson> = {}
          const toOverwrite: string[] = []

          for (const locale of batch) {
            let localeJson: LocaleJson
            try {
              localeJson = JSON.parse(fs.readFileSync(r(`${locale}.json`, i18n), { encoding: 'utf8' }))
            }
            catch (error: any) {
              if (error.code === 'ENOENT') {
                console.log(ICONS.warning, `File not found for locale **${locale}**. Creating a new one.`)
                localeJson = {}
              }
              else {
                throw error
              }
            }

            keyCountsBefore[locale] = countKeys(localeJson)

            if (findNestedKey(localeJson, args.key).value !== undefined) {
              if (args.force) {
                toOverwrite.push(locale)
              }
              else {
                console.log(ICONS.info, `Skipped: **${locale}**`)
                continue
              }
            }

            if (locale !== i18n.defaultLocale)
              keysToTranslate[locale] = { [args.key]: translation }

            keysToTranslateAndDefault[locale] = { [args.key]: translation }
          }

          if (toOverwrite.length > 0)
            console.log(ICONS.info, `Overwriting translation for locale${toOverwrite.length > 1 ? 's' : ''}: ${toOverwrite.map(l => `**${l}**`).join(', ')}`)

          if (args.debug)
            console.log(ICONS.info, `To translate: ${JSON.stringify(keysToTranslate)}`)

          if (Object.keys(keysToTranslateAndDefault).length > 0) {
            let translations: Record<string, LocaleJson>
            if (translation === '') {
              if (args.debug)
                console.log(ICONS.info, 'Empty translation provided, skipping LLM call.')
              translations = {}
              for (const locale of Object.keys(keysToTranslateAndDefault))
                translations[locale] = { [key]: translation }
            }
            else {
              translations = Object.keys(keysToTranslate).length > 0
                ? await translateKeys(keysToTranslate, config, i18n, withLocaleJsons)
                : {}

              if (keysToTranslateAndDefault[i18n.defaultLocale])
                translations[i18n.defaultLocale] = keysToTranslateAndDefault[i18n.defaultLocale]
            }

            if (args.debug)
              console.log(ICONS.info, `Translations: ${JSON.stringify(translations)}`)

            for (const [locale, newTranslations] of Object.entries(translations)) {
              const localeFilePath = r(`${locale}.json`, i18n)

              let existingTranslations = {}
              try {
                existingTranslations = JSON.parse(fs.readFileSync(localeFilePath, { encoding: 'utf8' }))
              }
              catch (error: any) {
                if (error.code !== 'ENOENT')
                  throw error
              }

              const finalTranslations = mergeMissingTranslations(existingTranslations, newTranslations)
              finalTranslationsMap[locale] = finalTranslations
              keyCountsAfter[locale] = countKeys(finalTranslations)
            }
          }
        }
      })

      for (const [locale, finalTranslations] of Object.entries(finalTranslationsMap)) {
        const localeFilePath = r(`${locale}.json`, i18n)
        translationsToWrite[localeFilePath] = finalTranslations
      }

      if (Object.keys(translationsToWrite).length > 0) {
        if (!args.silent)
          console.log(ICONS.note, `Keys: ${keyCountsAfter[i18n.defaultLocale]}`)

        const result = await deletionGuard(keyCountsBefore, keyCountsAfter, localesToCheck, args.silent)
        if (!result)
          return

        saveUndoState(Object.keys(translationsToWrite), config as any)
        for (const localePath of Object.keys(translationsToWrite))
          fs.writeFileSync(localePath, `${JSON.stringify(translationsToWrite[localePath], null, 2)}\n`, { encoding: 'utf8' })
      }
      else if (!args.silent) {
        console.log(ICONS.success, 'All locales are up to date.')
        console.log(ICONS.note, `Keys: ${countKeys(JSON.parse(fs.readFileSync(r(`${i18n.defaultLocale}.json`, i18n), { encoding: 'utf8' })))}`)
      }
    }
  },
})
