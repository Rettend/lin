import type { LocaleJson } from '@/utils'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { confirm } from '@clack/prompts'
import { defineCommand } from 'citty'
import { glob } from 'glob'
import * as i18nextParser from 'i18next-parser'
import c from 'picocolors'
import { commonArgs, resolveConfig } from '@/config'
import { loadI18nConfig } from '@/config/i18n'
import { markdownAdapter } from '@/engine'
import {
  catchError,
  checkArg,
  cleanupEmptyObjects,
  console,
  countKeys,
  findMissingKeys,
  findNestedKey,
  flattenObject,
  getAllKeys,
  ICONS,
  mergeMissingTranslations,
  normalizeLocales,
  r,
  saveUndoState,
  shapeMatches,
  sortKeys,
} from '@/utils'

export default defineCommand({
  meta: {
    name: 'check',
    description: 'validate locale files and optionally fix missing keys or sort them',
  },
  args: {
    ...commonArgs,
    silent: {
      alias: 'S',
      type: 'boolean',
      description: 'show minimal, script-friendly output',
      default: false,
    },
    sort: {
      alias: 's',
      type: 'string',
      description: 'sort the locales alphabetically or according to the default locale',
      required: false,
      valueHint: 'abc | def',
    },
    keys: {
      alias: 'k',
      type: 'boolean',
      description: 'check for missing keys in other locales compared to the default locale',
      default: false,
    },
    prune: {
      alias: 'u',
      type: 'boolean',
      description: 'remove unused keys from all locales',
      default: false,
    },
    fix: {
      alias: 'f',
      type: 'boolean',
      description: 'add missing keys with empty string values instead of erroring',
      default: false,
    },
    info: {
      alias: 'i',
      type: 'boolean',
      description: 'show detailed info about config and locales',
      default: false,
    },
  },
  async run({ args }) {
    const { config, sources: configSources } = await resolveConfig(args)
    const { i18n, sources: i18nSources } = await loadI18nConfig(config as any)

    const adaptersToRun = Array.isArray(config.adapter) ? config.adapter : [config.adapter]

    for (const adapterId of adaptersToRun) {
      await console.section(`${adapterId.toUpperCase()}`, async () => {
        if (adapterId === 'markdown') {
          const markdownConfig = config.adapters.markdown
          if (!markdownConfig || markdownConfig.files.length === 0)
            return

          const files = await glob(markdownConfig.files, { cwd: config.cwd })
          if (files.length === 0) {
            if (config.debug)
              console.log(ICONS.info, `No markdown files found for glob: ${markdownConfig.files.join(', ')}`)
            return
          }

          let currentSourceUnits: Record<string, string> = {}
          for (const file of files) {
            const absolutePath = path.join(config.cwd, file)
            const content = fs.readFileSync(absolutePath, 'utf-8')
            const units = markdownAdapter.extract(file, content)
            currentSourceUnits = { ...currentSourceUnits, ...units }
          }

          const localesDir = markdownConfig.localesDir || '.lin/markdown'
          if (!fs.existsSync(localesDir))
            fs.mkdirSync(localesDir, { recursive: true })

          const sourceSnapshotPath = path.join(localesDir, `${i18n.defaultLocale}.json`)
          let sourceSnapshot: Record<string, string> = {}
          if (fs.existsSync(sourceSnapshotPath)) {
            try {
              const potentiallyNested = JSON.parse(fs.readFileSync(sourceSnapshotPath, 'utf-8'))
              sourceSnapshot = flattenObject(potentiallyNested)
            }
            catch {
              console.log(ICONS.error, `Could not parse source snapshot: ${sourceSnapshotPath}`)
              return
            }
          }

          const findMissingFlat = (a: Record<string, string>, b: Record<string, string>) =>
            Object.fromEntries(Object.entries(a).filter(([key]) => !Object.prototype.hasOwnProperty.call(b, key)))

          const missingFromSnapshot = findMissingFlat(currentSourceUnits, sourceSnapshot)
          const unusedInSnapshot = findMissingFlat(sourceSnapshot, currentSourceUnits)

          let sourceWasModified = false
          if (args.fix && Object.keys(missingFromSnapshot).length > 0) {
            sourceWasModified = true
            sourceSnapshot = { ...sourceSnapshot, ...missingFromSnapshot }
            fs.writeFileSync(sourceSnapshotPath, JSON.stringify(sourceSnapshot, null, 2), 'utf-8')
            if (!args.silent)
              console.log(ICONS.success, `Added \`${Object.keys(missingFromSnapshot).length}\` new content blocks to the default snapshot.`)

            const missingEmpty: Record<string, string> = {}
            for (const key of Object.keys(missingFromSnapshot))
              missingEmpty[key] = ''

            for (const locale of i18n.locales.filter(l => l !== i18n.defaultLocale)) {
              const targetSnapshotPath = path.join(localesDir, `${locale}.json`)
              let targetUnits: Record<string, string> = {}
              if (fs.existsSync(targetSnapshotPath)) {
                const potentiallyNested = JSON.parse(fs.readFileSync(targetSnapshotPath, 'utf-8'))
                targetUnits = flattenObject(potentiallyNested)
              }

              const merged = { ...targetUnits, ...missingEmpty }
              fs.writeFileSync(targetSnapshotPath, JSON.stringify(merged, null, 2), 'utf-8')
              if (!args.silent)
                console.log(ICONS.success, `Added \`${Object.keys(missingFromSnapshot).length}\` missing keys to **${locale}** markdown snapshot.`)
            }
          }

          if (args.prune && Object.keys(unusedInSnapshot).length > 0) {
            sourceWasModified = true
            for (const locale of i18n.locales) {
              const snapshotPath = path.join(localesDir, `${locale}.json`)
              if (!fs.existsSync(snapshotPath))
                continue
              const snapshotContent = flattenObject(JSON.parse(fs.readFileSync(snapshotPath, 'utf-8')))
              for (const key of Object.keys(unusedInSnapshot))
                delete snapshotContent[key]

              fs.writeFileSync(snapshotPath, JSON.stringify(snapshotContent, null, 2), 'utf-8')
            }
            if (!args.silent)
              console.log(ICONS.success, `Removed \`${Object.keys(unusedInSnapshot).length}\` unused keys from all markdown snapshots.`)

            if (fs.existsSync(sourceSnapshotPath)) {
              const potentiallyNested = JSON.parse(fs.readFileSync(sourceSnapshotPath, 'utf-8'))
              sourceSnapshot = flattenObject(potentiallyNested)
            }
            else {
              sourceSnapshot = {}
            }
          }

          const hasSourceIssues
            = (Object.keys(missingFromSnapshot).length > 0 && !args.fix)
              || (Object.keys(unusedInSnapshot).length > 0 && !args.prune)

          if (hasSourceIssues) {
            if (Object.keys(missingFromSnapshot).length > 0 && !args.fix) {
              if (!args.silent) {
                console.log(ICONS.warning, `Found \`${Object.keys(missingFromSnapshot).length}\` new content blocks in source files not present in the default snapshot.`)
                const sample = Object.keys(missingFromSnapshot).slice(0, 5)
                if (sample.length > 0)
                  console.log(ICONS.note, `Samples: ${sample.map(k => `\`${k}\``).join(', ')}${Object.keys(missingFromSnapshot).length > sample.length ? '...' : ''}`)
              }
            }

            if (Object.keys(unusedInSnapshot).length > 0 && !args.prune) {
              if (!args.silent) {
                console.log(ICONS.warning, `Found \`${Object.keys(unusedInSnapshot).length}\` unused keys in default snapshot (content removed from source files).`)
                const sample = Object.keys(unusedInSnapshot).slice(0, 5)
                if (sample.length > 0)
                  console.log(ICONS.note, `Samples: ${sample.map(k => `\`${k}\``).join(', ')}${Object.keys(unusedInSnapshot).length > sample.length ? '...' : ''}`)
              }
            }
            if (!args.silent)
              console.log(ICONS.info, `Run with \`--fix\` to add missing content or \`--prune\` to remove unused content from snapshots.`)
            process.exitCode = 1
            return
          }

          if (!sourceWasModified) {
            if (Object.keys(missingFromSnapshot).length === 0 && Object.keys(unusedInSnapshot).length === 0) {
              if (!args.silent)
                console.log(ICONS.success, `Markdown source snapshot is up to date.`)
            }
          }

          let hasIssues = false
          const localesToProcess = i18n.locales.filter(l => l !== i18n.defaultLocale)
          for (const locale of localesToProcess) {
            const targetSnapshotPath = path.join(localesDir, `${locale}.json`)
            let targetUnits: Record<string, string> = {}
            if (fs.existsSync(targetSnapshotPath)) {
              const potentiallyNested = JSON.parse(fs.readFileSync(targetSnapshotPath, 'utf-8'))
              targetUnits = flattenObject(potentiallyNested)
            }

            const missingKeys = findMissingFlat(sourceSnapshot, targetUnits)
            const unusedKeys = findMissingFlat(targetUnits, sourceSnapshot)

            if (Object.keys(missingKeys).length > 0)
              hasIssues = true
            if (Object.keys(unusedKeys).length > 0)
              hasIssues = true

            const fixedInThisRun = args.fix && Object.keys(missingKeys).length > 0
            if (fixedInThisRun) {
              const missingEmpty: Record<string, string> = {}
              for (const key of Object.keys(missingKeys))
                missingEmpty[key] = ''
              const merged = { ...targetUnits, ...missingEmpty }
              fs.writeFileSync(targetSnapshotPath, JSON.stringify(merged, null, 2), 'utf-8')
              if (!args.silent)
                console.log(ICONS.success, `Added \`${Object.keys(missingKeys).length}\` missing keys to **${locale}** markdown snapshot.`)
            }

            const prunedInThisRun = args.prune && Object.keys(unusedKeys).length > 0
            if (prunedInThisRun) {
              for (const key of Object.keys(unusedKeys))
                delete targetUnits[key]

              fs.writeFileSync(targetSnapshotPath, JSON.stringify(targetUnits, null, 2), 'utf-8')
              if (!args.silent)
                console.log(ICONS.success, `Removed \`${Object.keys(unusedKeys).length}\` unused keys from **${locale}** markdown snapshot.`)
            }

            if (!fixedInThisRun && !prunedInThisRun && !sourceWasModified && !args.silent) {
              if (Object.keys(missingKeys).length === 0 && Object.keys(unusedKeys).length === 0) {
                if (!args.silent)
                  console.log(ICONS.success, `Markdown for **${locale}** is up to date.`)
              }
              else {
                if (Object.keys(missingKeys).length > 0) {
                  if (!args.silent)
                    console.log(ICONS.warning, `Markdown for **${locale}** is missing \`${Object.keys(missingKeys).length}\` keys.`)
                }

                if (Object.keys(unusedKeys).length > 0) {
                  if (!args.silent)
                    console.log(ICONS.warning, `Markdown for **${locale}** has \`${Object.keys(unusedKeys).length}\` unused keys.`)
                }
              }
            }
          }

          if (hasIssues && !args.fix && !args.prune) {
            if (!args.silent)
              console.log(ICONS.info, `Run with \`--fix\` to add missing translations or \`--prune\` to remove unused ones.`)
            process.exitCode = 1
          }
        }
        if (adapterId === 'json') {
          let locales = typeof args.locale === 'string' ? [args.locale] : args.locale || []
          locales = catchError(normalizeLocales)(locales, i18n)
          const localesToCheck = locales.length > 0 ? locales : i18n.locales

          let defaultLocaleJson: LocaleJson = {}
          try {
            defaultLocaleJson = JSON.parse(fs.readFileSync(r(`${i18n.defaultLocale}.json`, config), { encoding: 'utf8' }))
          }
          catch (error: any) {
            if (error.code !== 'ENOENT' && !(error instanceof SyntaxError))
              throw error
          }
          const defaultKeyCount = countKeys(defaultLocaleJson)

          if (args.info) {
            if (configSources.length === 0)
              console.log(ICONS.error, 'Lin config not found')
            else
              console.log(ICONS.note, `Lin config path: ${path.dirname(configSources[0])}\\\`${path.basename(configSources[0])}\``)

            if (i18nSources.length === 0)
              console.log(ICONS.error, 'I18n config not found')
            else
              console.log(ICONS.note, `I18n config path: ${path.dirname(i18nSources[0])}\\\`${path.basename(i18nSources[0])}\``)

            console.log(ICONS.note, `Provider: \`${config.options.provider}\``)
            console.log(ICONS.note, `Model: \`${config.options.model}\``)
            if (config.options.temperature !== undefined)
              console.log(ICONS.note, `Temperature: \`${config.options.temperature}\``)

            console.log(ICONS.note, `Keys: \`${defaultKeyCount}\``)
            console.logL(ICONS.note, `Locale${localesToCheck.length > 1 ? 's' : ''} (\`${localesToCheck.length}\`): `)
            for (const locale of localesToCheck) {
              try {
                const localeJson = JSON.parse(fs.readFileSync(r(`${locale}.json`, config), { encoding: 'utf8' }))
                const keyCount = countKeys(localeJson)
                console.logL(`**${locale}** (\`${keyCount}\`) `)
              }
              catch {
                console.logL(c.red(`**${locale}**`), `(${ICONS.error}) `)
              }
            }
            console.log()
            return
          }

          checkArg(args.sort, ['abc', 'def'])
          if (args.sort) {
            let sortFn = sortKeys
            if (args.sort === 'def')
              sortFn = (obj: any) => sortKeys(obj, defaultLocaleJson)

            console.log(ICONS.info, `Sorting locales ${args.sort === 'abc' ? '**alphabetically**' : 'according to **default locale**'}`)

            const successfullySortedLocales: string[] = []
            const filesToModify = localesToCheck.filter(locale => fs.existsSync(r(`${locale}.json`, config))).map(locale => r(`${locale}.json`, config))
            saveUndoState(filesToModify, config as any)

            for (const locale of localesToCheck) {
              const localeFilePath = r(`${locale}.json`, config)
              if (!fs.existsSync(localeFilePath))
                continue
              const localeJson = JSON.parse(fs.readFileSync(localeFilePath, { encoding: 'utf8' }))
              if (!shapeMatches(defaultLocaleJson, localeJson)) {
                const defaultLarger = defaultKeyCount > countKeys(localeJson)
                const missingKeys = defaultLarger ? findMissingKeys(defaultLocaleJson, localeJson) : findMissingKeys(localeJson, defaultLocaleJson)
                console.log(ICONS.warning, `Locale **${locale}** is not up to date. Skipping...`, c.dim(`(found ${defaultLarger ? 'missing' : 'extra'}: ${Object.keys(missingKeys)})`))
                continue
              }
              fs.writeFileSync(localeFilePath, `${JSON.stringify(sortFn(localeJson), null, 2)}\n`, { encoding: 'utf8' })
              successfullySortedLocales.push(locale)
            }

            if (successfullySortedLocales.length > 0)
              console.log(ICONS.success, `Sorted locales: ${successfullySortedLocales.map(l => `**${l}**`).join(', ')}`)
            return
          }

          if (args.keys) {
            const missingKeysByLocale: Record<string, LocaleJson> = {}

            for (const locale of localesToCheck) {
              const localePath = r(`${locale}.json`, config)
              let localeJson: LocaleJson
              try {
                localeJson = JSON.parse(fs.readFileSync(localePath, { encoding: 'utf8' }))
              }
              catch (error: any) {
                if (error.code === 'ENOENT') {
                  console.log(ICONS.error, `File not found for locale **${locale}**.`)
                  localeJson = {}
                }
                else { throw error }
              }

              const missingKeys = findMissingKeys(defaultLocaleJson, localeJson)
              if (Object.keys(missingKeys).length > 0)
                missingKeysByLocale[locale] = missingKeys
            }

            if (Object.keys(missingKeysByLocale).length === 0) {
              console.log(ICONS.success, 'All locales are up to date.')
              return
            }

            for (const [locale, missing] of Object.entries(missingKeysByLocale)) {
              console.log(ICONS.warning, `Locale **${locale}** is missing \`${Object.keys(missing).length}\` keys`)
              if (!args.fix) {
                const sample = Object.keys(missing).slice(0, 10)
                if (sample.length > 0)
                  console.log(ICONS.note, `Samples: ${sample.map(k => `\`${k}\``).join(', ')}${Object.keys(missing).length > sample.length ? '...' : ''}`)
              }
            }

            if (!args.fix) {
              console.log(ICONS.error, 'Missing keys detected. Run with `--fix` to add empty keys.')
              process.exitCode = 1
              return
            }

            const filesToWrite: Record<string, LocaleJson> = {}
            const keyCountsBefore: Record<string, number> = {}
            const keyCountsAfter: Record<string, number> = {}

            for (const [locale, missing] of Object.entries(missingKeysByLocale)) {
              const localePath = r(`${locale}.json`, config)
              let existing: LocaleJson = {}
              try {
                existing = JSON.parse(fs.readFileSync(localePath, { encoding: 'utf8' }))
              }
              catch (error: any) {
                if (error.code !== 'ENOENT')
                  throw error
              }

              keyCountsBefore[locale] = countKeys(existing)

              const missingEmpty: LocaleJson = {}
              for (const key of Object.keys(missing))
                missingEmpty[key] = ''

              const merged = mergeMissingTranslations(existing, missingEmpty)
              filesToWrite[localePath] = merged
              keyCountsAfter[locale] = countKeys(merged)
            }

            saveUndoState(Object.keys(filesToWrite), config as any)
            for (const [filePath, content] of Object.entries(filesToWrite)) {
              const dir = path.dirname(filePath)
              if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true })
              fs.writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`, { encoding: 'utf8' })
            }

            console.log(ICONS.success, 'Missing keys added successfully.')
            return
          }

          const { parser: Parser } = i18nextParser
          const parser = new Parser({
            ...config.parser,
            locales: i18n.locales,
            output: r(config.adapters.json?.directory || 'locales', config),
          })

          const files = await glob(config.parser.input, { cwd: config.cwd, absolute: true })

          const usedKeysInCode: { key: string, defaultValue?: string }[] = []
          const parsingTask = async () => {
            for (const file of files) {
              const content = fs.readFileSync(file, 'utf8')
              const keysFromFile = parser.parse(content, file)
              usedKeysInCode.push(...keysFromFile.map((k: any) => ({ key: k.key, defaultValue: k.defaultValue })))
            }
          }

          if (args.silent)
            await parsingTask()
          else
            await console.loading('Checking for missing and unused keys in the codebase', parsingTask)

          const usedKeysMap = new Map<string, string | undefined>()
          for (const { key, defaultValue } of usedKeysInCode) {
            const existing = usedKeysMap.get(key)
            if (defaultValue || existing === undefined)
              usedKeysMap.set(key, defaultValue)
          }

          const uniqueUsedKeys = Array.from(usedKeysMap.entries()).map(([key, defaultValue]) => ({ key, defaultValue }))

          const allLocaleKeys = getAllKeys(defaultLocaleJson)
          const missingKeysWithValues = uniqueUsedKeys.filter(({ key }) => !allLocaleKeys.includes(key))
          const missingKeys = missingKeysWithValues.map(({ key }) => key)
          const unusedKeys = allLocaleKeys.filter(key => !uniqueUsedKeys.some(k => k.key === key))

          let hasIssues = false
          if (missingKeys.length > 0) {
            hasIssues = true
            if (args.silent) {
              if (!args.fix) {
                console.log(`Missing keys: ${missingKeys.length}`)
                const sample = missingKeys.slice(0, 10)
                if (sample.length > 0)
                  console.log(`Samples: ${sample.map(k => k).join(', ')}${missingKeys.length > sample.length ? '...' : ''}`)
              }
            }
            else {
              console.log(ICONS.warning, `Found \`${missingKeys.length}\` missing keys in default locale`)
              const sample = missingKeys.slice(0, 10)
              if (sample.length > 0)
                console.log(ICONS.note, `Samples: ${sample.map(k => `\`${k}\``).join(', ')}${missingKeys.length > sample.length ? '...' : ''}`)
            }
          }

          if (unusedKeys.length > 0) {
            hasIssues = true
            if (args.silent) {
              if (!args.prune) {
                console.log(`Unused keys: ${unusedKeys.length}`)
                const sample = unusedKeys.slice(0, 10)
                if (sample.length > 0)
                  console.log(`Samples: ${sample.map(k => k).join(', ')}${unusedKeys.length > sample.length ? '...' : ''}`)
              }
            }
            else {
              console.log(ICONS.warning, `Found \`${unusedKeys.length}\` unused keys in default locale`)
              const sample = unusedKeys.slice(0, 10)
              if (sample.length > 0)
                console.log(ICONS.note, `Samples: ${sample.map(k => `\`${k}\``).join(', ')}${unusedKeys.length > sample.length ? '...' : ''}`)
            }
          }

          if (!hasIssues) {
            if (!args.silent)
              console.log(ICONS.success, 'All keys are in sync.')
            return
          }

          if (args.fix && missingKeys.length > 0) {
            const missingWithValues: LocaleJson = {}
            for (const { key, defaultValue } of missingKeysWithValues)
              missingWithValues[key] = defaultValue || ''

            const defaultLocalePath = r(`${i18n.defaultLocale}.json`, config)
            const merged = mergeMissingTranslations(defaultLocaleJson, missingWithValues)
            saveUndoState([defaultLocalePath], config as any)
            const dir = path.dirname(defaultLocalePath)
            if (!fs.existsSync(dir))
              fs.mkdirSync(dir, { recursive: true })
            fs.writeFileSync(defaultLocalePath, `${JSON.stringify(merged, null, 2)}\n`, { encoding: 'utf8' })
            if (!args.silent)
              console.log(ICONS.success, 'Missing keys added.')
            else
              console.log(`Fixed ${missingKeys.length} missing keys.`)
          }

          if (args.prune && unusedKeys.length > 0) {
            const result = args.silent
              ? true
              : await confirm({
                  message: (`${ICONS.warning} This will remove ${c.cyan(`${unusedKeys.length}`)} unused keys from all locales. Continue?`),
                  initialValue: false,
                })
            if (result) {
              const filesToModify = i18n.locales.map(locale => r(`${locale}.json`, config))
              saveUndoState(filesToModify, config as any)

              for (const locale of i18n.locales) {
                const localePath = r(`${locale}.json`, config)
                if (!fs.existsSync(localePath))
                  continue
                const localeJson = JSON.parse(fs.readFileSync(localePath, { encoding: 'utf8' }))
                for (const key of unusedKeys) {
                  const nested = findNestedKey(localeJson, key)
                  if (nested.value !== undefined)
                    nested.delete()
                }
                cleanupEmptyObjects(localeJson)
                const dir = path.dirname(localePath)
                if (!fs.existsSync(dir))
                  fs.mkdirSync(dir, { recursive: true })
                fs.writeFileSync(localePath, `${JSON.stringify(localeJson, null, 2)}\n`, { encoding: 'utf8' })
              }
              if (!args.silent)
                console.log(ICONS.success, 'Unused keys removed.')
              else
                console.log(`Removed ${unusedKeys.length} unused keys.`)
            }
          }

          if (hasIssues && !args.fix && !args.prune) {
            if (args.silent)
              console.log('\nKey issues detected. Run with --fix to add missing keys or --prune to delete them.')
            else
              console.log(ICONS.info, 'Key issues detected. Run with `--fix` to add missing keys or `--prune` to delete them.')
            process.exitCode = 1
          }
        }
      })
    }
  },
})
